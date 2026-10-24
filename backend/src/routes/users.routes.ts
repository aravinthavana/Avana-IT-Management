import { licenseProvider, manualLicenseFilter, nonZohoLicenseFilter } from '../utils/licensePolicy';
import { Router } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../db';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { userSchema } from '../schemas';
import { updateM365User, revokeM365Licenses } from '../services/m365.service';
import { SAFE_USER_SELECT } from '../utils/safeUser';

const router = Router();

router.get('/api/users/me', authenticateToken, async (req, res) => {
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
        if (user.isPortalUser === false) {
            return res.status(403).json({ error: 'This account is designated as a non-portal record and cannot sign in.' });
        }
        const effectiveIsAdmin = Boolean(user.isAdmin || user.role === 'Admin');
        const effectiveOrgRole = user.orgRole || (user.role === 'Manager' ? 'Manager' : 'Employee');
        const effectiveRole = effectiveIsAdmin ? 'Admin' : (effectiveOrgRole === 'Manager' ? 'Manager' : 'User');

        res.json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: effectiveRole,
                orgRole: effectiveOrgRole,
                isAdmin: effectiveIsAdmin,
                isPortalUser: user.isPortalUser ?? true,
                status: user.status,
                avatar: user.avatar,
                mobile: user.mobile,
                jobTitle: user.jobTitle,
                company: user.company,
                employeeId: user.employeeId
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
});

// --- Handover Endpoints ---

// List all handovers (Admin sees all, Manager sees direct reports, User sees own)
router.get('/api/handovers', authenticateToken, async (req, res) => {
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
router.get('/api/handovers/pending', authenticateToken, async (req, res) => {
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
router.post('/api/handovers/:id/sign', authenticateToken, async (req, res) => {
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

router.get('/api/users', authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { role, id } = req.user;
        let users;

        if (role === 'Admin') {
            users = await prisma.user.findMany({
                include: { department: true, branch: true, manager: { select: SAFE_USER_SELECT }, licenseAssignments: { include: { license: true } } },
                orderBy: { name: 'asc' }
            });
        } else if (role === 'Manager') {
            // Managers see themselves and their direct reports
            users = await prisma.user.findMany({
                where: { OR: [{ id }, { managerId: id }] },
                include: { department: true, branch: true, manager: { select: SAFE_USER_SELECT }, licenseAssignments: { include: { license: true } } },
                orderBy: { name: 'asc' }
            });
        } else {
            // Regular users only see themselves
            users = await prisma.user.findMany({
                where: { id },
                include: { department: true, branch: true, manager: { select: SAFE_USER_SELECT }, licenseAssignments: { include: { license: true } } }
            });
        }

        // Never expose passwords
        const sanitized = users.map(({ password, ...u }) => u);
        res.json(sanitized);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

router.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const validation = userSchema.safeParse(req.body);
        if (!validation.success) {
            const firstErr = validation.error.issues[0]?.message || 'Invalid user data';
            return res.status(400).json({ error: firstErr });
        }
        
        const { 
            name, email, password, role, status, departmentId, branchId, managerId, accountType, mobile, jobTitle, company, employeeId, laptopStatus,
            location, workAddress, city, state, postalCode, country,
            m365AccountCreated, m365LicenseAssigned, softwareInstalled, hardwareTested, credentialsHandedOver, dispatchDetails, onboardingStatus, onboardingStep,
            assetReturned, assetReturnCondition, assetReturnRemarks, assetReturnDocket, deviceWiped, dataBackedUp, m365LicenseRevoked, m365AccountDisabled, offboardingStatus
        } = validation.data;

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) return res.status(409).json({ error: 'A user with this email already exists' });

        if (password && password.trim().length > 0 && password.trim().length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
        }

        const hashedPassword = (password && password.trim().length >= 8) ? await bcrypt.hash(password.trim(), 10) : null;
        
        const isAdminVal = req.body.isAdmin !== undefined ? Boolean(req.body.isAdmin) : (role === 'Admin');
        const orgRoleVal = req.body.orgRole !== undefined ? req.body.orgRole : (role === 'Manager' ? 'Manager' : 'Employee');
        const isPortalUserVal = req.body.isPortalUser !== undefined ? Boolean(req.body.isPortalUser) : true;
        const computedRole = isAdminVal ? 'Admin' : (orgRoleVal === 'Manager' ? 'Manager' : 'User');

        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: computedRole,
                orgRole: orgRoleVal,
                isAdmin: isAdminVal,
                isPortalUser: isPortalUserVal,
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
                location: location || null,
                workAddress: workAddress || null,
                city: city || null,
                state: state || null,
                postalCode: postalCode || null,
                country: country || null,
                m365AccountCreated: m365AccountCreated || false,
                m365LicenseAssigned: m365LicenseAssigned || false,
                softwareInstalled: softwareInstalled || false,
                hardwareTested: hardwareTested || false,
                credentialsHandedOver: credentialsHandedOver || false,
                dispatchDetails: dispatchDetails || null,
                onboardingStatus: onboardingStatus || 'Pending',
                onboardingStep: onboardingStep || 1,
                assetReturned: assetReturned || false,
                assetReturnCondition: assetReturnCondition || null,
                assetReturnRemarks: assetReturnRemarks || null,
                assetReturnDocket: assetReturnDocket || null,
                deviceWiped: deviceWiped || false,
                dataBackedUp: dataBackedUp || false,
                m365LicenseRevoked: m365LicenseRevoked || false,
                m365AccountDisabled: m365AccountDisabled || false,
                offboardingStatus: offboardingStatus || 'Pending',
            },
            include: { department: true, branch: true, manager: { select: SAFE_USER_SELECT } }
        });
        const { password: _, ...sanitized } = user;
        res.status(201).json(sanitized);
    } catch (error: any) {
        console.error('Failed to create user:', error);
        res.status(500).json({ error: error.message || 'Failed to create user' });
    }
});

