import { Router } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../db';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { userSchema } from '../schemas';

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
        res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status, avatar: user.avatar, mobile: user.mobile, jobTitle: user.jobTitle, company: user.company, employeeId: user.employeeId } });
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
            include: { department: true, branch: true, manager: true }
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
        if (email) updateData.email = email;
        if (avatar !== undefined) updateData.avatar = avatar;
        if (mobile !== undefined) updateData.mobile = mobile;
        if (jobTitle !== undefined) updateData.jobTitle = jobTitle;
        if (company !== undefined) updateData.company = company;
        if (employeeId !== undefined) updateData.employeeId = employeeId;
        if (accountType !== undefined) updateData.accountType = accountType;
        if (laptopStatus !== undefined) updateData.laptopStatus = laptopStatus;
        if (location !== undefined) updateData.location = location;
        if (workAddress !== undefined) updateData.workAddress = workAddress;
        if (city !== undefined) updateData.city = city;
        if (state !== undefined) updateData.state = state;
        if (postalCode !== undefined) updateData.postalCode = postalCode;
        if (country !== undefined) updateData.country = country;
        
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
                where: { userId: Number(id) }
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

            // Remove any licenses currently assigned to this user that are not in requestedLicenseIds
            await prisma.licenseAssignment.deleteMany({
                where: {
                    userId: targetUser.id,
                    licenseId: { notIn: requestedLicenseIds }
                }
            });

            // Assign newly requested licenses if not already assigned
            for (const licenseId of requestedLicenseIds) {
                const license = await prisma.license.findUnique({
                    where: { id: licenseId },
                    include: { assignments: true }
                });
                if (license) {
                    const alreadyAssigned = license.assignments.some(a => a.userId === targetUser.id);
                    if (!alreadyAssigned && license.assignments.length < license.seats) {
                        await prisma.licenseAssignment.create({
                            data: { licenseId, userId: targetUser.id }
                        });
                    }
                }
            }

            // Determine if user holds any Microsoft 365 or Exchange license
            const currentAssignments = await prisma.licenseAssignment.findMany({
                where: { userId: targetUser.id },
                include: { license: true }
            });
            licenseAssignedFlag = currentAssignments.some(a => 
                a.license.name.toLowerCase().includes('microsoft') || 
                a.license.name.toLowerCase().includes('exchange')
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
            include: { department: true, branch: true, manager: true, licenseAssignments: { include: { license: true } } }
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

        // 1. Process Asset Return if provided
        if (assetReturn && assetReturn.assetId) {
            let assetId = Number(assetReturn.assetId);
            const destinationStatus = assetReturn.destinationStatus || 'Under Inspection';
            const condition = assetReturn.condition || 'Good';

            // Security & Integrity check: Verify that the asset actually belongs to targetUser
            let assetToReturn = await prisma.asset.findFirst({
                where: {
                    id: assetId,
                    OR: [
                        { assigneeId: targetUser.id },
                        { userId: targetUser.id }
                    ]
                }
            });

            // If the specified assetId does NOT belong to targetUser, do not unassign someone else's asset!
            if (!assetToReturn) {
                console.warn(`[Offboarding Warning] Asset ID ${assetId} does not belong to user ${targetUser.name} (${targetUser.id}). Checking for user's assigned asset...`);
                const userActualAsset = await prisma.asset.findFirst({
                    where: {
                        OR: [
                            { assigneeId: targetUser.id },
                            { userId: targetUser.id }
                        ]
                    }
                });
                if (userActualAsset) {
                    console.log(`[Offboarding Auto-Correct] Routed offboarding return to user's actual assigned asset ID ${userActualAsset.id} (${userActualAsset.assetId}).`);
                    assetToReturn = userActualAsset;
                    assetId = userActualAsset.id;
                }
            }

            if (assetToReturn) {
                await prisma.asset.update({
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

                await prisma.assetHistory.create({
                    data: {
                        assetId,
                        userId: requestingUserId,
                        event: 'Unassigned',
                        condition,
                        details: `Asset returned during offboarding of ${targetUser.name}. Mode: ${modeText}. Return condition: ${condition}. Remarks: ${assetReturn.remarks || 'None'}. Routed to status "${destinationStatus}".`
                    }
                });

                if (deviceWiped) {
                    await prisma.assetHistory.create({
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

        // 2. Revoke Licenses
        if (revokeAllLicenses) {
            await prisma.licenseAssignment.deleteMany({
                where: { userId: targetUser.id }
            });
        }

        // 3. Update User Offboarding Flags & Status
        const returnDocketJson = (assetReturn && assetReturn.docketNumber) 
            ? JSON.stringify({
                mode: assetReturn.returnMode,
                courier: assetReturn.courierName,
                docketNo: assetReturn.docketNumber,
                returnDate: assetReturn.returnDate || new Date().toISOString()
            })
            : null;

        const updatedUser = await prisma.user.update({
            where: { id: targetUser.id },
            data: {
                assetReturned: true,
                assetReturnCondition: assetReturn?.condition || null,
                assetReturnRemarks: assetReturn?.remarks || offboardingRemarks || null,
                assetReturnDocket: returnDocketJson || targetUser.assetReturnDocket,
                deviceWiped: Boolean(deviceWiped),
                dataBackedUp: Boolean(dataBackedUp),
                m365LicenseRevoked: Boolean(revokeAllLicenses || targetUser.m365LicenseRevoked),
                m365LicenseAssigned: revokeAllLicenses ? false : targetUser.m365LicenseAssigned,
                m365AccountDisabled: Boolean(disableM365 || targetUser.m365AccountDisabled),
                status: deactivateUser ? 'Inactive' : targetUser.status,
                offboardingStatus: 'Completed',
                offboardingCompletedDate: new Date()
            },
            include: { department: true, branch: true, manager: true, licenseAssignments: { include: { license: true } } }
        });

        const { password: _, ...sanitized } = updatedUser;
        res.json(sanitized);
    } catch (error: any) {
        console.error('Failed to process offboarding:', error);
        res.status(500).json({ error: error.message || 'Failed to process offboarding' });
    }
});

// --- Assets Routes ---


export default router;
