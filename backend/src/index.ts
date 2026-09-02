import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireAdmin } from './middleware/auth';
import jwksClient from 'jwks-rsa';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import nodemailer from 'nodemailer';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32 || JWT_SECRET.includes('avana-it-management-secure-secret')) {
    console.error('FATAL SECURITY ERROR: JWT_SECRET must be defined and at least 32 characters long. Default/weak secrets are rejected.');
    process.exit(1);
}

dotenv.config();

// --- Backend Email Helper (Microsoft Graph API Certificate/Secret OAuth2 & Nodemailer SMTP Fallback) ---
function cleanPem(raw?: string): string | undefined {
    if (!raw) return undefined;
    let cleaned = raw.trim();
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
        cleaned = cleaned.slice(1, -1);
    }
    cleaned = cleaned.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
    return cleaned.trim();
}

async function getGraphAppToken(): Promise<{ token: string | null; error?: string; method?: string }> {
    const tenantId = process.env.AZURE_TENANT_ID;
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;

    // 1. Check for Certificate-Based Authentication (Enterprise Standard)
    let privateKeyPem = cleanPem(process.env.AZURE_CLIENT_CERTIFICATE_PRIVATE_KEY);
    let certPem = cleanPem(process.env.AZURE_CLIENT_CERTIFICATE);

    // Fallback to local files if present
    if (!privateKeyPem) {
        const keyPath = path.join(process.cwd(), 'avana-private-key.pem');
        if (fs.existsSync(keyPath)) {
            try { privateKeyPem = cleanPem(fs.readFileSync(keyPath, 'utf8')); } catch (e) {}
        }
    }
    if (!certPem) {
        const certPath = path.join(process.cwd(), 'avana-certificate.crt');
        if (fs.existsSync(certPath)) {
            try { certPem = cleanPem(fs.readFileSync(certPath, 'utf8')); } catch (e) {}
        }
    }

    if (tenantId && clientId && privateKeyPem) {
        try {
            // Compute base64url SHA-1 thumbprint (x5t)
            let x5t: string | undefined;
            if (process.env.AZURE_CLIENT_CERTIFICATE_THUMBPRINT) {
                const rawThumb = process.env.AZURE_CLIENT_CERTIFICATE_THUMBPRINT.trim();
                if (/^[0-9a-fA-F]{40}$/.test(rawThumb)) {
                    x5t = Buffer.from(rawThumb, 'hex').toString('base64url');
                } else {
                    x5t = rawThumb;
                }
            } else if (certPem) {
                const certBase64 = certPem.replace(/-----[^\n]+-----/g, '').replace(/\s+/g, '');
                const certDer = Buffer.from(certBase64, 'base64');
                x5t = crypto.createHash('sha1').update(certDer).digest('base64url');
            }

            if (!x5t) {
                console.warn('[Graph Email] Could not determine x5t thumbprint from certificate.');
            } else {
                const now = Math.floor(Date.now() / 1000);
                const clientAssertion = jwt.sign(
                    {
                        aud: `https://login.microsoftonline.com/${tenantId}/v2.0`,
                        exp: now + 300,
                        iss: clientId,
                        jti: crypto.randomUUID(),
                        nbf: now - 10,
                        sub: clientId
                    },
                    privateKeyPem,
                    {
                        algorithm: 'RS256',
                        header: {
                            alg: 'RS256',
                            typ: 'JWT',
                            x5t: x5t
                        }
                    }
                );

                const params = new URLSearchParams();
                params.append('client_id', clientId);
                params.append('scope', 'https://graph.microsoft.com/.default');
                params.append('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
                params.append('client_assertion', clientAssertion);
                params.append('grant_type', 'client_credentials');

                const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params.toString(),
                    signal: AbortSignal.timeout(8000)
                });

                if (res.ok) {
                    const data = await res.json();
                    console.log('[Graph Email] Successfully acquired Microsoft Graph token via Certificate Authentication!');
                    return { token: data.access_token, method: 'Certificate' };
                } else {
                    const errText = await res.text();
                    console.error('[Graph Email] Certificate Token acquisition failed:', errText);
                    return { token: null, error: `Certificate token error: ${errText}`, method: 'Certificate' };
                }
            }
        } catch (certErr: any) {
            console.error('[Graph Email] Error during Certificate auth:', certErr.message || certErr);
            return { token: null, error: `Certificate exception: ${certErr.message || certErr}`, method: 'Certificate' };
        }
    }

    // 2. Fallback to Client Secret if available
    if (tenantId && clientId && clientSecret) {
        try {
            const params = new URLSearchParams();
            params.append('client_id', clientId);
            params.append('scope', 'https://graph.microsoft.com/.default');
            params.append('client_secret', clientSecret);
            params.append('grant_type', 'client_credentials');

            const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString(),
                signal: AbortSignal.timeout(8000)
            });

            if (res.ok) {
                const data = await res.json();
                return { token: data.access_token, method: 'ClientSecret' };
            } else {
                const errText = await res.text();
                console.error('[Graph Email] Secret Token acquisition failed:', errText);
                return { token: null, error: `Secret token error: ${errText}`, method: 'ClientSecret' };
            }
        } catch (err: any) {
            console.error('[Graph Email] Error requesting app token via secret:', err.message || err);
            return { token: null, error: `Secret exception: ${err.message || err}`, method: 'ClientSecret' };
        }
    }

    return { token: null, error: 'No certificate private key or client secret configured' };
}

interface EmailLogEntry {
    id: string;
    timestamp: string;
    ticketId: number;
    subject: string;
    from: string;
    to: string;
    replyTo?: string;
    senderName: string;
    isReply: boolean;
    status: 'SUCCESS' | 'FAILED';
    method?: string;
    error?: string;
}

const emailHistory: EmailLogEntry[] = [];