router.put('/api/users/:id', authenticateToken, async (req, res) => {
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
        
        const { name, email, role, status, departmentId, branchId, managerId, password, avatar, mobile, jobTitle, company, employeeId, accountType, laptopStatus, location, workAddress, city, state, postalCode, country } = validation.data;

        const updateData: any = {};
        if (name) updateData.name = name;
        if (email && requestingUserRole === 'Admin') updateData.email = email;
        if (avatar !== undefined) updateData.avatar = avatar;
        if (mobile !== undefined) updateData.mobile = mobile;
        if (location !== undefined) updateData.location = location;
        if (workAddress !== undefined) updateData.workAddress = workAddress;
        if (city !== undefined) updateData.city = city;
        if (state !== undefined) updateData.state = state;
        if (postalCode !== undefined) updateData.postalCode = postalCode;
        if (country !== undefined) updateData.country = country;

        // Only IT admins may change employment and IT completion records.
        if (requestingUserRole === 'Admin') {
            if (jobTitle !== undefined) updateData.jobTitle = jobTitle;
            if (company !== undefined) updateData.company = company;
            if (employeeId !== undefined) updateData.employeeId = employeeId;
            if (accountType !== undefined) updateData.accountType = accountType;
            if (laptopStatus !== undefined) updateData.laptopStatus = laptopStatus;

            // IT Operations - Onboarding Checklist fields
            if (req.body.m365AccountCreated !== undefined) updateData.m365AccountCreated = Boolean(req.body.m365AccountCreated);
            if (req.body.m365LicenseAssigned !== undefined) updateData.m365LicenseAssigned = Boolean(req.body.m365LicenseAssigned);
            if (req.body.softwareInstalled !== undefined) updateData.softwareInstalled = Boolean(req.body.softwareInstalled);
            if (req.body.hardwareTested !== undefined) updateData.hardwareTested = Boolean(req.body.hardwareTested);
            if (req.body.credentialsHandedOver !== undefined) updateData.credentialsHandedOver = Boolean(req.body.credentialsHandedOver);
            if (req.body.dispatchDetails !== undefined) {
                updateData.dispatchDetails = req.body.dispatchDetails ? (typeof req.body.dispatchDetails === 'string' ? req.body.dispatchDetails : JSON.stringify(req.body.dispatchDetails)) : null;
            }
            if (req.body.onboardingStatus !== undefined) updateData.onboardingStatus = req.body.onboardingStatus;
            if (req.body.onboardingCompletedDate !== undefined) {
                updateData.onboardingCompletedDate = req.body.onboardingCompletedDate ? new Date(req.body.onboardingCompletedDate) : null;
            }
            if (req.body.onboardingStep !== undefined) updateData.onboardingStep = Number(req.body.onboardingStep) || 1;

            // IT Operations - Offboarding Checklist fields
            if (req.body.assetReturned !== undefined) updateData.assetReturned = Boolean(req.body.assetReturned);
            if (req.body.assetReturnCondition !== undefined) updateData.assetReturnCondition = req.body.assetReturnCondition;
            if (req.body.assetReturnRemarks !== undefined) updateData.assetReturnRemarks = req.body.assetReturnRemarks;
            if (req.body.assetReturnDocket !== undefined) {
                updateData.assetReturnDocket = req.body.assetReturnDocket ? (typeof req.body.assetReturnDocket === 'string' ? req.body.assetReturnDocket : JSON.stringify(req.body.assetReturnDocket)) : null;
            }
            if (req.body.deviceWiped !== undefined) updateData.deviceWiped = Boolean(req.body.deviceWiped);
            if (req.body.dataBackedUp !== undefined) updateData.dataBackedUp = Boolean(req.body.dataBackedUp);
            if (req.body.m365LicenseRevoked !== undefined) updateData.m365LicenseRevoked = Boolean(req.body.m365LicenseRevoked);
            if (req.body.m365AccountDisabled !== undefined) updateData.m365AccountDisabled = Boolean(req.body.m365AccountDisabled);
            if (req.body.offboardingStatus !== undefined) updateData.offboardingStatus = req.body.offboardingStatus;
            if (req.body.offboardingCompletedDate !== undefined) {
                updateData.offboardingCompletedDate = req.body.offboardingCompletedDate ? new Date(req.body.offboardingCompletedDate) : null;
            }
        }

        // Only admin can change role/status/depts
        if (requestingUserRole === 'Admin') {
            if (req.body.orgRole !== undefined) updateData.orgRole = req.body.orgRole;
            if (req.body.isAdmin !== undefined) updateData.isAdmin = Boolean(req.body.isAdmin);
            if (req.body.isPortalUser !== undefined) updateData.isPortalUser = Boolean(req.body.isPortalUser);

            const adminVal = req.body.isAdmin !== undefined ? Boolean(req.body.isAdmin) : undefined;
            const orgVal = req.body.orgRole !== undefined ? req.body.orgRole : undefined;
            if (adminVal !== undefined || orgVal !== undefined) {
                const targetBefore = await prisma.user.findUnique({ where: { id: Number(id) } });
                const finalAdmin = adminVal !== undefined ? adminVal : targetBefore?.isAdmin;
                const finalOrg = orgVal !== undefined ? orgVal : targetBefore?.orgRole;
                updateData.role = finalAdmin ? 'Admin' : (finalOrg === 'Manager' ? 'Manager' : 'User');
            } else if (req.body.role !== undefined) {
                updateData.role = role;
                if (role === 'Admin') updateData.isAdmin = true;
                else if (role === 'Manager') { updateData.isAdmin = false; updateData.orgRole = 'Manager'; }
                else if (role === 'User') { updateData.isAdmin = false; updateData.orgRole = 'Employee'; }
            }
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
            include: { department: true, branch: true, manager: { select: SAFE_USER_SELECT } }
        });

        // Outbound real-time push to Microsoft 365 / Entra ID
        const targetAd = user.azureAdId || (user.email.includes('@') ? user.email : null);
        if (targetAd && requestingUserRole === 'Admin') {
            updateM365User(targetAd, {
                displayName: user.name,
                jobTitle: user.jobTitle || undefined,
                department: user.department?.name || undefined,
                mobilePhone: user.mobile || undefined,
                officeLocation: user.location || user.branch?.name || undefined,
                city: user.city || undefined,
                state: user.state || undefined,
                country: user.country || undefined,
                postalCode: user.postalCode || undefined,
                accountEnabled: user.status === 'Active'
            }).catch((e: any) => console.warn('[M365 Auto-Push Warning]:', e.message));
        }

        const { password: _, ...sanitized } = user;
        res.json(sanitized);
    } catch (error: any) {
        console.error('Failed to update user:', error);
        res.status(500).json({ error: error.message || 'Failed to update user' });
    }
});

