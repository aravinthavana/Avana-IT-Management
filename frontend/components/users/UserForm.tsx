import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { User, normalizeCompanyCode } from '../../types';
import { useAppContext } from '../../hooks/useAppContext';
import { useAuth } from '../../contexts/AuthContext';

interface UserFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (
        user: any,
        assetAssignment?: {
            assetId?: number;
            condition?: string;
            action?: 'assign' | 'unassign';
            unassignAssetId?: number;
        },
        launchOnboardingWizard?: boolean
    ) => void;
    user: User | null;
    isLoading?: boolean;
}

const FormInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, id, name, autoComplete = "off", ...props }) => {
    const inputId = id || name;
    return (
        <div>
            <label htmlFor={inputId} className="block text-sm font-medium text-ink">{label}</label>
            <input
                id={inputId}
                name={name}
                autoComplete={autoComplete}
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                {...props}
                className="mt-1 block w-full px-3 py-2 bg-surface border border-line rounded-md text-sm shadow-sm placeholder-quiet focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-ink"
            />
        </div>
    );
};

const FormSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }> = ({ label, id, name, value, children, autoComplete = "off", ...props }) => {
    const selectId = id || name;
    return (
        <div>
            <label htmlFor={selectId} className="block text-sm font-medium text-ink">{label}</label>
            <select
                id={selectId}
                name={name}
                value={value ?? ''}
                autoComplete={autoComplete}
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                {...props}
                className="mt-1 block w-full pl-3 pr-10 py-2 bg-surface border border-line rounded-md text-sm shadow-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-ink disabled:opacity-60 disabled:bg-muted disabled:cursor-not-allowed"
            >
                {children}
            </select>
        </div>
    );
};

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
    <div className="md:col-span-2 pt-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-quiet border-b border-line pb-1">{title}</h4>
    </div>
);