async function sendTicketEmail(options: {
    toEmail: string;
    toName: string;
    ticketId: number;
    ticketSubject: string;
    senderName: string;
    senderEmail?: string;  // actual sender's email for Reply-To
    messageBody: string;
    category?: string;
    priority?: string;
    status?: string;
    assetName?: string;
    isReply: boolean;
}): Promise<{ success: boolean; method?: string; error?: string }> {
    const fromMail = process.env.SMTP_FROM || process.env.SMTP_USER || 'itsupport@avanamedical.com';
    const portalUrl = process.env.FRONTEND_URL || 'https://avana-it-management.vercel.app';
    const ticketUrl = `${portalUrl}/tickets/${options.ticketId}`;
    const trackingTag = `[AVANA-TICKET #${options.ticketId}]`;
    const cleanSubject = (options.ticketSubject || 'Support Ticket').replace(/\[AVANA-TICKET\s*#\d+\]/gi, '').replace(/^(RE:\s*)+/i, '').trim();
    const subject = options.isReply ? `RE: ${trackingTag} ${cleanSubject}` : `${trackingTag} ${cleanSubject}`;

    // Outlook/Exchange threads by Thread-Index — a base64 value where replies append 5 bytes
    // Base: sha1-like 27-byte header derived from ticketId; replies append 5 null bytes
    const baseThreadIndex = Buffer.alloc(27);
    baseThreadIndex.writeUInt32BE(Math.floor(Date.UTC(2024, 0, 1) / 10000000), 0); // FILETIME hi
    baseThreadIndex.writeUInt32BE(options.ticketId * 1000, 4); // FILETIME lo (stable per ticket)
    // GUID bytes seeded from ticketId
    for (let i = 8; i < 27; i++) baseThreadIndex[i] = (options.ticketId * (i + 1)) & 0xff;
    const replyBytes = options.isReply ? Buffer.alloc(5) : Buffer.alloc(0);
    const threadIndex = Buffer.concat([baseThreadIndex, replyBytes]).toString('base64');

    const logEntry: EmailLogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        ticketId: options.ticketId,
        subject,
        from: fromMail,
        to: options.toEmail,
        replyTo: options.senderEmail,
        senderName: options.senderName,
        isReply: options.isReply,
        status: 'FAILED'
    };

    const htmlContent = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f8fafc;margin:0;padding:20px;color:#1e293b}
  .container{max-width:600px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,.1)}
  .header{background:#0f172a;color:#fff;padding:24px;text-align:left}
  .badge{display:inline-block;background:#dc2626;color:#fff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:9999px;text-transform:uppercase;letter-spacing:.05em}
  .title{font-size:20px;font-weight:800;margin:12px 0 4px 0;color:#fff}
  .meta{font-size:12px;color:#94a3b8}
  .content{padding:24px;line-height:1.6;font-size:14px;color:#334155}
  .message-box{background:#f1f5f9;border-left:4px solid #dc2626;padding:16px;border-radius:8px;margin:16px 0;font-size:14px;white-space:pre-wrap}
  .cta{text-align:center;padding:8px 0 20px}
  .btn{display:inline-block;background:#0f172a;color:#fff !important;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px}
  .footer{padding:12px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <span class="badge">${options.category || 'IT Support'}</span>
    <div class="title">${options.isReply ? 'New Response on Your Ticket' : 'New Support Ticket Received'}</div>
    <div class="meta">Ticket #${options.ticketId} &bull; From: ${options.senderName}${options.senderEmail ? ` &lt;${options.senderEmail}&gt;` : ''}</div>
  </div>
  <div class="content">
    <p>Hello <strong>${options.toName}</strong>,</p>
    <p>${options.isReply ? `<strong>${options.senderName}</strong> has posted a reply:` : 'A new support ticket has been submitted:'}</p>
    <div class="message-box">${options.messageBody.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    ${options.priority ? `<p><strong>Priority:</strong> ${options.priority}</p>` : ''}
    ${options.status ? `<p><strong>Status:</strong> ${options.status}</p>` : ''}
    ${options.assetName ? `<p><strong>Related Asset:</strong> ${options.assetName}</p>` : ''}
  </div>
  <div class="cta">
    <a href="${ticketUrl}" class="btn">&#128172; View &amp; Reply in Portal</a>
  </div>
  <div class="footer">
    Avana IT Management &bull; Ticket ${trackingTag}
  </div>
</div>
</body>
</html>`;

    function recordLog(status: 'SUCCESS' | 'FAILED', method?: string, error?: string) {
        logEntry.status = status;
        logEntry.method = method;
        logEntry.error = error;
        emailHistory.unshift({ ...logEntry });
        if (emailHistory.length > 100) emailHistory.pop();
    }

    // 1. Try Microsoft Graph API
    const authResult = await getGraphAppToken();
    const threadMsgId = `<ticket-${options.ticketId}@avanamedical.com>`;
    const internetMessageHeaders = options.isReply ? [
        { name: 'In-Reply-To', value: threadMsgId },
        { name: 'References', value: threadMsgId },
        { name: 'Thread-Topic', value: `${trackingTag} ${cleanSubject}` },
        { name: 'Thread-Index', value: threadIndex }
    ] : [
        { name: 'Thread-Topic', value: `${trackingTag} ${cleanSubject}` },
        { name: 'Thread-Index', value: threadIndex }
    ];

    if (authResult.token) {
        try {
            const sendViaGraph = async (sendAsMailbox: string) => {
                const graphPayload = {
                    message: {
                        subject,
                        body: {
                            contentType: 'HTML',
                            content: htmlContent
                        },
                        toRecipients: [
                            {
                                emailAddress: {
                                    address: options.toEmail,
                                    name: options.toName
                                }
                            }
                        ],
                        replyTo: options.senderEmail ? [
                            {
                                emailAddress: {
                                    address: options.senderEmail,
                                    name: options.senderName
                                }
                            }
                        ] : undefined,
                        internetMessageHeaders
                    },
                    saveToSentItems: "false"
                };

                return await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sendAsMailbox)}/sendMail`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authResult.token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(graphPayload),
                    signal: AbortSignal.timeout(10000)
                });
            };

            let graphRes = await sendViaGraph(fromMail);

            // If shared mailbox failed with 403 / 404, try sending via the admin mailbox
            const adminFallback = process.env.SMTP_USER || 'aravinth@avanamedical.com';
            if (!graphRes.ok && fromMail !== adminFallback) {
                console.warn(`[Email] Sending as ${fromMail} returned ${graphRes.status}. Retrying as ${adminFallback}...`);
                const retryRes = await sendViaGraph(adminFallback);
                if (retryRes.ok || retryRes.status === 202) {
                    graphRes = retryRes;
                }
            }

            if (graphRes.ok || graphRes.status === 202) {
                console.log(`[Email] Successfully dispatched ticket #${options.ticketId} email via Microsoft Graph API -> ${options.toEmail}`);
                recordLog('SUCCESS', `Microsoft Graph API (${authResult.method})`);
                return { success: true, method: `Microsoft Graph API (${authResult.method})` };
            } else {
                const errText = await graphRes.text();
                console.warn(`[Email] Graph API sendMail failed (${graphRes.status}):`, errText);
                recordLog('FAILED', `Microsoft Graph API (${authResult.method})`, `Graph API (${graphRes.status}): ${errText}`);
                return { success: false, error: `Graph API (${graphRes.status}): ${errText}`, method: `Microsoft Graph API (${authResult.method})` };
            }
        } catch (graphErr: any) {
            console.warn('[Email] Graph API exception:', graphErr.message || graphErr);
            recordLog('FAILED', 'Microsoft Graph API', `Graph API exception: ${graphErr.message || graphErr}`);
            return { success: false, error: `Graph API exception: ${graphErr.message || graphErr}`, method: 'Microsoft Graph API' };
        }
    }

    // 2. Nodemailer SMTP Fallback (Only if no Graph Token was available)
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    if (smtpUser && smtpPass) {
        try {
            const transporter = nodemailer.createTransport({
                host: 'smtp.office365.com',
                port: 587,
                secure: false, // STARTTLS on port 587
                requireTLS: true,
                connectionTimeout: 4000,
                greetingTimeout: 4000,
                socketTimeout: 4000,
                auth: { user: smtpUser, pass: smtpPass },
                tls: { minVersion: 'TLSv1.2', rejectUnauthorized: false }
            });

            try {
                await transporter.sendMail({
                    from: `"${options.senderName} via IT Support" <${fromMail}>`,
                    to: `"${options.toName}" <${options.toEmail}>`,
                    replyTo: options.senderEmail ? `"${options.senderName}" <${options.senderEmail}>` : fromMail,
                    subject,
                    html: htmlContent,
                    headers: {
                        'Thread-Topic': `${trackingTag} ${cleanSubject}`,
                        ...(options.isReply ? {
                            'In-Reply-To': threadMsgId,
                            'References': threadMsgId
                        } : {
                            'Message-ID': threadMsgId
                        })
                    }
                });
                console.log(`[Email] Successfully dispatched ticket #${options.ticketId} email via SMTP (${fromMail} -> ${options.toEmail})`);
                recordLog('SUCCESS', 'SMTP (Direct)');
                return { success: true, method: 'SMTP (Direct)' };
            } catch (sendAsErr: any) {
                if (fromMail !== smtpUser) {
                    console.warn(`[Email] Failed to send as ${fromMail} (${sendAsErr.message}). Retrying from ${smtpUser}...`);
                    await transporter.sendMail({
                        from: `"${options.senderName} via IT Support" <${smtpUser}>`,
                        to: `"${options.toName}" <${options.toEmail}>`,
                        replyTo: options.senderEmail ? `"${options.senderName}" <${options.senderEmail}>` : fromMail,
                        subject,
                        html: htmlContent,
                        headers: {
                            'Thread-Topic': `${trackingTag} ${cleanSubject}`,
                            ...(options.isReply ? {
                                'In-Reply-To': threadMsgId,
                                'References': threadMsgId
                            } : {
                                'Message-ID': threadMsgId
                            })
                        }
                    });
                    console.log(`[Email] Successfully dispatched ticket #${options.ticketId} email via SMTP fallback (${smtpUser} -> ${options.toEmail})`);
                    recordLog('SUCCESS', 'SMTP (User Fallback)');
                    return { success: true, method: 'SMTP (User Fallback)' };
                }
                throw sendAsErr;
            }
        } catch (smtpErr: any) {
            console.error('[Email] Nodemailer SMTP send error:', smtpErr.message || smtpErr);
            recordLog('FAILED', 'SMTP', `SMTP Error: ${smtpErr.message}`);
            return { success: false, error: `SMTP Error: ${smtpErr.message}`, method: 'SMTP' };
        }
    }

    const lastError = authResult.error || 'No valid email configuration (Certificate or SMTP) found.';
    console.warn(`[Email] No email dispatched for ticket #${options.ticketId}. Reason: ${lastError}`);
    recordLog('FAILED', undefined, lastError);
    return { success: false, error: lastError };
}

// --- Zod Schemas for Validation ---

const userSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().nullable().optional(),
    role: z.enum(['Admin', 'Manager', 'User']).default('User'),
    status: z.enum(['Active', 'Inactive']).default('Active'),
    departmentId: z.any().transform(val => (val !== undefined && val !== null && val !== '' && !isNaN(Number(val))) ? Number(val) : null).nullable().optional(),
    branchId: z.any().transform(val => (val !== undefined && val !== null && val !== '' && !isNaN(Number(val))) ? Number(val) : null).nullable().optional(),
    managerId: z.any().transform(val => (val !== undefined && val !== null && val !== '' && !isNaN(Number(val))) ? Number(val) : null).nullable().optional(),
    avatar: z.string().nullable().optional(),
    mobile: z.string().nullable().optional(),
    jobTitle: z.string().nullable().optional(),
    company: z.string().nullable().optional(),
    employeeId: z.string().nullable().optional(),
    accountType: z.string().default('Employee'),
    laptopStatus: z.string().nullable().optional(),
});

const assetSchema = z.object({
    assetId: z.string().min(3),
    name: z.string().min(2),
    category: z.string(),
    status: z.enum(['In Stock', 'Assigned', 'In Repair', 'Retired', 'Pending Handover']).default('In Stock'),

    assigneeId: z.number().nullable().optional(),
    assigneeType: z.enum(['User', 'Department', 'Branch']).nullable().optional(),
    company: z.string().nullable().optional(),
    brand: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
    serialNumber: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    purchaseId: z.number().nullable().optional(),
    warrantyType: z.string().nullable().optional(),
    warrantyStartDate: z.string().nullable().optional(),
    warrantyYears: z.string().nullable().optional(),
    warrantyEndDate: z.string().nullable().optional(),
    remarks: z.string().nullable().optional(),
    specs: z.any().nullable().optional(), // Parsed JSON
});

const purchaseSchema = z.object({
    invoiceNumber: z.string().min(1),
    purchaseDate: z.string(),
    vendor: z.string().nullable().optional(),
    amount: z.number().nullable().optional(),
    poNumber: z.string().nullable().optional(),
    invoiceAttachmentUrl: z.string().nullable().optional(),
    invoiceAttachmentFilename: z.string().nullable().optional(),
    poAttachmentUrl: z.string().nullable().optional(),
    poAttachmentFilename: z.string().nullable().optional(),
});

const licenseSchema = z.object({
    name: z.string().min(2),
    category: z.string(),
    key: z.string().nullable().optional(),
    seats: z.number().int().min(1).default(1),
    startDate: z.string().transform(v => v === '' ? null : v).nullable().optional(),
    expirationDate: z.string().transform(v => v === '' ? null : v).nullable().optional(),
    cost: z.number().nullable().optional(),
    status: z.string().default('Active'),
    remarks: z.string().nullable().optional(),
});

// Security Middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
    origin: process.env.FRONTEND_URL || ['http://localhost', 'http://localhost:5173'],
    credentials: true,
}));