router.put('/api/users/:id/status', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reclaimAll } = req.body;
        // @ts-ignore
        const requestingUserId = req.user.id;

        if (Number(id) === requestingUserId) {
            return res.status(400).json({ error: 'You cannot change the status of your own account.' });
        }

        const user = await prisma.user.update({
            where: { id: Number(id) },
            data: { status },
        });

        // Push account enablement status to Microsoft 365
        const targetAdStatus = user.azureAdId || (user.email.includes('@') ? user.email : null);
        if (targetAdStatus) {
            updateM365User(targetAdStatus, {
                accountEnabled: status === 'Active'
            }).catch((e: any) => console.warn('[M365 Status Push Warning]:', e.message));
        }

        if (status === 'Inactive' && reclaimAll) {
            // Reclaim Assets
            const assignedAssets = await prisma.asset.findMany({
                where: {
                    OR: [
                        { assigneeType: { in: ['User', 'user'] }, assigneeId: Number(id) },
                        { userId: Number(id) }
                    ]
                }
            });
            for (const asset of assignedAssets) {
                await prisma.asset.update({
                    where: { id: asset.id },
                    data: { assigneeId: null, assigneeType: null, userId: null, status: 'Under Inspection', location: 'In Stock' }
                });
                await prisma.assetHistory.create({
                    data: {
                        assetId: asset.id,
                        userId: requestingUserId,
                        event: 'Unassigned',
                        details: 'Asset was automatically unassigned due to user deactivation.'
                    }
                });
            }

            // Reclaim Licenses
            await prisma.licenseAssignment.deleteMany({
                where: { userId: Number(id), license: manualLicenseFilter }
            });
        }

        const { password: _, ...sanitized } = user;
        const reclaimedCount = status === 'Inactive' && reclaimAll ? await prisma.asset.count({
            where: {
                OR: [
                    { assigneeType: { in: ['User', 'user'] }, assigneeId: Number(id) },
                    { userId: Number(id) }
                ]
            }
        }) : 0;
        res.json({ ...sanitized, _reclaimedAssetsCount: reclaimedCount });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update user status' });
    }
});