const UserForm: React.FC<UserFormProps> = ({ isOpen, onClose, onSave, user, isLoading }) => {
    const { departments, branches, users, assets } = useAppContext();
    const { user: loggedInUser } = useAuth();
    const isAdmin = loggedInUser?.role === 'Admin';
    const [formData, setFormData] = useState({
        name: '', email: '', password: '', role: 'User', status: 'Active',
        departmentId: '', branchId: '', managerId: '', accountType: 'Employee',
        employeeId: '', mobile: '', jobTitle: '', company: '', laptopStatus: '', location: '',
        workAddress: '', city: '', state: '', postalCode: '', country: ''
    });

    const userAssignedAssets = React.useMemo(() => {
        if (!user) return [];
        return assets.filter(a =>
            (a.assigneeType?.toLowerCase() === 'user' && a.assigneeId === user.id) ||
            a.assignedTo === user.id ||
            a.userId === user.id
        );
    }, [user, assets]);

    const activeAssignedAsset = userAssignedAssets[0] || null;

    const availableAssets = React.useMemo(() => {
        const userCompanyCode = normalizeCompanyCode(formData.company);
        return assets.filter(a => {
            const isAvailable = a.status === 'In Stock' || a.status === 'Available for Reallocation';
            if (!isAvailable) return false;
            if (!userCompanyCode) return true;
            const assetCompanyCode = normalizeCompanyCode(a.company || a.assetId?.split('-')[0]);
            return assetCompanyCode === userCompanyCode;
        });
    }, [assets, formData.company]);

    const desktopAssets = React.useMemo(() => {
        return availableAssets.filter(a => a.category?.toLowerCase() === 'desktop' || a.assetId?.includes('-DES-'));
    }, [availableAssets]);

    const laptopAssets = React.useMemo(() => {
        return availableAssets.filter(a => a.category?.toLowerCase() === 'laptop' || a.assetId?.includes('-LAP-'));
    }, [availableAssets]);

    const otherAssets = React.useMemo(() => {
        return availableAssets.filter(a =>
            a.category?.toLowerCase() !== 'desktop' &&
            !a.assetId?.includes('-DES-') &&
            a.category?.toLowerCase() !== 'laptop' &&
            !a.assetId?.includes('-LAP-')
        );
    }, [availableAssets]);

    const [assetCategoryFilter, setAssetCategoryFilter] = useState<'all' | 'desktop' | 'laptop' | 'other'>('all');
    const [assignmentAction, setAssignmentAction] = useState<'keep' | 'reassign' | 'unassign'>('keep');
    const [deviceOption, setDeviceOption] = useState<'assign_now' | 'no_device'>('assign_now');
    const [selectedAssetId, setSelectedAssetId] = useState<string>('');
    const [handoverCondition, setHandoverCondition] = useState<string>('Good');
    const [launchWizardOnSave, setLaunchWizardOnSave] = useState(false);

    const filteredAvailableAssets = React.useMemo(() => {
        if (assetCategoryFilter === 'desktop') return desktopAssets;
        if (assetCategoryFilter === 'laptop') return laptopAssets;
        if (assetCategoryFilter === 'other') return otherAssets;
        return availableAssets;
    }, [assetCategoryFilter, desktopAssets, laptopAssets, otherAssets, availableAssets]);

    const prevOpenRef = React.useRef(false);
    const prevUserIdRef = React.useRef<number | string | null | undefined>(undefined);

    useEffect(() => {
        if (!isOpen) {
            prevOpenRef.current = false;
            prevUserIdRef.current = undefined;
            return;
        }

        const isFirstOpen = !prevOpenRef.current;
        const isUserSwitched = prevUserIdRef.current !== (user ? user.id : null);

        if (isFirstOpen || isUserSwitched) {
            prevOpenRef.current = true;
            prevUserIdRef.current = user ? user.id : null;

            if (user) {
                setFormData({
                    name: user.name || '',
                    email: user.email || '',
                    password: '',
                    role: user.role || 'User',
                    status: user.status || 'Active',
                    departmentId: user.departmentId ? String(user.departmentId) : '',
                    branchId: user.branchId ? String(user.branchId) : '',
                    managerId: user.managerId ? String(user.managerId) : '',
                    accountType: user.accountType || 'Employee',
                    employeeId: user.employeeId || '',
                    mobile: user.mobile || '',
                    jobTitle: user.jobTitle || '',
                    company: user.company || '',
                    laptopStatus: user.laptopStatus || '',
                    location: user.location || '',
                    workAddress: user.workAddress || '',
                    city: user.city || '',
                    state: user.state || '',
                    postalCode: user.postalCode || '',
                    country: user.country || '',
                });
                setAssignmentAction('keep');
                setDeviceOption(activeAssignedAsset ? 'assign_now' : 'no_device');
                setSelectedAssetId('');
                setLaunchWizardOnSave(false);
            } else {
                setFormData({
                    name: '', email: '', password: '', role: 'User', status: 'Active',
                    departmentId: '', branchId: '', managerId: '', accountType: 'Employee',
                    employeeId: '', mobile: '', jobTitle: '', company: '', laptopStatus: '', location: '',
                    workAddress: '', city: '', state: '', postalCode: '', country: ''
                });
                setAssignmentAction('keep');
                setDeviceOption(availableAssets.length > 0 ? 'assign_now' : 'no_device');
                setSelectedAssetId('');
                setHandoverCondition('Good');
                setLaunchWizardOnSave(false);
            }
        }
    }, [user, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const rawName = e.target.name;
        const name = rawName.startsWith('uf_') ? rawName.slice(3) : rawName;
        const { value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const payload: any = {
            name: formData.name,
            email: formData.email,
            role: isAdmin ? formData.role : (user ? user.role : 'User'),
            status: isAdmin ? formData.status : (user ? user.status : 'Active'),
            accountType: formData.accountType,
            departmentId: formData.departmentId ? Number(formData.departmentId) : null,
            branchId: formData.branchId ? Number(formData.branchId) : null,
            managerId: (formData.managerId && formData.managerId !== '') ? Number(formData.managerId) : null,
            employeeId: formData.employeeId || null,
            mobile: formData.mobile || null,
            jobTitle: formData.jobTitle || null,
            company: formData.company || null,
            laptopStatus: formData.laptopStatus || null,
            location: formData.location || null,
            workAddress: formData.workAddress || null,
            city: formData.city || null,
            state: formData.state || null,
            postalCode: formData.postalCode || null,
            country: formData.country || null,
        };
        if (formData.password && formData.password.trim() !== '') {
            payload.password = formData.password;
        }

        let assetAssignmentPayload: any = undefined;

        if (user && activeAssignedAsset) {
            if (assignmentAction === 'unassign') {
                assetAssignmentPayload = {
                    action: 'unassign',
                    unassignAssetId: activeAssignedAsset.id,
                };
            } else if (assignmentAction === 'reassign' && selectedAssetId) {
                assetAssignmentPayload = {
                    action: 'assign',
                    assetId: Number(selectedAssetId),
                    condition: handoverCondition,
                    unassignAssetId: activeAssignedAsset.id,
                };
            }
        } else if (deviceOption === 'assign_now' && selectedAssetId) {
            assetAssignmentPayload = {
                action: 'assign',
                assetId: Number(selectedAssetId),
                condition: handoverCondition,
            };
        }

        onSave(payload, assetAssignmentPayload, launchWizardOnSave);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={user ? 'Edit User' : 'Add New User'}>
            <form onSubmit={handleSubmit} autoComplete="off" data-lpignore="true" data-1p-ignore="true" data-form-type="other" className="space-y-4">
                {(user?.azureAdId || user?.m365AccountCreated) && (
                    <div className="flex items-center gap-2.5 p-3 bg-surface border border-line rounded-xl text-ink text-xs font-body">
                        <svg className="w-4 h-4 text-ink flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M11.5 2H2v9.5h9.5V2zm10.5 0H12.5v9.5H22V2zM11.5 12.5H2V22h9.5V12.5zm10.5 0H12.5V22H22V12.5z"/>
                        </svg>
                        <span><strong>Microsoft 365 Connected:</strong> Profile updates will automatically synchronize to Entra ID and M365 Admin Center.</span>
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {/* Account Credentials */}
                    <SectionHeader title="Account Credentials" />
                    <FormInput label="Full Name *" type="text" name="uf_name" value={formData.name} onChange={handleChange} required placeholder="e.g. John Doe" />
                    <FormInput label="Email Address *" type="email" name="uf_email" value={formData.email} onChange={handleChange} required placeholder="john@avanamedical.com" />
                    <div className="md:col-span-2">
                        <FormInput
                            label={user ? 'New Password (leave blank to keep current)' : 'Password *'}
                            type="password"
                            name="uf_password"
                            value={formData.password}
                            onChange={handleChange}
                            required={!user}
                            placeholder={user ? '••••••••' : 'Set a password for this user'}
                            autoComplete="new-password"
                        />
                        {!user && <p className="mt-1 text-xs text-quiet">This password will be required for the user to log in.</p>}
                    </div>

                    {/* Role & Access */}
                    <SectionHeader title="Role & Access" />
                    <div>
                        <FormSelect label="Role *" name="uf_role" value={formData.role} onChange={handleChange} disabled={!isAdmin} required>
                            <option value="User">User</option>
                            <option value="Manager">Manager</option>
                            <option value="Admin">Admin</option>
                        </FormSelect>
                        {!isAdmin && (
                            <p className="text-[11px] text-quiet mt-1 font-body">Role can only be modified by an Admin.</p>
                        )}
                    </div>
                    <div>
                        <FormSelect label="Status *" name="uf_status" value={formData.status} onChange={handleChange} disabled={!isAdmin} required>
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                        </FormSelect>
                        {!isAdmin && (
                            <p className="text-[11px] text-quiet mt-1 font-body">Status can only be modified by an Admin.</p>
                        )}
                    </div>
                    <FormSelect label="Account Type *" name="uf_accountType" value={formData.accountType} onChange={handleChange} required>
                        <option value="Employee">Employee</option>
                        <option value="Shared Account">Shared Account</option>
                        <option value="External Employee">External Employee</option>
                        <option value="Others">Others</option>
                    </FormSelect>

                    {/* Employee Details */}
                    <SectionHeader title="Employee Details" />
                    <FormInput label="Employee ID" type="text" name="uf_employeeId" value={formData.employeeId} onChange={handleChange} placeholder="e.g. AMD_001" />
                    <FormInput label="Job Title" type="text" name="uf_jobTitle" value={formData.jobTitle} onChange={handleChange} placeholder="e.g. Sales Executive" />
                    <FormInput label="Mobile Number" type="tel" name="uf_mobile" value={formData.mobile} onChange={handleChange} placeholder="e.g. +91 9876543210" />
                    <FormInput label="Company" type="text" name="uf_company" value={formData.company} onChange={handleChange} placeholder="e.g. Avana Medical Devices" />

                    {/* Organisation */}
                    <SectionHeader title="Organisation" />
                    <FormSelect label="Department" name="uf_departmentId" value={formData.departmentId} onChange={handleChange}>
                        <option value="">-- No Department --</option>
                        {departments.map(dept => (
                            <option key={dept.id} value={dept.id}>{dept.name}</option>
                        ))}
                    </FormSelect>
                    <FormSelect label="Official Branch" name="uf_branchId" value={formData.branchId} onChange={handleChange}>
                        <option value="">-- No Branch (Remote / Unassigned) --</option>
                        {branches.map(branch => (
                            <option key={branch.id} value={branch.id}>{branch.name}</option>
                        ))}
                    </FormSelect>
                    <FormInput label="Work Location (City / Station)" type="text" name="uf_location" value={formData.location} onChange={handleChange} placeholder="e.g. Hyderabad, Pune, Cochin, Remote" />
                    <FormInput label="Work Location Address (Office Premises)" type="text" name="uf_workAddress" value={formData.workAddress} onChange={handleChange} placeholder="e.g. No.91, Sundar Nagar 4th Avenue, Nandambakkam or Field" />
                    <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <FormInput label="City" type="text" name="uf_city" value={formData.city} onChange={handleChange} placeholder="e.g. Chennai" />
                        <FormInput label="State" type="text" name="uf_state" value={formData.state} onChange={handleChange} placeholder="e.g. Tamil Nadu" />
                        <FormInput label="Postal Code" type="text" name="uf_postalCode" value={formData.postalCode} onChange={handleChange} placeholder="e.g. 600032" />
                        <FormInput label="Country" type="text" name="uf_country" value={formData.country} onChange={handleChange} placeholder="e.g. India" />
                    </div>
                    <FormSelect label="Reports To (Manager)" name="uf_managerId" value={formData.managerId} onChange={handleChange}>
                        <option value="">-- No Manager --</option>
                        {users.filter(u => u.id !== user?.id && (u.role === 'Manager' || u.role === 'Admin')).map(u => (
                            <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                        ))}
                    </FormSelect>

                    {/* Workstation & Device Assignment */}
                    <SectionHeader title="Workstation & Device Assignment" />

                    {user && activeAssignedAsset ? (
                        <div className="md:col-span-2 space-y-3">
                            <div className="p-3.5 bg-canvas rounded-xl border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-quiet">Currently Assigned Hardware</span>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface text-ink">
                                            {activeAssignedAsset.status}
                                        </span>
                                    </div>
                                    <p className="text-sm font-bold text-ink flex items-center gap-2 mt-1">
                                        {activeAssignedAsset.category?.toLowerCase() === 'desktop' || activeAssignedAsset.assetId?.includes('-DES-') ? '🖥️ Desktop:' : '💻 Laptop:'} {activeAssignedAsset.name}
                                        <span className="font-mono text-xs px-2 py-0.5 bg-surface text-ink rounded font-semibold">
                                            [{activeAssignedAsset.assetId}]
                                        </span>
                                    </p>
                                    <p className="text-xs text-quiet mt-0.5">
                                        {activeAssignedAsset.brand ? `${activeAssignedAsset.brand} ` : ''}{activeAssignedAsset.model || ''}
                                        {activeAssignedAsset.serialNumber ? ` • S/N: ${activeAssignedAsset.serialNumber}` : ''}
                                    </p>
                                </div>
                            </div>

                            {/* Actions for current equipment */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <label className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                                    assignmentAction === 'keep' ? 'border-accent bg-surface/50  text-ink  font-semibold' : 'border-line  hover:bg-canvas text-quiet '
                                }`}>
                                    <input type="radio" name="assignAction" checked={assignmentAction === 'keep'} onChange={() => setAssignmentAction('keep')} className="text-ink" />
                                    <span>Keep Current Device</span>
                                </label>
                                <label className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                                    assignmentAction === 'reassign' ? 'border-accent bg-surface/50  text-ink  font-semibold' : 'border-line  hover:bg-canvas text-quiet '
                                }`}>
                                    <input type="radio" name="assignAction" checked={assignmentAction === 'reassign'} onChange={() => setAssignmentAction('reassign')} className="text-ink" />
                                    <span>Replace / Reassign</span>
                                </label>
                                <label className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                                    assignmentAction === 'unassign' ? 'border-line bg-surface/50  text-ink  font-semibold' : 'border-line  hover:bg-canvas text-quiet '
                                }`}>
                                    <input type="radio" name="assignAction" checked={assignmentAction === 'unassign'} onChange={() => setAssignmentAction('unassign')} className="text-ink" />
                                    <span>Unassign to Stock</span>
                                </label>
                            </div>

                            {assignmentAction === 'reassign' && (
                                <div className="bg-canvas p-4 rounded-xl border border-line space-y-3 animate-in fade-in duration-150">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-xs font-semibold text-ink">Filter Replacement Device</label>
                                            <span className="text-[11px] text-quiet">{filteredAvailableAssets.length} in stock</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 p-1 bg-surface rounded-lg border border-line text-xs">
                                            <button
                                                type="button"
                                                onClick={() => setAssetCategoryFilter('all')}
                                                className={`px-3 py-1 rounded-md font-medium transition-all ${assetCategoryFilter === 'all' ? 'bg-accent text-on-strong shadow-sm' : 'text-quiet  hover:bg-muted '}`}
                                            >
                                                All ({availableAssets.length})
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setAssetCategoryFilter('desktop')}
                                                className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${assetCategoryFilter === 'desktop' ? 'bg-accent text-on-strong shadow-sm' : 'text-quiet  hover:bg-muted '}`}
                                            >
                                                🖥️ Desktops ({desktopAssets.length})
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setAssetCategoryFilter('laptop')}
                                                className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${assetCategoryFilter === 'laptop' ? 'bg-accent text-on-strong shadow-sm' : 'text-quiet  hover:bg-muted '}`}
                                            >
                                                💻 Laptops ({laptopAssets.length})
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-ink mb-1">
                                            Select Replacement Asset *
                                        </label>
                                        <select aria-label="Select Replacement Asset *"
                                            value={selectedAssetId}
                                            onChange={(e) => setSelectedAssetId(e.target.value)}
                                            required={assignmentAction === 'reassign'}
                                            className="w-full pl-3 pr-10 py-2 bg-surface border border-line rounded-md text-xs shadow-sm focus:ring-1 focus:ring-accent text-ink"
                                        >
                                            <option value="">-- Choose Asset from In Stock ({filteredAvailableAssets.length} available) --</option>
                                            {filteredAvailableAssets.map(a => {
                                                const isDesk = a.category?.toLowerCase() === 'desktop' || a.assetId?.includes('-DES-');
                                                return (
                                                    <option key={a.id} value={a.id}>
                                                        {isDesk ? '🖥️ Desktop' : '💻 Laptop'}: [{a.assetId}] {a.name} - {a.brand || ''} {a.model || ''} (S/N: {a.serialNumber || 'N/A'})
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-ink mb-1">
                                            Condition at Handover
                                        </label>
                                        <select aria-label="Condition at Handover"
                                            value={handoverCondition}
                                            onChange={(e) => setHandoverCondition(e.target.value)}
                                            className="w-full pl-3 pr-10 py-2 bg-surface border border-line rounded-md text-xs shadow-sm focus:ring-1 focus:ring-accent text-ink"
                                        >
                                            <option value="Good">Good (Working fine, normal wear)</option>
                                            <option value="Brand New">Brand New (Fresh / Box piece)</option>
                                            <option value="Minor Damage">Minor Damage (Cosmetic marks)</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {assignmentAction === 'unassign' && (
                                <div className="p-3 bg-surface rounded-lg border border-line text-xs text-ink">
                                    ⚠️ When you save, <strong>{activeAssignedAsset.assetId}</strong> will be unlinked from this employee and returned to 'In Stock'.
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="md:col-span-2 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <label className={`flex items-start p-3 rounded-lg border cursor-pointer transition-all ${
                                    deviceOption === 'assign_now'
                                        ? 'border-accent bg-surface/50  ring-1 ring-accent'
                                        : 'border-line  hover:bg-canvas '
                                }`}>
                                    <input
                                        type="radio"
                                        name="deviceOption"
                                        checked={deviceOption === 'assign_now'}
                                        onChange={() => setDeviceOption('assign_now')}
                                        className="mt-1 text-ink focus:ring-accent"
                                    />
                                    <div className="ml-3">
                                        <p className="text-sm font-semibold text-ink">Assign Company Device</p>
                                        <p className="text-xs text-quiet">Allocate an in-stock Desktop or Laptop</p>
                                    </div>
                                </label>

                                <label className={`flex items-start p-3 rounded-lg border cursor-pointer transition-all ${
                                    deviceOption === 'no_device'
                                        ? 'border-accent bg-surface/50  ring-1 ring-accent'
                                        : 'border-line  hover:bg-canvas '
                                }`}>
                                    <input
                                        type="radio"
                                        name="deviceOption"
                                        checked={deviceOption === 'no_device'}
                                        onChange={() => setDeviceOption('no_device')}
                                        className="mt-1 text-ink focus:ring-accent"
                                    />
                                    <div className="ml-3">
                                        <p className="text-sm font-semibold text-ink">No Company Device / BYOD</p>
                                        <p className="text-xs text-quiet">Personal device, shared desk, or cloud user</p>
                                    </div>
                                </label>
                            </div>

                            {deviceOption === 'assign_now' && (
                                <div className="bg-canvas p-4 rounded-xl border border-line space-y-3 animate-in fade-in duration-150">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-xs font-semibold text-ink">Filter Device Type</label>
                                            <span className="text-[11px] text-quiet">{filteredAvailableAssets.length} in stock</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 p-1 bg-surface rounded-lg border border-line text-xs">
                                            <button
                                                type="button"
                                                onClick={() => setAssetCategoryFilter('all')}
                                                className={`px-3 py-1 rounded-md font-medium transition-all ${assetCategoryFilter === 'all' ? 'bg-accent text-on-strong shadow-sm' : 'text-quiet  hover:bg-muted '}`}
                                            >
                                                All Available ({availableAssets.length})
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setAssetCategoryFilter('desktop')}
                                                className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${assetCategoryFilter === 'desktop' ? 'bg-accent text-on-strong shadow-sm' : 'text-quiet  hover:bg-muted '}`}
                                            >
                                                🖥️ Desktops ({desktopAssets.length})
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setAssetCategoryFilter('laptop')}
                                                className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${assetCategoryFilter === 'laptop' ? 'bg-accent text-on-strong shadow-sm' : 'text-quiet  hover:bg-muted '}`}
                                            >
                                                💻 Laptops ({laptopAssets.length})
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-ink mb-1">
                                            Choose Asset to Allocate *
                                        </label>
                                        <select aria-label="Choose Asset to Allocate *"
                                            value={selectedAssetId}
                                            onChange={(e) => setSelectedAssetId(e.target.value)}
                                            required={deviceOption === 'assign_now' && !user}
                                            className="w-full pl-3 pr-10 py-2 bg-surface border border-line rounded-md text-xs shadow-sm focus:ring-1 focus:ring-accent text-ink"
                                        >
                                            <option value="">-- Choose Asset from In Stock ({filteredAvailableAssets.length} available) --</option>
                                            {filteredAvailableAssets.map(a => {
                                                const isDesk = a.category?.toLowerCase() === 'desktop' || a.assetId?.includes('-DES-');
                                                return (
                                                    <option key={a.id} value={a.id}>
                                                        {isDesk ? '🖥️ Desktop' : '💻 Laptop'}: [{a.assetId}] {a.name} - {a.brand || ''} {a.model || ''} (S/N: {a.serialNumber || 'N/A'})
                                                    </option>
                                                );
                                            })}
                                        </select>
                                        {filteredAvailableAssets.length === 0 && (
                                            <p className="mt-1 text-xs text-ink">
                                                No {assetCategoryFilter === 'desktop' ? 'desktops' : assetCategoryFilter === 'laptop' ? 'laptops' : 'devices'} currently available in stock.
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-ink mb-1">
                                            Condition at Handover
                                        </label>
                                        <select aria-label="Condition at Handover"
                                            value={handoverCondition}
                                            onChange={(e) => setHandoverCondition(e.target.value)}
                                            className="w-full pl-3 pr-10 py-2 bg-surface border border-line rounded-md text-xs shadow-sm focus:ring-1 focus:ring-accent text-ink"
                                        >
                                            <option value="Good">Good (Working fine, normal wear)</option>
                                            <option value="Brand New">Brand New (Fresh / Box piece)</option>
                                            <option value="Minor Damage">Minor Damage (Cosmetic marks)</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {deviceOption === 'no_device' && (
                                <div className="p-3 bg-canvas rounded-xl border border-line">
                                    <label className="block text-xs font-semibold text-ink mb-1">
                                        Hardware Status / Policy
                                    </label>
                                    <select aria-label="Hardware Status / Policy"
                                        name="laptopStatus"
                                        value={formData.laptopStatus}
                                        onChange={handleChange}
                                        className="w-full pl-3 pr-10 py-2 bg-surface border border-line rounded-md text-xs shadow-sm focus:ring-1 focus:ring-accent text-ink"
                                    >
                                        <option value="No Device Assigned">No Device Assigned (Desk phone / shared desk / cloud only)</option>
                                        <option value="Uses Own Laptop">Uses Own Laptop / Device (BYOD)</option>
                                        <option value="Details Not Collected">Details Not Collected</option>
                                    </select>
                                </div>
                            )}

                            {/* Guided Onboarding Wizard Checkbox for New Users */}
                            {!user && (
                                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-accent bg-surface/40 cursor-pointer hover:bg-surface transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={launchWizardOnSave}
                                        onChange={(e) => setLaunchWizardOnSave(e.target.checked)}
                                        className="mt-0.5 w-4 h-4 text-ink rounded focus:ring-accent"
                                    />
                                    <div>
                                        <p className="text-xs font-bold text-ink flex items-center gap-1.5">
                                            ⚡ Launch Guided Onboarding Wizard Immediately Upon Saving
                                        </p>
                                        <p className="text-[11px] text-quiet mt-0.5">
                                            Opens the step-by-step checklist to configure M365 account, assign M365 license, allocate device (desktop/laptop), run QA hardware diagnostics, and generate the Handover Declaration.
                                        </p>
                                    </div>
                                </label>
                            )}
                        </div>
                    )}

                </div>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 pt-4 gap-3">
                    <button type="button" onClick={onClose} disabled={isLoading} className="w-full sm:w-auto flex justify-center bg-muted text-ink px-5 py-2 rounded-lg hover:bg-muted font-medium transition-all duration-200 active:scale-95 disabled:opacity-60">Cancel</button>
                    <button type="submit" disabled={isLoading} className="w-full sm:w-auto flex justify-center bg-accent text-on-strong px-5 py-2 rounded-lg hover:bg-accent font-medium transition-all duration-200 active:scale-95 disabled:opacity-60">
                        {isLoading ? 'Saving...' : 'Save User'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default UserForm;