// Global parsing middleware
app.use(express.json());
app.use(cookieParser());

// Rate Limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 1000,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// Strict Rate Limiting for Authentication Endpoints (Brute-Force Protection)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 15, // 15 attempts per IP per 15 minutes
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts. Please try again after 15 minutes.' }
});
app.use('/api/login', authLimiter);
app.use('/api/auth/m365', authLimiter);

// Static File Serving for Uploads (Images and Ticket Attachments)
const uploadsDir = path.join(os.tmpdir(), 'avana-uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Request Logger (Sanitized & secure)
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    if (process.env.NODE_ENV !== 'production' && req.method !== 'GET' && req.body) {
        const sanitized = { ...req.body };
        if (sanitized.password) sanitized.password = '[REDACTED]';
        if (sanitized.currentPassword) sanitized.currentPassword = '[REDACTED]';
        if (sanitized.token) sanitized.token = '[REDACTED]';
        if (sanitized.idToken) sanitized.idToken = '[REDACTED]';
        if (sanitized.accessToken) sanitized.accessToken = '[REDACTED]';
        if (sanitized.signature) sanitized.signature = '[REDACTED BASE64]';
        console.log('Body (Sanitized):', JSON.stringify(sanitized, null, 2));
    }
    next();
});

// --- M365 Authentication Logic ---
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

app.post('/api/auth/m365', async (req, res) => {
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

                    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
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

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user || !user.password) return res.status(400).json({ error: 'Invalid credentials' });

        if (user.status === 'Inactive') return res.status(403).json({ error: 'Account is inactive. Please contact IT support.' });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
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

app.post('/api/logout', (req, res) => {
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

app.get('/api/users/me', authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { id } = req.user;
        const user = await prisma.user.findUnique({
            where: { id: Number(id) },
            include: { department: true, branch: true }
        });
        if (!user || user.status === 'Inactive') {
            return res.status(401).json({ error: 'User not found or inactive' });
        }
        res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status, avatar: user.avatar, mobile: user.mobile, jobTitle: user.jobTitle, company: user.company, employeeId: user.employeeId } });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
});

// --- Handover Endpoints ---

// List all handovers (Admin sees all, Manager sees direct reports, User sees own)
app.get('/api/handovers', authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { role, id: userId } = req.user;
        let handovers;
        if (role === 'Admin') {
            handovers = await prisma.handoverLog.findMany({
                include: {
                    asset: true,
                    user: { select: { id: true, name: true, email: true, department: true } }
                },
                orderBy: { handoverDate: 'desc' }
            });
        } else if (role === 'Manager') {
            handovers = await prisma.handoverLog.findMany({
                where: {
                    OR: [
                        { userId },
                        { user: { managerId: userId } }
                    ]
                },
                include: {
                    asset: true,
                    user: { select: { id: true, name: true, email: true, department: true } }
                },
                orderBy: { handoverDate: 'desc' }
            });
        } else {
            handovers = await prisma.handoverLog.findMany({
                where: { userId },
                include: { asset: true },
                orderBy: { handoverDate: 'desc' }
            });
        }
        res.json(handovers);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch handovers' });
    }
});

// Get pending handovers for current user
app.get('/api/handovers/pending', authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { id: userId } = req.user;
        const handovers = await prisma.handoverLog.findMany({
            where: { userId, status: 'Pending' },
            include: { asset: true }
        });
        res.json(handovers);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch pending handovers' });
    }
});

// Sign a handover
app.post('/api/handovers/:id/sign', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { signature } = req.body;
        // @ts-ignore
        const { id: userId } = req.user;

        if (!signature) return res.status(400).json({ error: 'Signature is required' });

        const handover = await prisma.handoverLog.findUnique({
            where: { id: Number(id) }
        });

        if (!handover || handover.userId !== userId) {
            return res.status(404).json({ error: 'Handover not found or unauthorized' });
        }

        if (handover.status !== 'Pending') {
            return res.status(400).json({ error: 'Handover is already signed or rejected' });
        }

        // Execute updates atomically in a single transaction
        await prisma.$transaction([
            prisma.handoverLog.update({
                where: { id: Number(id) },
                data: {
                    signature,
                    status: 'Signed',
                    handoverDate: new Date()
                }
            }),
            prisma.asset.update({
                where: { id: handover.assetId },
                data: { status: 'Assigned' }
            }),
            prisma.assetHistory.create({
                data: {
                    assetId: handover.assetId,
                    userId: userId,
                    event: 'Handover Signed',
                    details: 'User digitally signed the handover form.'
                }
            })
        ]);

        res.json({ success: true, message: 'Handover signed successfully' });
    } catch (error) {
        console.error('Failed to sign handover:', error);
        res.status(500).json({ error: 'Failed to sign handover' });
    }
});