router.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
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

// GET /api/users/:id/asset-history - Historical log of assets assigned to and returned from this user
router.get('/api/users/:id/asset-history', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const targetUserId = Number(id);
        if (isNaN(targetUserId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        // @ts-ignore
        const { role, id: requestingUserId } = req.user;

        // Authorization check
        if (role !== 'Admin') {
            if (role === 'Manager') {
                const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
                const manager = await prisma.user.findUnique({ where: { id: requestingUserId } });
                const isAuthorized = targetUserId === requestingUserId ||
                    targetUser?.managerId === requestingUserId ||
                    (manager?.departmentId && targetUser?.departmentId === manager.departmentId);
                if (!isAuthorized) {
                    return res.status(403).json({ error: 'Unauthorized to view this user asset history' });
                }
            } else {
                if (targetUserId !== requestingUserId) {
                    return res.status(403).json({ error: 'Unauthorized to view this user asset history' });
                }
            }
        }

        const targetUser = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: { id: true, name: true, employeeId: true }
        });
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Find all assets currently or previously associated with this user
        const userHandovers = await prisma.handoverLog.findMany({
            where: { userId: targetUserId },
            select: { assetId: true }
        });

        const currentAssets = await prisma.asset.findMany({
            where: {
                OR: [
                    { userId: targetUserId },
                    { assigneeId: targetUserId, assigneeType: 'User' }
                ]
            },
            select: { id: true }
        });

        const associatedAssetIds = Array.from(new Set([
            ...userHandovers.map(h => h.assetId),
            ...currentAssets.map(a => a.id)
        ]));

        const userSelect = { select: { id: true, name: true, email: true, role: true } };
        const assetSelect = { select: { id: true, assetId: true, name: true, category: true, serialNumber: true } };

        const histories = await prisma.assetHistory.findMany({
            where: {
                OR: [
                    { details: { contains: targetUser.name, mode: 'insensitive' } },
                    ...(associatedAssetIds.length > 0 ? [{ assetId: { in: associatedAssetIds } }] : [])
                ]
            },
            include: {
                user: userSelect,
                asset: assetSelect
            },
            orderBy: { timestamp: 'desc' },
            take: 100
        });

        const handovers = await prisma.handoverLog.findMany({
            where: { userId: targetUserId },
            include: {
                asset: assetSelect
            },
            orderBy: { handoverDate: 'desc' }
        });

        res.json({
            user: targetUser,
            history: histories,
            handovers: handovers
        });
    } catch (error) {
        console.error('Failed to fetch user asset history:', error);
        res.status(500).json({ error: 'Failed to fetch user asset history' });
    }
});

