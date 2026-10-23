import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwksClient from 'jwks-rsa';
import rateLimit from 'express-rate-limit';
import { prisma } from '../db';
import { sendOtpEmail } from '../utils/email';

const router = Router();
const getJwtSecret = () => process.env.JWT_SECRET || '';


const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 15,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts. Please try again after 15 minutes.' }
});

router.use('/api/login', authLimiter);
router.use('/api/auth/m365', authLimiter);

const client = jwksClient({
    jwksUri: 'https://login.microsoftonline.com/common/discovery/v2.0/keys'
});

function getKey(header: any, callback: (err: Error | null, key?: string) => void) {
    client.getSigningKey(header.kid, function (err, key: any) {
        if (err) return callback(err);
        const signingKey = key.publicKey || key.rsaPublicKey;
        callback(null, signingKey);
    });
}

router.post('/api/auth/m365', async (req, res) => {
    try {
        const { idToken, accessToken } = req.body;
        if (!idToken) return res.status(400).json({ error: 'Token is required' });

        (jwt as any).verify(idToken, getKey as any, {
            audience: process.env.AZURE_CLIENT_ID,
            ignoreIssuer: true 
        }, (err: any, decoded: any) => {
            if (err) {
                console.error('Token verification error:', err);
                return res.status(401).json({ error: 'Invalid Microsoft token' });
            }

            // Execute the rest in an async IIFE to handle DB calls
            (async () => {
                try {
                    const decodedToken = decoded as any;
                    const { email, name, preferred_username } = decodedToken;
                    const userEmail = (email || preferred_username || '').toLowerCase();

                    if (!userEmail) return res.status(400).json({ error: 'Email not found in token' });

                    if (!userEmail.endsWith('@avanamedical.com') && !userEmail.endsWith('@avanasurgical.com')) {
                        return res.status(403).json({ error: 'Access denied. Unauthorized domain.' });
                    }

                    if (decodedToken.tid && decodedToken.tid !== process.env.AZURE_TENANT_ID) {
                        return res.status(403).json({ error: 'Access denied. Invalid tenant.' });
                    }

                    // --- Fetch Microsoft Graph profile data ---
                    let graphProfile: any = {};
                    let avatarBase64: string | null = null;

                    if (accessToken) {
                        try {
                            // Fetch basic profile
                            const profileRes = await fetch('https://graph.microsoft.com/v1.0/me?$select=displayName,mobilePhone,jobTitle,companyName,employeeId,officeLocation', {
                                headers: { Authorization: `Bearer ${accessToken}` }
                            });
                            if (profileRes.ok) {
                                graphProfile = await profileRes.json();
                            }

                            // Fetch profile photo
                            const photoRes = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
                                headers: { Authorization: `Bearer ${accessToken}` }
                            });
                            if (photoRes.ok) {
                                const photoBuffer = await photoRes.arrayBuffer();
                                const contentType = photoRes.headers.get('content-type') || 'image/jpeg';
                                avatarBase64 = `data:${contentType};base64,${Buffer.from(photoBuffer).toString('base64')}`;
                            }
                        } catch (graphErr) {
                            console.warn('Graph API fetch failed (non-critical):', graphErr);
                        }
                    }

                    // Build profile data from Graph
                    const profileData = {
                        name: graphProfile.displayName || name || userEmail.split('@')[0],
                        mobile: graphProfile.mobilePhone || null,
                        jobTitle: graphProfile.jobTitle || null,
                        company: graphProfile.companyName || null,
                        employeeId: graphProfile.employeeId || null,
                        ...(avatarBase64 ? { avatar: avatarBase64 } : {}),
                    };

                    // Upsert User — always sync profile on login
                    let user = await prisma.user.findUnique({
                        where: { email: userEmail },
                        include: { department: true, branch: true }
                    });

                    if (!user) {
                        const userCount = await prisma.user.count();
                        user = await prisma.user.create({
                            data: {
                                email: userEmail,
                                ...profileData,
                                role: userCount === 0 ? 'Admin' : 'User',
                                status: 'Active'
                            },
                            include: { department: true, branch: true }
                        });
                    } else {
                        // Sync profile data on every login
                        user = await prisma.user.update({
                            where: { email: userEmail },
                            data: profileData,
                            include: { department: true, branch: true }
                        });
                    }

                    if (user.status === 'Inactive') {
                        return res.status(403).json({ error: 'Account is inactive' });
                    }

                    const token = jwt.sign({ id: user.id, role: user.role }, getJwtSecret(), { expiresIn: '8h' });
                    const csrfToken = crypto.randomBytes(32).toString('hex');
                    
                    res.cookie('authToken', token, {
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: 'strict',
                        maxAge: 8 * 60 * 60 * 1000
                    });
                    res.cookie('XSRF-TOKEN', csrfToken, {
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: 'strict',
                        maxAge: 8 * 60 * 60 * 1000
                    });
                    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status, avatar: user.avatar, mobile: user.mobile, jobTitle: user.jobTitle, company: user.company, employeeId: user.employeeId } });
                } catch (dbError) {
                    console.error('M365 DB Error:', dbError);
                    res.status(500).json({ error: 'Failed to sync user data' });
                }
            })();
        });
    } catch (error) {
        console.error('M365 Auth Error:', error);
        res.status(500).json({ error: 'Microsoft authentication failed' });
    }
});

// --- Authentication Routes ---