// Health check - unprotected
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Secured Avana IT Backend is running' });
});

// --- Users Routes ---

app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { role, id } = req.user;
        let users;

        if (role === 'Admin') {
            users = await prisma.user.findMany({
                include: { department: true, branch: true, manager: true, licenseAssignments: { include: { license: true } } },
                orderBy: { name: 'asc' }
            });
        } else if (role === 'Manager') {
            // Managers see themselves and their direct reports
            users = await prisma.user.findMany({
                where: { OR: [{ id }, { managerId: id }] },
                include: { department: true, branch: true, manager: true, licenseAssignments: { include: { license: true } } },
                orderBy: { name: 'asc' }
            });
        } else {
            // Regular users only see themselves
            users = await prisma.user.findMany({
                where: { id },
                include: { department: true, branch: true, manager: true, licenseAssignments: { include: { license: true } } }
            });
        }

        // Never expose passwords
        const sanitized = users.map(({ password, ...u }) => u);
        res.json(sanitized);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

app.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const validation = userSchema.safeParse(req.body);
        if (!validation.success) {
            const firstErr = validation.error.issues[0]?.message || 'Invalid user data';
            return res.status(400).json({ error: firstErr });
        }
        
        const { name, email, password, role, status, departmentId, branchId, managerId, accountType, mobile, jobTitle, company, employeeId, laptopStatus } = validation.data;

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) return res.status(409).json({ error: 'A user with this email already exists' });

        if (password && password.trim().length > 0 && password.trim().length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
        }

        const hashedPassword = (password && password.trim().length >= 8) ? await bcrypt.hash(password.trim(), 10) : null;
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: role || 'User',
                status: status || 'Active',
                departmentId: departmentId || null,
                branchId: branchId || null,
                managerId: managerId || null,
                accountType: accountType || 'Employee',
                mobile: mobile || null,
                jobTitle: jobTitle || null,
                company: company || null,
                employeeId: employeeId || null,
                laptopStatus: laptopStatus || null,
            },
            include: { department: true, branch: true, manager: true }
        });
        const { password: _, ...sanitized } = user;
        res.status(201).json(sanitized);
    } catch (error: any) {
        console.error('Failed to create user:', error);
        res.status(500).json({ error: error.message || 'Failed to create user' });
    }
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        // @ts-ignore
        const { id: requestingUserId, role: requestingUserRole } = req.user;

        // Security: only admin can edit others; users can only edit their own name/email
        if (requestingUserRole !== 'Admin' && Number(id) !== requestingUserId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const validation = userSchema.partial().safeParse(req.body);
        if (!validation.success) {
            const firstErr = validation.error.issues[0]?.message || 'Invalid user data';
            return res.status(400).json({ error: firstErr });
        }
        
        const { name, email, role, status, departmentId, branchId, managerId, password, avatar, mobile, jobTitle, company, employeeId, accountType, laptopStatus } = validation.data;

        const updateData: any = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (avatar !== undefined) updateData.avatar = avatar;
        if (mobile !== undefined) updateData.mobile = mobile;
        if (jobTitle !== undefined) updateData.jobTitle = jobTitle;
        if (company !== undefined) updateData.company = company;
        if (employeeId !== undefined) updateData.employeeId = employeeId;
        if (accountType !== undefined) updateData.accountType = accountType;
        if (laptopStatus !== undefined) updateData.laptopStatus = laptopStatus;
        
        // Only admin can change role/status/depts
        if (requestingUserRole === 'Admin') {
            if (req.body.role !== undefined) updateData.role = role;
            if (req.body.status !== undefined) updateData.status = status;
            if (departmentId !== undefined) updateData.departmentId = departmentId;
            if (branchId !== undefined) updateData.branchId = branchId;
            if (managerId !== undefined) updateData.managerId = managerId;
        }

        if (password && password.trim().length > 0) {
            if (password.trim().length < 6) {
                return res.status(400).json({ error: 'Password must be at least 6 characters long' });
            }
            if (requestingUserRole !== 'Admin') {
                const { currentPassword } = req.body;
                if (!currentPassword) {
                    return res.status(400).json({ error: 'Current password is required to set a new password.' });
                }
                const existingUser = await prisma.user.findUnique({ where: { id: Number(id) } });
                if (!existingUser?.password) {
                    return res.status(400).json({ error: 'Please contact admin to set an initial password or use Microsoft Login.' });
                }
                const valid = await bcrypt.compare(currentPassword, existingUser.password);
                if (!valid) {
                    return res.status(400).json({ error: 'Invalid current password.' });
                }
            }
            updateData.password = await bcrypt.hash(password.trim(), 10);
        }

        const user = await prisma.user.update({
            where: { id: Number(id) },
            data: updateData,
            include: { department: true, branch: true, manager: true }
        });
        const { password: _, ...sanitized } = user;
        res.json(sanitized);
    } catch (error: any) {
        console.error('Failed to update user:', error);
        res.status(500).json({ error: error.message || 'Failed to update user' });
    }
});

app.put('/api/users/:id/status', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        // @ts-ignore
        const requestingUserId = req.user.id;

        if (Number(id) === requestingUserId) {
            return res.status(400).json({ error: 'You cannot change the status of your own account.' });
        }

        const user = await prisma.user.update({
            where: { id: Number(id) },
            data: { status },
        });
        const { password: _, ...sanitized } = user;
        res.json(sanitized);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update user status' });
    }
});

app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        // @ts-ignore
        const requestingUserId = req.user.id;

        if (Number(id) === requestingUserId) {
            return res.status(400).json({ error: 'You cannot delete your own account.' });
        }

        await prisma.user.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// --- Assets Routes ---

app.get('/api/assets', authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { role, id } = req.user;
        let assets;
        
        if (role === 'Admin') {
            assets = await prisma.asset.findMany({ include: { user: true, purchase: true } });
        } else if (role === 'Manager') {
            // Managers see all assets in their department or their own
            const user = await prisma.user.findUnique({ where: { id } });
            assets = await prisma.asset.findMany({
                where: {
                    OR: [
                        { userId: id },
                        { user: { managerId: id } },
                        { user: { departmentId: user?.departmentId || -1 } }
                    ]
                },
                include: { user: true, purchase: true }
            });
        } else {
            // Regular users only see their own assigned assets
            assets = await prisma.asset.findMany({
                where: { userId: id },
                include: { user: true, purchase: true }
            });
        }
        res.json(assets);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch assets' });
    }
});

app.post('/api/assets', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const validation = assetSchema.safeParse(req.body);
        if (!validation.success) return res.status(400).json({ error: validation.error.format() });

        const data = validation.data;
        const newUserId = data.assigneeType === 'User' ? data.assigneeId : null;
        
        const assetCompany = data.company || (data.assetId ? data.assetId.split('-')[0] : null);

        const asset = await prisma.asset.create({
            data: { 
                ...data, 
                company: assetCompany,
                status: newUserId ? 'Pending Handover' : (data.status || 'In Stock'),
                specs: data.specs ? (typeof data.specs === 'string' ? data.specs : JSON.stringify(data.specs)) : null,
                userId: newUserId // Ensure relation is set
            }
        });

        // Add history for creation
        // @ts-ignore
        const actionUserId = req.user.id;
        await prisma.assetHistory.create({
            data: {
                assetId: asset.id,
                userId: actionUserId,
                event: 'Asset Created',
                details: `Asset '${asset.name}' with ID '${asset.assetId}' was created.`
            }
        });

        if (newUserId) {
            await prisma.handoverLog.create({
                data: {
                    assetId: asset.id,
                    userId: newUserId,
                    status: 'Pending'
                }
            });
        }

        if (data.assigneeType && data.assigneeId) {
            let assigneeName = '';
            if (data.assigneeType === 'User') {
                const u = await prisma.user.findUnique({ where: { id: data.assigneeId } });
                assigneeName = u ? u.name : 'Unknown User';
            } else if (data.assigneeType === 'Department') {
                const d = await prisma.department.findUnique({ where: { id: data.assigneeId } });
                assigneeName = d ? d.name : 'Unknown Department';
            } else if (data.assigneeType === 'Branch') {
                const b = await prisma.branch.findUnique({ where: { id: data.assigneeId } });
                assigneeName = b ? b.name : 'Unknown Branch';
            }
            await prisma.assetHistory.create({
                data: {
                    assetId: asset.id,
                    userId: actionUserId,
                    event: 'Assigned',
                    details: `Assigned to ${data.assigneeType === 'User' ? assigneeName : `${data.assigneeType}: ${assigneeName}`}.`
                }
            });
        }

        res.json(asset);
    } catch (error) {
        console.error('Error creating asset:', error);
        res.status(500).json({ error: 'Failed to create asset' });
    }
});