// --- IT Operations Lifecycle: Onboarding & Offboarding ---

// POST /api/onboarding/complete - Finalize or update onboarding for an employee
router.post('/api/onboarding/complete', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const {
            userId,
            m365AccountCreated,
            assignLicenseId,
            assignLicenseIds,
            assignAssetId,
            assetCondition,
            softwareInstalled,
            hardwareTested,
            dispatchDetails,
            credentialsHandedOver,
            onboardingStatus = 'Completed',
            onboardingStep
        } = req.body;

        // @ts-ignore
        const requestingUserId = req.user.id;

        const targetUser = await prisma.user.findUnique({ where: { id: Number(userId) }, include: { branch: true } });
        if (!targetUser) return res.status(404).json({ error: 'User not found' });

        // 1. Synchronize License(s) if provided
        let licenseAssignedFlag = targetUser.m365LicenseAssigned;
        if (assignLicenseIds !== undefined || assignLicenseId !== undefined) {
            const requestedLicenseIds: number[] = Array.isArray(assignLicenseIds)
                ? assignLicenseIds.map(Number).filter(n => !isNaN(n) && n > 0)
                : (assignLicenseId && !isNaN(Number(assignLicenseId)) ? [Number(assignLicenseId)] : []);

            const requested = await prisma.license.findMany({ where: { id: { in: requestedLicenseIds } }, include: { assignments: true } });
            if (requested.length !== new Set(requestedLicenseIds).size || requested.some(l => licenseProvider(l) !== 'manual')) {
                return res.status(400).json({ error: 'Only manual software can be assigned during this step. Manage Microsoft 365 in Licenses & Subscriptions; Zoho is read-only.' });
            }
            await prisma.licenseAssignment.deleteMany({
                where: { userId: targetUser.id, license: manualLicenseFilter, licenseId: { notIn: requestedLicenseIds } }
            });
            for (const license of requested) {
                const assigned = license.assignments.some(a => a.userId === targetUser.id);
                if (!assigned && license.assignments.length < license.seats) {
                    await prisma.licenseAssignment.create({ data: { licenseId: license.id, userId: targetUser.id } });
                }
            }

            // Determine if user holds any Microsoft 365 or Exchange license
            const currentAssignments = await prisma.licenseAssignment.findMany({
                where: { userId: targetUser.id },
                include: { license: true }
            });
            licenseAssignedFlag = currentAssignments.some(a => 
                a.license.isM365
            );
        }

        // 2. Assign Asset if requested
        if (assignAssetId && !isNaN(Number(assignAssetId))) {
            const assetId = Number(assignAssetId);
            const asset = await prisma.asset.findUnique({ where: { id: assetId } });
            if (asset && asset.assigneeId !== targetUser.id) {
                await prisma.asset.update({
                    where: { id: assetId },
                    data: {
                        userId: targetUser.id,
                        assigneeId: targetUser.id,
                        assigneeType: 'User',
                        status: 'Pending Handover',
                        condition: assetCondition || asset.condition || 'Good',
                        location: targetUser.location || (targetUser.branch ? targetUser.branch.name : null) || 'Remote / Field'
                    }
                });

                await prisma.handoverLog.create({
                    data: {
                        assetId,
                        userId: targetUser.id,
                        status: 'Pending',
                        condition: assetCondition || 'Good'
                    }
                });

                await prisma.assetHistory.create({
                    data: {
                        assetId,
                        userId: requestingUserId,
                        event: 'Assigned',
                        condition: assetCondition || 'Good',
                        details: `Asset assigned during employee onboarding to ${targetUser.name} (${targetUser.email}). Handover condition: ${assetCondition || 'Good'}.`
                    }
                });
            }
        }

        // 3. Update User Onboarding Checklist
        const updatedUser = await prisma.user.update({
            where: { id: targetUser.id },
            data: {
                m365AccountCreated: m365AccountCreated !== undefined ? Boolean(m365AccountCreated) : targetUser.m365AccountCreated,
                m365LicenseAssigned: licenseAssignedFlag,
                softwareInstalled: softwareInstalled !== undefined ? Boolean(softwareInstalled) : targetUser.softwareInstalled,
                hardwareTested: hardwareTested !== undefined ? Boolean(hardwareTested) : targetUser.hardwareTested,
                credentialsHandedOver: credentialsHandedOver !== undefined ? Boolean(credentialsHandedOver) : targetUser.credentialsHandedOver,
                dispatchDetails: dispatchDetails ? (typeof dispatchDetails === 'string' ? dispatchDetails : JSON.stringify(dispatchDetails)) : targetUser.dispatchDetails,
                onboardingStatus,
                onboardingCompletedDate: onboardingStatus === 'Completed' ? new Date() : (onboardingStatus === 'In Progress' ? null : targetUser.onboardingCompletedDate),
                onboardingStep: onboardingStatus === 'Completed' ? 8 : (onboardingStep ? Number(onboardingStep) : (targetUser.onboardingStep || 1))
            },
            include: { department: true, branch: true, manager: { select: SAFE_USER_SELECT }, licenseAssignments: { include: { license: true } } }
        });

        const { password: _, ...sanitized } = updatedUser;
        res.json(sanitized);
    } catch (error: any) {
        console.error('Failed to complete onboarding:', error);
        res.status(500).json({ error: error.message || 'Failed to complete onboarding' });
    }
});

