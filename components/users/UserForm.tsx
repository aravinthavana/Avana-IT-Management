import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { User } from '../../types';
import { useAppContext } from '../../hooks/useAppContext';

interface UserFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (user: Partial<User>) => void;
    user: User | null;
    forcedCompany?: string;
}

const FormInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, ...props }) => (
    <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
        <input {...props} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm shadow-sm placeholder-slate-400 dark:placeholder-slate-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 text-slate-900 dark:text-slate-100" />
    </div>
);

const FormSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }> = ({ label, children, ...props }) => (
     <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
        <select {...props} className="mt-1 block w-full pl-3 pr-10 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm shadow-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-200 text-slate-900 dark:text-slate-100">
            {children}
        </select>
    </div>
);


const UserForm: React.FC<UserFormProps> = ({ isOpen, onClose, onSave, user, forcedCompany }) => {
    const { departments } = useAppContext();
    const [formData, setFormData] = useState({ name: '', employeeId: '', email: '', mobile: '', department: '', company: 'AMD', location: '' });

    useEffect(() => {
        if (user) {
            setFormData({ 
                name: user.name, 
                employeeId: user.employeeId, 
                email: user.email, 
                mobile: user.mobile, 
                department: user.department, 
                company: user.company, 
                location: user.location 
            });
        } else {
            const initialDepartment = departments.length > 0 ? departments[0].name : '';
            setFormData({ name: '', employeeId: '', email: '', mobile: '', department: initialDepartment, company: forcedCompany || 'AMD', location: '' });
        }
    }, [user, isOpen, forcedCompany, departments]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { 
        const { name, value } = e.target; 
        setFormData(prev => ({ ...prev, [name]: value })); 
    };
    
    const handleSubmit = (e: React.FormEvent) => { 
        e.preventDefault(); 
        onSave(formData); 
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={user ? 'Edit User' : 'Add New User'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormInput label="Full Name" type="text" name="name" value={formData.name} onChange={handleChange} required />
                    <FormInput label="Employee ID (Optional)" type="text" name="employeeId" value={formData.employeeId} onChange={handleChange} />
                    <FormInput label="Email Address" type="email" name="email" value={formData.email} onChange={handleChange} required />
                    <FormInput label="Mobile Number (Optional)" type="tel" name="mobile" value={formData.mobile} onChange={handleChange} />
                    <FormSelect label="Department" name="department" value={formData.department} onChange={handleChange} required>
                        {departments.map(dept => (
                            <option key={dept.id} value={dept.name}>{dept.name}</option>
                        ))}
                    </FormSelect>
                    <FormSelect label="Company" name="company" value={formData.company} onChange={handleChange} disabled={!!forcedCompany}>
                        <option>AMD</option><option>ASSP</option><option>ATS</option>
                    </FormSelect>
                    <div className="md:col-span-2">
                        <FormInput label="Location" type="text" name="location" value={formData.location} onChange={handleChange} required />
                    </div>
                </div>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 pt-4 gap-3">
                    <button type="button" onClick={onClose} className="w-full sm:w-auto flex justify-center bg-slate-200 text-slate-800 px-5 py-2 rounded-lg hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 font-medium transition-all duration-200 active:scale-95">Cancel</button>
                    <button type="submit" className="w-full sm:w-auto flex justify-center bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700 font-medium transition-all duration-200 active:scale-95">Save</button>
                </div>
            </form>
        </Modal>
    );
};

export default UserForm;