app.put('/api/assets/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const validation = assetSchema.safeParse(req.body);
        if (!validation.success) return res.status(400).json({ error: validation.error.format() });

        const data = validation.data;
        const existingAsset = await prisma.asset.findUnique({ where: { id: Number(id) } });
        if (!existingAsset) return res.status(404).json({ error: 'Asset not found' });
        
        const newUserId = data.assigneeType === 'User' ? data.assigneeId : null;

        let finalStatus = data.status;
        if (newUserId && existingAsset && existingAsset.userId !== newUserId) {
            // New assignment! Create handover log
            await prisma.handoverLog.create({
                data: {
                    assetId: Number(id),
                    userId: newUserId,
                    status: 'Pending'
                }
            });
            finalStatus = 'Pending Handover';
        }

        const updatedCompany = data.company || existingAsset.company || (data.assetId ? data.assetId.split('-')[0] : (existingAsset.assetId ? existingAsset.assetId.split('-')[0] : null));

        const asset = await prisma.asset.update({
            where: { id: Number(id) },
            data: { 
                ...data, 
                company: updatedCompany,
                status: finalStatus,
                specs: data.specs ? (typeof data.specs === 'string' ? data.specs : JSON.stringify(data.specs)) : null,
                userId: newUserId 
            }
        });

        // @ts-ignore
        const actionUserId = req.user.id;
        
        // Log history based on changes
        if (existingAsset.assigneeType !== data.assigneeType || existingAsset.assigneeId !== data.assigneeId) {
            if (data.assigneeType && data.assigneeId) {
                let assigneeName = '';
                if (data.assigneeType === 'User') {
                    const u = await prisma.user.findUnique({ where: { id: data.assigneeId } });
                    assigneeName = u ? u.name : 'Unknown User';
                } else if (data.assigneeType === 'Department') {
                    const d = await prisma.department.findUnique({ where: { id: data.assigneeId } });
                    assigneeName = d ? d.name : 'Unknown Department';
                } else if (data.assigneeType === 'Branch') {
                    const b = await prisma.branch.findUnique({ where: { id: data.assigneeId } });
                    assigneeName = b ? b.name : 'Unknown Branch';
                }
                await prisma.assetHistory.create({
                    data: {
                        assetId: asset.id,
                        userId: actionUserId,
                        event: 'Assigned',
                        details: `Assigned to ${data.assigneeType === 'User' ? assigneeName : `${data.assigneeType}: ${assigneeName}`}.`
                    }
                });
            } else if (!data.assigneeType && !data.assigneeId && existingAsset.assigneeType) {
                await prisma.assetHistory.create({
                    data: {
                        assetId: asset.id,
                        userId: actionUserId,
                        event: 'Unassigned',
                        details: 'Asset was unassigned manually.'
                    }
                });
            }
        } else {
            await prisma.assetHistory.create({
                data: {
                    assetId: asset.id,
                    userId: actionUserId,
                    event: 'Asset Updated',
                    details: 'Asset details were updated.'
                }
            });
        }

        res.json(asset);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update asset' });
    }
});

app.delete('/api/assets/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.asset.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete asset' });
    }
});

// --- Departments Routes ---

app.get('/api/departments', authenticateToken, async (req, res) => {
    res.json(await prisma.department.findMany({ orderBy: { name: 'asc' } }));
});

app.post('/api/departments', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: 'Department name is required' });
        }
        const trimmedName = name.trim();
        const existing = await prisma.department.findFirst({
            where: { name: { equals: trimmedName, mode: 'insensitive' } }
        });
        if (existing) {
            return res.status(409).json({ error: 'A department with this name already exists' });
        }
        const dept = await prisma.department.create({ data: { name: trimmedName } });
        res.status(201).json(dept);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create department' });
    }
});

app.put('/api/departments/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: 'Department name is required' });
        }
        const trimmedName = name.trim();
        const existing = await prisma.department.findFirst({
            where: { name: { equals: trimmedName, mode: 'insensitive' }, NOT: { id: Number(id) } }
        });
        if (existing) {
            return res.status(409).json({ error: 'Another department with this name already exists' });
        }
        const dept = await prisma.department.update({ where: { id: Number(id) }, data: { name: trimmedName } });
        res.json(dept);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update department' });
    }
});

app.delete('/api/departments/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        // Check for users in this department
        const usersInDept = await prisma.user.count({ where: { departmentId: Number(id) } });
        if (usersInDept > 0) {
            return res.status(400).json({ error: 'Cannot delete department as it has users assigned to it.' });
        }
        await prisma.department.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete department' });
    }
});

// --- Branches Routes ---

app.get('/api/branches', authenticateToken, async (req, res) => {
    res.json(await prisma.branch.findMany({ orderBy: { name: 'asc' } }));
});

app.post('/api/branches', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, location } = req.body;
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: 'Branch name is required' });
        }
        const trimmedName = name.trim();
        const existing = await prisma.branch.findFirst({
            where: { name: { equals: trimmedName, mode: 'insensitive' } }
        });
        if (existing) {
            return res.status(409).json({ error: 'A branch with this name already exists' });
        }
        const branch = await prisma.branch.create({ data: { name: trimmedName, location: location ? location.trim() : null } });
        res.status(201).json(branch);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create branch' });
    }
});

app.put('/api/branches/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, location } = req.body;
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: 'Branch name is required' });
        }
        const trimmedName = name.trim();
        const existing = await prisma.branch.findFirst({
            where: { name: { equals: trimmedName, mode: 'insensitive' }, NOT: { id: Number(id) } }
        });
        if (existing) {
            return res.status(409).json({ error: 'Another branch with this name already exists' });
        }
        const branch = await prisma.branch.update({ where: { id: Number(id) }, data: { name: trimmedName, location: location ? location.trim() : null } });
        res.json(branch);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update branch' });
    }
});

app.delete('/api/branches/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const usersInBranch = await prisma.user.count({ where: { branchId: Number(id) } });
        if (usersInBranch > 0) {
            return res.status(400).json({ error: 'Cannot delete branch as it has users assigned to it.' });
        }
        await prisma.branch.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete branch' });
    }
});

// --- Purchases Routes ---

app.get('/api/purchases', authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { role } = req.user;
        if (role !== 'Admin' && role !== 'Manager') {
            return res.status(403).json({ error: 'Access denied. Purchase and financial records are restricted to Admins and Managers.' });
        }
        const purchases = await prisma.purchaseRecord.findMany({
            include: { assets: true },
            orderBy: { purchaseDate: 'desc' }
        });
        res.json(purchases);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch purchases' });
    }
});

app.post('/api/purchases', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const validation = purchaseSchema.safeParse(req.body);
        if (!validation.success) return res.status(400).json({ error: validation.error.format() });

        const purchase = await prisma.purchaseRecord.create({ data: validation.data });
        res.status(201).json(purchase);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create purchase' });
    }
});

app.put('/api/purchases/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const validation = purchaseSchema.safeParse(req.body);
        if (!validation.success) return res.status(400).json({ error: validation.error.format() });

        const purchase = await prisma.purchaseRecord.update({ 
            where: { id: Number(id) }, 
            data: validation.data 
        });
        res.json(purchase);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update purchase' });
    }
});