// POST /api/offboarding/process - Execute end-to-end offboarding for an employee
router.post('/api/offboarding/process', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const {
            userId,
            assetReturn,
            deviceWiped = false,
            wipeDetails,
            dataBackedUp = false,
            revokeAllLicenses = false,
            disableM365 = false,
            deactivateUser = false,
            offboardingRemarks
        } = req.body;

        // @ts-ignore
        const requestingUserId = req.user.id;

        const targetUser = await prisma.user.findUnique({ where: { id: Number(userId) } });
        if (!targetUser) return res.status(404).json({ error: 'User not found' });

        // Validate ownership before performing external actions. Never substitute another asset.
        const ownership = { OR: [
            { assigneeId: targetUser.id, assigneeType: { in: ['User', 'user'] } },
            { userId: targetUser.id }
        ] };
        if (assetReturn?.assetId) {
            const owned = await prisma.asset.findFirst({ where: { id: Number(assetReturn.assetId), ...ownership } });
            if (!owned) return res.status(400).json({ error: 'The selected asset is not assigned to this employee. Refresh and retry.' });
        }
        const operationErrors: string[] = [];
        const targetAd = targetUser.azureAdId || targetUser.email;
        let m365RevokeSuccess = false;
        let m365DisableSuccess = false;
        if (revokeAllLicenses) {
            const result = await revokeM365Licenses(targetAd);
            m365RevokeSuccess = result.success;
            if (!result.success) operationErrors.push('License revocation failed: ' + (result.error || 'Unknown error'));
        }
        if (disableM365) {
            const result = await updateM365User(targetAd, { accountEnabled: false });
            m365DisableSuccess = result.success;
            if (!result.success) operationErrors.push('Account disabling failed: ' + (result.error || 'Unknown error'));
        }
        // Persist successful actions and asset history atomically; cloud calls remain outside the transaction.
        const updatedUser = await prisma.$transaction(async tx => {
            if (revokeAllLicenses && m365RevokeSuccess) {
                await tx.licenseAssignment.deleteMany({ where: { userId: targetUser.id, license: nonZohoLicenseFilter } });
            }
            // 1. Process Asset Return if provided

            if (assetReturn && assetReturn.assetId) {
                let assetId = Number(assetReturn.assetId);
                const destinationStatus = assetReturn.destinationStatus || 'Under Inspection';
                const condition = assetReturn.condition || 'Good';

                // Security & Integrity check: Verify that the asset actually belongs to targetUser
                let assetToReturn = await tx.asset.findFirst({
                    where: {
                        id: assetId,
                        ...ownership
                    }
                });

                if (assetToReturn) {
                    await tx.asset.update({
                        where: { id: assetId },
                        data: {
                            userId: null,
                            assigneeId: null,
                            assigneeType: null,
                            status: destinationStatus,
                            condition: condition || 'Good',
                            location: 'In Stock',
                            remarks: assetReturn.remarks || null
                        }
                    });

                    const modeText = assetReturn.returnMode === 'Courier'
                        ? `Courier Return (${assetReturn.courierName || 'Carrier'} - Docket: ${assetReturn.docketNumber || 'N/A'})`
                        : 'In-Person Handover';

                    await tx.assetHistory.create({
                        data: {
                            assetId,
                            userId: requestingUserId,
                            event: 'Unassigned',
                            condition,
                            details: `Asset returned during offboarding of ${targetUser.name}. Mode: ${modeText}. Return condition: ${condition}. Remarks: ${assetReturn.remarks || 'None'}. Routed to status "${destinationStatus}".`
                        }
                    });

                    if (deviceWiped) {
                        await tx.assetHistory.create({
                            data: {
                                assetId,
                                userId: requestingUserId,
                                event: 'Wiped',
                                details: `Device wiped during offboarding. Method / Remarks: ${wipeDetails || 'Standard Factory Reset'}.`
                            }
                        });
                    }
                } else {
                    console.warn(`[Offboarding Info] Target user ${targetUser.name} has no hardware assets to unassign. Skipping asset return update.`);
                }
            }

            // 4. Update User Offboarding Flags & Status
            const remainingAssets = await tx.asset.count({ where: ownership });
            const verifiedAssetReturned = remainingAssets === 0;
            if (!verifiedAssetReturned) operationErrors.push('Employee still has assigned assets awaiting return.');
            const verifiedLicenseRevoked = revokeAllLicenses ? m365RevokeSuccess : targetUser.m365LicenseRevoked;
            const verifiedAccountDisabled = disableM365 ? m365DisableSuccess : targetUser.m365AccountDisabled;

            const returnDocketJson = (assetReturn && assetReturn.docketNumber)
                ? JSON.stringify({
                    mode: assetReturn.returnMode,
                    courier: assetReturn.courierName,
                    docketNo: assetReturn.docketNumber,
                    returnDate: assetReturn.returnDate || new Date().toISOString()
                })
                : null;

            const resultUser = await tx.user.update({
                where: { id: targetUser.id },
                data: {
                    assetReturned: verifiedAssetReturned,
                    assetReturnCondition: assetReturn?.condition || null,
                    assetReturnRemarks: assetReturn?.remarks || offboardingRemarks || null,
                    assetReturnDocket: returnDocketJson || targetUser.assetReturnDocket,
                    deviceWiped: Boolean(deviceWiped),
                    dataBackedUp: Boolean(dataBackedUp),
                    m365LicenseRevoked: verifiedLicenseRevoked,
                    m365LicenseAssigned: revokeAllLicenses && m365RevokeSuccess ? false : targetUser.m365LicenseAssigned,
                    m365AccountDisabled: verifiedAccountDisabled,
                    status: deactivateUser ? 'Inactive' : targetUser.status,
                    offboardingStatus: operationErrors.length === 0 ? 'Completed' : 'In Progress',
                    offboardingCompletedDate: operationErrors.length === 0 ? new Date() : null
                },
                include: { department: true, branch: true, manager: { select: SAFE_USER_SELECT }, licenseAssignments: { include: { license: true } } }
            });

            return resultUser;
        });

        const { password: _, ...sanitized } = updatedUser;
        res.json({ ...sanitized, operationErrors });
    } catch (error: any) {
        console.error('Failed to process offboarding:', error);
        res.status(500).json({ error: error.message || 'Failed to process offboarding' });
    }
});

// --- Assets Routes ---


export default router;
