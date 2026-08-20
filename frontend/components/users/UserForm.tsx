import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { User } from '../../types';
import { useAppContext } from '../../hooks/useAppContext';

interface UserFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (user: any) => void;
    user: User | null;
    isLoading?: boolean;
}

const FormInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, id, name, ...props }) => {
    const inputId = id || name;
    return (
        <div>
            <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
            <input id={inputId} name={name} {...props} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-900 dark:text-slate-100" />
        </div>
    );
};

const FormSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }> = ({ label, id, name, value, children, ...props }) => {
    const selectId = id || name;
    return (
        <div>
            <label htmlFor={selectId} className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
            <select id={selectId} name={name} value={value ?? ''} {...props} className="mt-1 block w-full pl-3 pr-10 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm shadow-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-900 dark:text-slate-100">
                {children}
            </select>
        </div>
    );
};

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
    <div className="md:col-span-2 pt-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-600 pb-1">{title}</h4>
    </div>
);

const UserForm: React.FC<UserFormProps> = ({ isOpen, onClose, onSave, user, isLoading }) => {
    const { departments, branches, users } = useAppContext();
    const [formData, setFormData] = useState({
        name: '', email: '', password: '', role: 'User', status: 'Active',
        departmentId: '', branchId: '', managerId: '', accountType: 'Employee',
        employeeId: '', mobile: '', jobTitle: '', company: '', laptopStatus: '', location: ''
    });

    useEffect(() => {
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
            });
        } else {
            setFormData({
                name: '', email: '', password: '', role: 'User', status: 'Active',
                departmentId: '', branchId: '', managerId: '', accountType: 'Employee',
                employeeId: '', mobile: '', jobTitle: '', company: '', laptopStatus: '', location: ''
            });
        }
    }, [user, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const payload: any = {
            name: formData.name,
            email: formData.email,
            role: formData.role,
            status: formData.status,
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
        };
        if (formData.password && formData.password.trim() !== '') {
            payload.password = formData.password;
        }
        onSave(payload);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={user ? 'Edit User' : 'Add New User'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {/* Account Credentials */}
                    <SectionHeader title="Account Credentials" />
                    <FormInput label="Full Name *" type="text" name="name" value={formData.name} onChange={handleChange} required placeholder="e.g. John Doe" />
                    <FormInput label="Email Address *" type="email" name="email" value={formData.email} onChange={handleChange} required placeholder="john@avana.com" />
                    <div className="md:col-span-2">
                        <FormInput
                            label={user ? 'New Password (leave blank to keep current)' : 'Password *'}
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            required={!user}
                            placeholder={user ? '••••••••' : 'Set a password for this user'}
                            autoComplete="new-password"
                        />
                        {!user && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">This password will be required for the user to log in.</p>}
                    </div>

                    {/* Role & Access */}
                    <SectionHeader title="Role & Access" />
                    <FormSelect label="Role *" name="role" value={formData.role} onChange={handleChange} required>
                        <option value="User">User</option>
                        <option value="Manager">Manager</option>
                        <option value="Admin">Admin</option>
                    </FormSelect>
                    <FormSelect label="Status *" name="status" value={formData.status} onChange={handleChange} required>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                    </FormSelect>
                    <FormSelect label="Account Type *" name="accountType" value={formData.accountType} onChange={handleChange} required>
                        <option value="Employee">Employee</option>
                        <option value="Shared Account">Shared Account</option>
                        <option value="External Employee">External Employee</option>
                        <option value="Others">Others</option>
                    </FormSelect>

                    {/* Employee Details */}
                    <SectionHeader title="Employee Details" />
                    <FormInput label="Employee ID" type="text" name="employeeId" value={formData.employeeId} onChange={handleChange} placeholder="e.g. AMD_001" />
                    <FormInput label="Job Title" type="text" name="jobTitle" value={formData.jobTitle} onChange={handleChange} placeholder="e.g. Sales Executive" />
                    <FormInput label="Mobile Number" type="tel" name="mobile" value={formData.mobile} onChange={handleChange} placeholder="e.g. +91 9876543210" />
                    <FormInput label="Company" type="text" name="company" value={formData.company} onChange={handleChange} placeholder="e.g. Avana Medical Devices" />

                    {/* Organisation */}
                    <SectionHeader title="Organisation" />
                    <FormSelect label="Department" name="departmentId" value={formData.departmentId} onChange={handleChange}>
                        <option value="">-- No Department --</option>
                        {departments.map(dept => (
                            <option key={dept.id} value={dept.id}>{dept.name}</option>
                        ))}
                    </FormSelect>
                    <FormSelect label="Official Branch" name="branchId" value={formData.branchId} onChange={handleChange}>
                        <option value="">-- No Branch (Remote / Unassigned) --</option>
                        {branches.map(branch => (
                            <option key={branch.id} value={branch.id}>{branch.name}</option>
                        ))}
                    </FormSelect>
                    <FormInput label="Work Location (City / Station)" type="text" name="location" value={formData.location} onChange={handleChange} placeholder="e.g. Hyderabad, Pune, Cochin, Remote" />
                    <FormSelect label="Reports To (Manager)" name="managerId" value={formData.managerId} onChange={handleChange}>
                        <option value="">-- No Manager --</option>
                        {users.filter(u => u.id !== user?.id && (u.role === 'Manager' || u.role === 'Admin')).map(u => (
                            <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                        ))}
                    </FormSelect>

                    {/* Laptop / Asset Status */}
                    <SectionHeader title="Laptop / Asset Status" />
                    <div className="md:col-span-2">
                        <FormSelect label="Laptop Status" name="laptopStatus" value={formData.laptopStatus} onChange={handleChange}>
                            <option value="">-- Not Set --</option>
                            <option value="Uses Own Laptop">Uses Own Laptop</option>
                            <option value="No Laptop Assigned">No Laptop Assigned</option>
                            <option value="Details Not Collected">Details Not Collected</option>
                        </FormSelect>
                    </div>

                </div>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 pt-4 gap-3">
                    <button type="button" onClick={onClose} disabled={isLoading} className="w-full sm:w-auto flex justify-center bg-slate-200 text-slate-800 px-5 py-2 rounded-lg hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 font-medium transition-all duration-200 active:scale-95 disabled:opacity-60">Cancel</button>
                    <button type="submit" disabled={isLoading} className="w-full sm:w-auto flex justify-center bg-brand-600 text-white px-5 py-2 rounded-lg hover:bg-brand-700 font-medium transition-all duration-200 active:scale-95 disabled:opacity-60">
                        {isLoading ? 'Saving...' : 'Save User'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default UserForm;