app.delete('/api/purchases/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.purchaseRecord.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete purchase' });
    }
});

// --- Asset History ---
app.get('/api/history', authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { role, id } = req.user;
        let history;

        const userSelect = { select: { id: true, name: true, email: true, role: true } };

        if (role === 'Admin') {
            history = await prisma.assetHistory.findMany({
                include: { user: userSelect, asset: { select: { id: true, assetId: true, name: true, category: true } } },
                orderBy: { timestamp: 'desc' },
                take: 200
            });
        } else if (role === 'Manager') {
            const user = await prisma.user.findUnique({ where: { id } });
            history = await prisma.assetHistory.findMany({
                where: {
                    OR: [
                        { userId: id },
                        { asset: { userId: id } },
                        { asset: { user: { managerId: id } } },
                        { asset: { user: { departmentId: user?.departmentId || -1 } } }
                    ]
                },
                include: { user: userSelect, asset: { select: { id: true, assetId: true, name: true, category: true } } },
                orderBy: { timestamp: 'desc' },
                take: 100
            });
        } else {
            history = await prisma.assetHistory.findMany({
                where: {
                    OR: [
                        { userId: id },
                        { asset: { userId: id } }
                    ]
                },
                include: { user: userSelect, asset: { select: { id: true, assetId: true, name: true, category: true } } },
                orderBy: { timestamp: 'desc' },
                take: 50
            });
        }

        res.json(history);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

app.post('/api/history', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // @ts-ignore
        const { id: userId } = req.user;
        const { assetId, event, details } = req.body;
        const entry = await prisma.assetHistory.create({
            data: { assetId: Number(assetId), userId, event, details }
        });
        res.status(201).json(entry);
    } catch (error) {
        res.status(500).json({ error: 'Failed to log history' });
    }
});

// --- Licenses Routes ---
app.get('/api/licenses', authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { role } = req.user;
        const licenses = await prisma.license.findMany({ 
            include: { 
                assignments: { 
                    include: { 
                        user: { select: { id: true, name: true, email: true } }, 
                        asset: { select: { id: true, assetId: true, name: true } } 
                    } 
                } 
            } 
        });

        // Security: Non-admin users cannot see raw product license keys
        const sanitized = licenses.map(l => {
            if (role !== 'Admin') {
                const { key, ...rest } = l;
                return { ...rest, key: null };
            }
            return l;
        });

        res.json(sanitized);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch licenses' });
    }
});

app.post('/api/licenses', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const validation = licenseSchema.safeParse(req.body);
        if (!validation.success) return res.status(400).json({ error: validation.error.format() });

        const license = await prisma.license.create({ data: validation.data });
        res.json(license);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create license' });
    }
});

app.put('/api/licenses/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const validation = licenseSchema.safeParse(req.body);
        if (!validation.success) return res.status(400).json({ error: validation.error.format() });

        const license = await prisma.license.update({ 
            where: { id: Number(id) }, 
            data: validation.data 
        });
        res.json(license);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update license' });
    }
});

app.delete('/api/licenses/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.license.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete license' });
    }
});

// --- License Assignments ---
app.post('/api/license-assignments', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { licenseId, userId, assetId } = req.body;
        if (!licenseId) return res.status(400).json({ error: 'License ID is required' });

        const license = await prisma.license.findUnique({
            where: { id: Number(licenseId) },
            include: { assignments: true }
        });

        if (!license) return res.status(404).json({ error: 'License not found' });

        // Enforce seat limit
        if (license.assignments.length >= license.seats) {
            return res.status(400).json({ error: `Seat limit reached. All ${license.seats} seat(s) for "${license.name}" are assigned.` });
        }

        // Duplicate assignment prevention
        if (userId && license.assignments.some(a => a.userId === Number(userId))) {
            return res.status(400).json({ error: 'This user is already assigned to this license.' });
        }
        if (assetId && license.assignments.some(a => a.assetId === Number(assetId))) {
            return res.status(400).json({ error: 'This asset is already assigned to this license.' });
        }

        const assignment = await prisma.licenseAssignment.create({ 
            data: { 
                licenseId: Number(licenseId), 
                userId: userId ? Number(userId) : null, 
                assetId: assetId ? Number(assetId) : null 
            },
            include: {
                user: { select: { id: true, name: true, email: true } },
                asset: { select: { id: true, assetId: true, name: true } }
            }
        });
        res.status(201).json(assignment);
    } catch (error) {
        res.status(500).json({ error: 'Failed to assign license' });
    }
});

app.delete('/api/license-assignments/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.licenseAssignment.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to remove license assignment' });
    }
});

// --- Asset Requests ---
app.get('/api/requests', authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { role, id } = req.user;
        let requests;

        if (role === 'Admin') {
            requests = await prisma.assetRequest.findMany({ include: { user: true, manager: true }, orderBy: { createdAt: 'desc' } });
        } else if (role === 'Manager') {
            requests = await prisma.assetRequest.findMany({
                where: { OR: [{ managerId: id }, { userId: id }] },
                include: { user: true, manager: true },
                orderBy: { createdAt: 'desc' }
            });
        } else {
            requests = await prisma.assetRequest.findMany({
                where: { userId: id },
                include: { user: true, manager: true },
                orderBy: { createdAt: 'desc' }
            });
        }
        res.json(requests);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch asset requests' });
    }
});

app.post('/api/requests', authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { id } = req.user;
        const user = await prisma.user.findUnique({ where: { id } });
        const { requestType, category, description } = req.body;
        
        const request = await prisma.assetRequest.create({
            data: { 
                userId: id, 
                managerId: user?.managerId, 
                requestType, 
                category, 
                description, 
                status: user?.managerId ? 'Pending Manager' : 'Pending Admin' 
            }
        });
        res.status(201).json(request);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create asset request' });
    }
});

app.put('/api/requests/:id/status', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        // @ts-ignore
        const { role, id: requestingUserId } = req.user;

        const existingRequest = await prisma.assetRequest.findUnique({ where: { id: Number(id) } });
        if (!existingRequest) return res.status(404).json({ error: 'Request not found.' });

        if ((status === 'Pending Admin' || status === 'Rejected by Manager') && role !== 'Manager' && role !== 'Admin') {
            return res.status(403).json({ error: 'Not authorized.' });
        }
        
        if (role === 'Manager' && existingRequest.managerId !== requestingUserId) {
            return res.status(403).json({ error: 'Not authorized to manage this request.' });
        }

        if ((status === 'Approved' || status === 'Rejected by Admin') && role !== 'Admin') {
            return res.status(403).json({ error: 'Only admins can give final approval.' });
        }

        const request = await prisma.assetRequest.update({ where: { id: Number(id) }, data: { status } });
        res.json(request);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update asset request status' });
    }
});