router.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user || !user.password) return res.status(400).json({ error: 'Invalid credentials' });

        if (user.status === 'Inactive') return res.status(403).json({ error: 'Account is inactive. Please contact IT support.' });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: user.id, role: user.role }, getJwtSecret(), { expiresIn: '8h' });
        const csrfToken = crypto.randomBytes(32).toString('hex');
        
        res.cookie('authToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 8 * 60 * 60 * 1000 // 8 hours
        });
        res.cookie('XSRF-TOKEN', csrfToken, {
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 8 * 60 * 60 * 1000
        });
        res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status } });
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

router.post('/api/logout', (req, res) => {
    res.clearCookie('authToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    });
    res.clearCookie('XSRF-TOKEN', {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    });
    res.json({ success: true, message: 'Logged out successfully' });
});

// --- Email OTP Authentication Endpoints ---

router.post('/api/auth/otp/send', async (req, res) => {
    try {
        const email = req.body.email?.toString().trim().toLowerCase();
        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'A valid email address is required.' });
        }

        // Find user by email (case-insensitive)
        const user = await prisma.user.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } }
        });

        if (!user) {
            return res.status(404).json({
                error: 'No account found with this email. Please verify the spelling or contact IT Support.'
            });
        }

        if (user.status === 'Inactive') {
            return res.status(403).json({
                error: 'This account is deactivated. Please contact IT Support.'
            });
        }

        // Rate limiting cooldown check (60 seconds)
        const recentOtp = await prisma.loginOtp.findFirst({
            where: {
                email: user.email,
                createdAt: { gt: new Date(Date.now() - 60 * 1000) }
            },
            orderBy: { createdAt: 'desc' }
        });

        if (recentOtp) {
            const secondsLeft = Math.max(1, Math.ceil((recentOtp.createdAt.getTime() + 60 * 1000 - Date.now()) / 1000));
            return res.status(429).json({
                error: `Please wait ${secondsLeft} seconds before requesting another code.`,
                retryAfter: secondsLeft
            });
        }

        // Generate 6-digit numeric OTP code
        const otpCode = crypto.randomInt(100000, 1000000).toString();
        const otpHash = await bcrypt.hash(otpCode, 10);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Clear any old OTP records for this email
        await prisma.loginOtp.deleteMany({
            where: { email: user.email }
        });

        // Store new hashed OTP
        await prisma.loginOtp.create({
            data: {
                email: user.email,
                otpHash,
                attempts: 0,
                expiresAt
            }
        });

        // Dispatch OTP email in background
        sendOtpEmail({
            toEmail: user.email,
            toName: user.name || 'Avana User',
            otp: otpCode
        }).catch(err => {
            console.error(`[OTP Send] Failed to dispatch OTP to ${user.email}:`, err);
        });

        console.log(`[OTP Send] Generated and sent OTP for ${user.email}`);
        res.json({
            success: true,
            message: `A 6-digit verification code has been sent to ${user.email}`,
            email: user.email,
            cooldownSeconds: 60
        });
    } catch (error: any) {
        console.error('[OTP Send Error]:', error);
        res.status(500).json({ error: 'Failed to generate verification code. Please try again.' });
    }
});

router.post('/api/auth/otp/verify', async (req, res) => {
    try {
        const email = req.body.email?.toString().trim().toLowerCase();
        const otp = req.body.otp?.toString().trim();

        if (!email || !otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
            return res.status(400).json({ error: 'A valid email and 6-digit numeric code are required.' });
        }

        const user = await prisma.user.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } }
        });

        if (!user || user.status === 'Inactive') {
            return res.status(401).json({ error: 'Account not found or deactivated.' });
        }

        // Retrieve valid, unexpired OTP record
        const activeOtp = await prisma.loginOtp.findFirst({
            where: {
                email: user.email,
                expiresAt: { gt: new Date() }
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!activeOtp) {
            return res.status(400).json({
                error: 'Verification code has expired or was not requested. Please request a new code.'
            });
        }

        // Enforce maximum 5 attempts
        if (activeOtp.attempts >= 5) {
            await prisma.loginOtp.delete({ where: { id: activeOtp.id } });
            return res.status(429).json({
                error: 'Too many incorrect attempts. This code has been invalidated. Please request a new code.'
            });
        }

        const isMatch = await bcrypt.compare(otp, activeOtp.otpHash);
        if (!isMatch) {
            const nextAttempts = activeOtp.attempts + 1;
            const remaining = 5 - nextAttempts;

            if (remaining <= 0) {
                await prisma.loginOtp.delete({ where: { id: activeOtp.id } });
                return res.status(400).json({
                    error: 'Invalid code. Maximum attempts reached. Please request a new code.'
                });
            }

            await prisma.loginOtp.update({
                where: { id: activeOtp.id },
                data: { attempts: nextAttempts }
            });

            return res.status(400).json({
                error: `Incorrect code. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`
            });
        }

        // OTP is valid - delete it immediately (single-use)
        await prisma.loginOtp.delete({ where: { id: activeOtp.id } });

        // Issue auth cookie and CSRF token
        const token = jwt.sign({ id: user.id, role: user.role }, getJwtSecret(), { expiresIn: '8h' });
        const csrfToken = crypto.randomBytes(32).toString('hex');

        res.cookie('authToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 8 * 60 * 60 * 1000 // 8 hours
        });
        res.cookie('XSRF-TOKEN', csrfToken, {
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 8 * 60 * 60 * 1000
        });

        console.log(`[OTP Verify] Successfully verified and logged in ${user.email} (${user.role})`);
        res.json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status
            }
        });
    } catch (error: any) {
        console.error('[OTP Verify Error]:', error);
        res.status(500).json({ error: 'Authentication verification failed. Please try again.' });
    }
});

export default router;