// --- Email Diagnostics Endpoint ---
app.get('/api/test-email', async (req, res) => {
    try {
        const targetEmail = (req.query.to as string) || 'aravinth@avanamedical.com';
        
        const envStatus = {
            AZURE_TENANT_ID: !!process.env.AZURE_TENANT_ID,
            AZURE_CLIENT_ID: !!process.env.AZURE_CLIENT_ID,
            AZURE_CLIENT_CERTIFICATE_PRIVATE_KEY: !!process.env.AZURE_CLIENT_CERTIFICATE_PRIVATE_KEY,
            AZURE_CLIENT_CERTIFICATE: !!process.env.AZURE_CLIENT_CERTIFICATE,
            AZURE_CLIENT_CERTIFICATE_THUMBPRINT: !!process.env.AZURE_CLIENT_CERTIFICATE_THUMBPRINT,
            AZURE_CLIENT_SECRET: !!process.env.AZURE_CLIENT_SECRET,
            SMTP_USER: !!process.env.SMTP_USER,
            SMTP_PASS: !!process.env.SMTP_PASS,
            SMTP_FROM: process.env.SMTP_FROM || 'itsupport@avanamedical.com',
        };

        const authResult = await getGraphAppToken();
        let tokenClaims: any = null;
        if (authResult.token) {
            try {
                const parts = authResult.token.split('.');
                if (parts.length === 3) {
                    tokenClaims = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
                }
            } catch (e) {}
        }

        const result = await sendTicketEmail({
            toEmail: targetEmail,
            toName: 'Admin',
            ticketId: 9999,
            ticketSubject: 'Test Email from Avana IT Management',
            senderName: 'Avana IT System',
            messageBody: 'This is a diagnostic test email to verify your email dispatcher configuration.',
            category: 'Diagnostic',
            priority: 'Medium',
            status: 'Test',
            isReply: false
        });

        res.json({
            status: result.success ? 'SUCCESS' : 'FAILED',
            methodUsed: result.method,
            errorDetails: result.error || null,
            tokenPermissions: {
                roles: tokenClaims?.roles || [],
                appId: tokenClaims?.appid || null,
                tenantId: tokenClaims?.tid || null,
                hasMailSendPermission: Array.isArray(tokenClaims?.roles) && tokenClaims.roles.includes('Mail.Send')
            },
            environmentStatus: envStatus,
            targetEmail
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message || err });
    }
});

app.get('/api/email-logs', async (req, res) => {
    res.json({
        totalDispatched: emailHistory.length,
        logs: emailHistory
    });
});

// --- Support Tickets ---

app.get('/api/tickets', authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { role, id } = req.user;
        let tickets;

        if (role === 'Admin') {
            tickets = await prisma.supportTicket.findMany({ 
                include: { user: { select: { id: true, name: true, email: true } } }, 
                orderBy: { createdAt: 'desc' } 
            });
        } else {
            tickets = await prisma.supportTicket.findMany({
                where: { userId: id },
                include: { user: { select: { id: true, name: true, email: true } } },
                orderBy: { createdAt: 'desc' }
            });
        }
        res.json(tickets);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch tickets' });
    }
});

app.post('/api/tickets', authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { id } = req.user;
        const { subject, category, priority, description, assetId, attachments } = req.body;
        
        if (!subject || !category || !description) {
            return res.status(400).json({ error: 'Subject, category, and description are required' });
        }

        const attachmentsStr = attachments ? (typeof attachments === 'string' ? attachments : JSON.stringify(attachments)) : null;

        const ticket = await prisma.supportTicket.create({
            data: {
                userId: id,
                subject,
                category,
                priority: priority || 'Medium',
                description,
                assetId: assetId ? Number(assetId) : null,
                attachments: attachmentsStr
            },
            include: { user: { select: { id: true, name: true, email: true } }, asset: true }
        });

        // Respond immediately — don't block the client on email sending
        res.status(201).json(ticket);

        // Fire email notifications in background — errors here NEVER affect the response
        (async () => {
            try {
                const admins = await prisma.user.findMany({ where: { role: 'Admin', status: 'Active' }, select: { name: true, email: true } });
                const assetName = ticket.asset ? `${(ticket.asset as any).name} (${(ticket.asset as any).assetId})` : undefined;
                for (const admin of admins) {
                    await sendTicketEmail({
                        toEmail: admin.email, toName: admin.name,
                        ticketId: ticket.id, ticketSubject: ticket.subject,
                        senderName: ticket.user?.name || 'Employee',
                        senderEmail: ticket.user?.email,
                        messageBody: ticket.description,
                        category: ticket.category, priority: ticket.priority,
                        status: ticket.status, assetName,
                        isReply: false,
                    });
                }
            } catch (e: any) {
                console.error('[Email] Background ticket notification failed:', e.message || e);
            }
        })();
    } catch (error) {
        console.error('Failed to create ticket:', error);
        res.status(500).json({ error: 'Failed to create ticket' });
    }
});

app.put('/api/tickets/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        // @ts-ignore
        const { role } = req.user;
        
        if (role !== 'Admin') return res.status(403).json({ error: 'Only admins can update tickets' });

        const { status, priority, resolvedAt } = req.body;
        const ticket = await prisma.supportTicket.update({
            where: { id: Number(id) },
            data: { 
                status, 
                priority,
                resolvedAt: status === 'Resolved' ? new Date() : (resolvedAt ? new Date(resolvedAt) : null)
            },
            include: { user: { select: { id: true, name: true, email: true } }, asset: true }
        });

        // Respond immediately
        res.json(ticket);

        // Fire email in background — never blocks or crashes the response
        if (status && ticket.user?.email) {
            (async () => {
                try {
                    await sendTicketEmail({
                        toEmail: ticket.user!.email,
                        toName: ticket.user!.name,
                        ticketId: ticket.id,
                        ticketSubject: ticket.subject,
                        senderName: 'Avana IT Support',
                        senderEmail: process.env.SMTP_FROM || process.env.SMTP_USER,
                        messageBody: `The status of your support ticket #${ticket.id} has been updated to "${status}".`,
                        status: ticket.status,
                        priority: ticket.priority,
                        isReply: true,
                    });
                } catch (e: any) {
                    console.error('[Email] Background status-change notification failed:', e.message || e);
                }
            })();
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to update ticket' });
    }
});

app.get('/api/tickets/:id/comments', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        // @ts-ignore
        const { id: userId, role } = req.user;

        const ticket = await prisma.supportTicket.findUnique({ where: { id: Number(id) } });
        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

        if (role !== 'Admin' && role !== 'Manager' && ticket.userId !== userId) {
            return res.status(403).json({ error: 'Access denied to this ticket discussion' });
        }

        const comments = await prisma.ticketComment.findMany({
            where: { ticketId: Number(id) },
            include: {
                user: { select: { id: true, name: true, role: true, avatar: true } }
            },
            orderBy: { createdAt: 'asc' }
        });
        res.json(comments);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch ticket comments' });
    }
});

app.post('/api/tickets/:id/comments', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        // @ts-ignore
        const { id: userId, role } = req.user;
        const { message, attachments, source, emailMessageId } = req.body;

        if (!message || typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({ error: 'Comment message is required' });
        }

        const ticket = await prisma.supportTicket.findUnique({ where: { id: Number(id) } });
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        if (role !== 'Admin' && role !== 'Manager' && ticket.userId !== userId) {
            return res.status(403).json({ error: 'Access denied to post on this ticket' });
        }

        const attachmentsStr = attachments ? (typeof attachments === 'string' ? attachments : JSON.stringify(attachments)) : null;

        const comment = await prisma.ticketComment.create({
            data: {
                ticketId: Number(id),
                userId,
                message: message.trim().slice(0, 5000),
                attachments: attachmentsStr,
                source: source || 'Portal',
                emailMessageId: emailMessageId || null
            },
            include: {
                user: { select: { id: true, name: true, role: true, avatar: true } }
            }
        });

        await prisma.supportTicket.update({
            where: { id: Number(id) },
            data: { updatedAt: new Date() }
        });

        // Respond immediately — client doesn't wait for email
        res.json(comment);

        // Fire email in background — isolated from the HTTP request lifecycle
        const ticketIdNum = Number(id);
        const msgBody = message.trim();
        (async () => {
            try {
                const fullTicket = await prisma.supportTicket.findUnique({
                    where: { id: ticketIdNum },
                    include: { user: { select: { id: true, name: true, email: true } } }
                });
                if (!fullTicket) return;

                const commenter = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { id: true, name: true, email: true, role: true }
                });

                const commenterRole = (commenter?.role || role || '').toLowerCase();
                const isAdminOrManager = commenterRole === 'admin' || commenterRole === 'manager';
                const senderName = commenter?.name || 'Avana Support';
                const senderEmail = commenter?.email;

                console.log(`[Comment Email] User ${userId} (${commenterRole}) commented on ticket #${ticketIdNum}`);

                if (isAdminOrManager) {
                    const recipientEmail = fullTicket.user?.email;
                    const recipientName = fullTicket.user?.name || 'Ticket Requester';
                    if (recipientEmail) {
                        console.log(`[Comment Email] Admin replied. Notifying ticket owner: ${recipientEmail}`);
                        await sendTicketEmail({
                            toEmail: recipientEmail, toName: recipientName,
                            ticketId: fullTicket.id, ticketSubject: fullTicket.subject || 'Support Ticket',
                            senderName, senderEmail, messageBody: msgBody,
                            status: fullTicket.status, priority: fullTicket.priority, isReply: true,
                        });
                    }
                } else {
                    const admins = await prisma.user.findMany({
                        where: { role: { equals: 'Admin', mode: 'insensitive' }, status: 'Active' },
                        select: { name: true, email: true }
                    });
                    console.log(`[Comment Email] User replied. Notifying ${admins.length} admins.`);
                    for (const admin of admins) {
                        await sendTicketEmail({
                            toEmail: admin.email, toName: admin.name,
                            ticketId: fullTicket.id, ticketSubject: fullTicket.subject || 'Support Ticket',
                            senderName, senderEmail, messageBody: msgBody,
                            status: fullTicket.status, priority: fullTicket.priority, isReply: true,
                        });
                    }
                }
            } catch (e: any) {
                console.error('[Comment Email] Background notification failed:', e.message || e);
            }
        })();
    } catch (error) {
        console.error('Failed to post ticket comment:', error);
        res.status(500).json({ error: 'Failed to post comment' });
    }
});

// --- Support Contacts Endpoint ---
app.get('/api/support-contacts', authenticateToken, async (req, res) => {
    try {
        const admins = await prisma.user.findMany({
            where: { role: 'Admin', status: 'Active' },
            select: { id: true, name: true, email: true }
        });
        res.json(admins);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch support contacts' });
    }
});

// --- Sync Email Reply from Outlook/Graph ---
app.post('/api/tickets/:id/sync-email-reply', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { message, emailMessageId, senderEmail, attachments, receivedAt } = req.body;

        if (!emailMessageId || !message) {
            return res.status(400).json({ error: 'Message and emailMessageId are required' });
        }

        // Idempotency: check if already ingested
        const existing = await prisma.ticketComment.findUnique({
            where: { emailMessageId }
        });
        if (existing) {
            return res.json({ status: 'already_synced', comment: existing });
        }

        const ticket = await prisma.supportTicket.findUnique({ where: { id: Number(id) } });
        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

        // Match sender by email or fallback to current user
        let commentUser = senderEmail ? await prisma.user.findUnique({ where: { email: senderEmail.toLowerCase() } }) : null;
        if (!commentUser) {
            // @ts-ignore
            commentUser = await prisma.user.findUnique({ where: { id: req.user.id } });
        }

        if (!commentUser) {
            return res.status(400).json({ error: 'Unable to identify comment author' });
        }

        const attachmentsStr = attachments ? (typeof attachments === 'string' ? attachments : JSON.stringify(attachments)) : null;

        const comment = await prisma.ticketComment.create({
            data: {
                ticketId: Number(id),
                userId: commentUser.id,
                message: message.trim().slice(0, 5000),
                attachments: attachmentsStr,
                source: 'Email',
                emailMessageId,
                createdAt: receivedAt ? new Date(receivedAt) : new Date()
            },
            include: {
                user: { select: { id: true, name: true, role: true, avatar: true } }
            }
        });

        await prisma.supportTicket.update({
            where: { id: Number(id) },
            data: { updatedAt: new Date() }
        });

        res.status(201).json({ status: 'synced', comment });
    } catch (error) {
        console.error('Failed to sync email reply:', error);
        res.status(500).json({ error: 'Failed to sync email reply' });
    }
});

// --- Knowledge Base ---

app.get('/api/kb', authenticateToken, async (req, res) => {
    try {
        const articles = await prisma.knowledgeBase.findMany({
            include: { author: { select: { name: true } } },
            orderBy: { updatedAt: 'desc' }
        });
        res.json(articles);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch KB articles' });
    }
});

app.post('/api/kb', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // @ts-ignore
        const { id } = req.user;
        const { title, category, content } = req.body;
        
        const article = await prisma.knowledgeBase.create({
            data: {
                title,
                category,
                content,
                authorId: id
            }
        });
        res.json(article);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create KB article' });
    }
});

app.put('/api/kb/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, category, content } = req.body;
        
        const article = await prisma.knowledgeBase.update({
            where: { id: Number(id) },
            data: { title, category, content }
        });
        res.json(article);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update KB article' });
    }
});

app.delete('/api/kb/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.knowledgeBase.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete KB article' });
    }
});

// --- Self Audits ---

app.get('/api/self-audits', authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { role, id } = req.user;
        let audits;

        if (role === 'Admin') {
            audits = await prisma.selfAudit.findMany({
                include: { user: { select: { id: true, name: true, email: true } }, asset: true },
                orderBy: { auditDate: 'desc' }
            });
        } else {
            audits = await prisma.selfAudit.findMany({
                where: { userId: id },
                include: { user: { select: { id: true, name: true, email: true } }, asset: true },
                orderBy: { auditDate: 'desc' }
            });
        }
        res.json(audits);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch self audits' });
    }
});

app.post('/api/self-audits', authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { id: userId, role } = req.user;
        const { assetId, scannedAssetId, imageUrl, remarks } = req.body;

        const asset = await prisma.asset.findUnique({ where: { id: Number(assetId) } });
        if (!asset) return res.status(404).json({ error: 'Asset not found.' });

        // Security check: Only the assigned user (or Admin) can submit a self-audit for this asset
        if (role !== 'Admin' && asset.userId !== userId) {
            return res.status(403).json({ error: 'Access denied. You can only submit audits for assets assigned to you.' });
        }

        const audit = await prisma.selfAudit.create({
            data: {
                assetId: Number(assetId),
                userId: Number(userId),
                scannedAssetId,
                imageUrl,
                remarks,
                status: 'Pending Review'
            },
            include: { user: { select: { id: true, name: true, email: true } }, asset: true }
        });
        res.status(201).json(audit);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create self audit' });
    }
});

app.put('/api/self-audits/:id/status', authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { role } = req.user;
        if (role !== 'Admin' && role !== 'Manager') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { id } = req.params;
        const { status, remarks } = req.body;

        if (!['Approved', 'Rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const audit = await prisma.selfAudit.update({
            where: { id: Number(id) },
            data: { 
                status,
                ...(remarks && { remarks })
            },
            include: { user: { select: { id: true, name: true, email: true } }, asset: true }
        });
        res.json(audit);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update self audit status' });
    }
});

// --- Upload Route for Ticket Attachments (memory-based, no disk dependency) ---
const allowedMimes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf', 'text/plain', 'text/csv', 'application/zip',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('File type not supported. Allowed: Images, PDF, TXT, CSV, DOC, DOCX, XLS, XLSX, ZIP.'));
        }
    }
});

app.post('/api/upload', authenticateToken, (req, res) => {
    upload.single('file')(req, res, (err: any) => {
        if (err) {
            console.error('Upload error:', err.message);
            return res.status(400).json({ error: err.message || 'File upload failed' });
        }

        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        // Store as base64 data URL — survives server restarts, no disk required
        const base64 = file.buffer.toString('base64');
        const dataUrl = `data:${file.mimetype};base64,${base64}`;

        res.json({
            url: dataUrl,
            name: file.originalname,
            size: file.size,
            type: file.mimetype
        });
    });
});

// --- Microsoft Graph Inbound Email Webhook ---
app.post('/api/webhooks/graph', async (req, res) => {
    try {
        // 1. Microsoft Graph Validation Handshake
        if (req.query.validationToken) {
            res.set('Content-Type', 'text/plain');
            return res.status(200).send(req.query.validationToken as string);
        }

        // 2. Process Change Notifications
        const { value } = req.body;
        if (Array.isArray(value)) {
            for (const notification of value) {
                console.log('Received MS Graph Notification for resource:', notification.resource);
                // Background async processor will ingest message
            }
        }

        res.status(202).send('Accepted');
    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).send('Webhook processing error');
    }
});



app.listen(port, () => {
    console.log(`Server running on port ${port} with security measures enabled.`);
});
 
