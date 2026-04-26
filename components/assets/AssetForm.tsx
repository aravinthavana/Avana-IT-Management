import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { Asset, AssetSpecs } from '../../types';
import { useAppContext } from '../../hooks/useAppContext';
import { generateAssetId } from '../../utils/assetUtils';
import { ICONS } from '../../constants';

interface AssetFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (assets: Asset[]) => void;
    asset: Asset | null;
    assetType: 'Device' | 'Other';
    purchaseDate?: string;
}

const FormInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }> = ({ label, error, id, name, ...props }) => {
    const inputId = id || name;
    return (
        <div>
            <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
            <input id={inputId} name={name} {...props} className={`mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border rounded-md text-sm shadow-sm placeholder-slate-400 dark:placeholder-slate-400 focus:outline-none focus:ring-1 text-slate-900 dark:text-slate-100 ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-600 focus:border-red-500 focus:ring-red-500'}`} />
            {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
    );
};

const FormSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }> = ({ label, id, name, children, ...props }) => {
    const selectId = id || name;
    return (
        <div>
            <label htmlFor={selectId} className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
            <select id={selectId} name={name} {...props} className="mt-1 block w-full pl-3 pr-10 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm shadow-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-200 text-slate-900 dark:text-slate-100">
                {children}
            </select>
        </div>
    );
};

const FormTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }> = ({ label, id, name, ...props }) => {
    const textareaId = id || name;
    return (
        <div>
            <label htmlFor={textareaId} className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
            <textarea id={textareaId} name={name} {...props} rows={3} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm shadow-sm placeholder-slate-400 dark:placeholder-slate-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 text-slate-900 dark:text-slate-100"></textarea>
        </div>
    );
};

const AssetForm: React.FC<AssetFormProps> = ({ isOpen, onClose, onSave, asset, assetType, purchaseDate }) => {
    const { assets, users, departments, branches } = useAppContext();
    const initialFormState: Omit<Asset, 'purchaseId'> & { purchaseId: number | '' } = {
        id: 0, assetId: '', assetCode: '', name: '', category: 'Laptop', brand: '', model: '', serialNumber: '', location: '', company: 'AMD',
        status: 'In Stock', assigneeId: '', assigneeType: null, purchaseId: '', manufacturer: '', remarks: '', 
        warrantyType: 'None', warrantyYears: '', warrantyStartDate: '', warrantyEndDate: '',
        specs: { os: '', storage: '', ram: '', processor: '', color: '', serviceTag: '', chargerAdapter: '', graphics: '', memoryTechnology: '', battery: '', dimensions: '', audio: '', displaySize: '', itemWeight: '', software: '' }
    };

    const [formData, setFormData] = useState<Omit<Asset, 'purchaseId'> & { purchaseId: number | '' }>(initialFormState);
    const [customFields, setCustomFields] = useState<{ id: number; fieldName: string; fieldValue: string; }[]>([]);
    const [quantity, setQuantity] = useState(1);
    const [serialNumbers, setSerialNumbers] = useState<{ value: string; error?: string }[]>([{ value: '' }]);

    useEffect(() => {
        if (isOpen) {
            if (asset) { // Covers both editing an existing asset and pre-filling a new one
                const fullSpecs = { ...initialFormState.specs, ...(asset.specs || {}) };
                const standardSpecKeys = Object.keys(initialFormState.specs);
                const customSpecEntries = Object.entries(fullSpecs).filter(([key]) => !standardSpecKeys.includes(key));
    
                setCustomFields(customSpecEntries.map(([fieldName, fieldValue], index) => ({
                    id: Date.now() + index,
                    fieldName,
                    fieldValue: fieldValue as string,
                })));
    
                setFormData({
                    ...initialFormState,
                    ...asset,
                    specs: fullSpecs,
                    assigneeId: asset.assigneeId || '',
                    serialNumber: ''
                });
    
                setQuantity(1);
                setSerialNumbers([{ value: asset.serialNumber, error: undefined }]);
            } else { // Creating a brand new, empty asset
                setFormData({ ...initialFormState, category: assetType === 'Device' ? 'Laptop' : '' });
                setCustomFields([]);
                setQuantity(1);
                setSerialNumbers([{ value: '', error: undefined }]);
            }
        }
    }, [asset, isOpen, assetType]);

    useEffect(() => {
        setFormData(prev => ({ ...prev, status: prev.assigneeId ? 'Assigned' : 'In Stock' }));
    }, [formData.assigneeId]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => {
            let newFormData = { ...prev, [name]: value };
            if (name === 'assigneeType') { newFormData.assigneeId = ''; if (value === '') newFormData.assigneeType = null; }
            if (name === 'company') { newFormData.assigneeId = ''; newFormData.assigneeType = null; }
            if (name === 'warrantyType') {
                newFormData.warrantyYears = ''; newFormData.warrantyStartDate = ''; newFormData.warrantyEndDate = '';
                if (value !== 'None' && purchaseDate) { newFormData.warrantyStartDate = purchaseDate; }
            }
            return newFormData;
        });
    };

    const handleSpecChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, specs: { ...prev.specs, [name]: value } }));
    };

    const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let newQuantity = parseInt(e.target.value, 10);
        if (isNaN(newQuantity) || newQuantity < 1) newQuantity = 1;
        if (newQuantity > 50) newQuantity = 50; // Limit to 50 assets at a time
        
        setQuantity(newQuantity);
        setSerialNumbers(currentSerials => {
            const newSerials = [...currentSerials];
            while (newSerials.length < newQuantity) newSerials.push({ value: '' });
            return newSerials.slice(0, newQuantity);
        });
    };

    const handleSerialNumberChange = (index: number, value: string) => {
        setSerialNumbers(currentSerials => {
            const newSerials = [...currentSerials];
            newSerials[index] = { value, error: '' }; // Clear error on change
            return newSerials;
        });
    };

    const addCustomField = () => { setCustomFields([...customFields, { id: Date.now(), fieldName: '', fieldValue: '' }]); };
    const removeCustomField = (id: number) => { setCustomFields(customFields.filter(field => field.id !== id)); };
    const handleCustomFieldChange = (id: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setCustomFields(customFields.map(field => field.id === id ? { ...field, [name]: value } : field));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validation for serial numbers
        const seenSerials = new Set();
        let isValid = true;
        const newSerialStates = serialNumbers.map(sn => {
            if (!sn.value.trim()) {
                isValid = false;
                return { ...sn, error: 'Serial number cannot be empty.' };
            }
            if (seenSerials.has(sn.value.trim().toLowerCase())) {
                isValid = false;
                return { ...sn, error: 'Duplicate serial number in this batch.' };
            }
            seenSerials.add(sn.value.trim().toLowerCase());
            return { ...sn, error: undefined };
        });

        setSerialNumbers(newSerialStates);
        if (!isValid) return;

        const assetsToSave: Asset[] = [];
        const yearOfPurchase = purchaseDate ? new Date(purchaseDate).getFullYear().toString() : '';

        const relevantAssets = assets.filter(a => a.company === formData.company && a.assetCode === formData.assetCode);
        let maxSequence = 0;
        if (relevantAssets.length > 0) {
            maxSequence = Math.max(...relevantAssets.map(a => {
                const parts = a.assetId.split('-');
                return parseInt(parts[parts.length - 1], 10) || 0;
            }));
        }

        for (let i = 0; i < quantity; i++) {
            const finalData = { ...formData, purchaseId: formData.purchaseId || 0 };
            let finalSpecs: AssetSpecs = { ...finalData.specs };

            if (assetType === 'Device') {
                customFields.forEach(field => { if (field.fieldName.trim()) { finalSpecs[field.fieldName.trim()] = field.fieldValue; } });
                Object.keys(finalSpecs).forEach(key => { if (finalSpecs[key] === '') { delete finalSpecs[key]; } });
            } else {
                finalSpecs = {};
            }
            
            finalData.specs = finalSpecs;
            finalData.serialNumber = serialNumbers[i].value.trim();
            if(!asset || !asset.id){
                finalData.assetId = generateAssetId(finalData.company, finalData.assetCode, yearOfPurchase, maxSequence + i + 1);
            }
            assetsToSave.push(finalData);
        }
        
        onSave(assetsToSave);
    };

    const assigneeOptions = () => {
        switch (formData.assigneeType) {
            case 'user': return users.filter(u => u.company === formData.company).map(u => <option key={u.id} value={u.id}>{u.name} ({u.employeeId})</option>);
            case 'department': return departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>);
            case 'branch': return branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>);
            default: return [];
        }
    };
    const isEditing = asset && asset.id;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? `Edit ${asset.name}` : `Add New ${assetType}`} maxWidth="max-w-4xl">
            <form onSubmit={handleSubmit} className="space-y-6">
                
                <fieldset>
                    <legend className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4">Core Information</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormInput label="Asset Name" type="text" name="name" value={formData.name} onChange={handleChange} required />
                        <FormSelect label="Company" name="company" value={formData.company} onChange={handleChange} disabled={!!purchaseDate || isEditing}>
                            <option>AMD</option><option>ASSP</option><option>ATS</option>
                        </FormSelect>
                        {assetType === 'Device' ? (
                            <FormSelect label="Device Type" name="category" value={formData.category} onChange={handleChange}>
                                <option>Laptop</option><option>Desktop</option><option>Phone</option><option>Tablet</option>
                            </FormSelect>
                        ) : (
                            <FormInput label="Category" type="text" name="category" value={formData.category} onChange={handleChange} placeholder="e.g., Monitor, Keyboard" required />
                        )}
                        <FormInput label="Brand" type="text" name="brand" value={formData.brand} onChange={handleChange} />
                        <FormInput label="Model" type="text" name="model" value={formData.model} onChange={handleChange} />
                         <FormInput label="Quantity" type="number" name="quantity" value={quantity} onChange={handleQuantityChange} min="1" max="50" disabled={isEditing} />
                    </div>
                </fieldset>

                 <fieldset className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-6">
                    <legend className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4">Asset & Serial Numbers</legend>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormInput label="Asset Code (e.g., LAP for Laptop)" type="text" name="assetCode" value={formData.assetCode} onChange={handleChange} maxLength={3} required disabled={isEditing} />
                         {purchaseDate && <FormInput label="Purchase Date" type="date" value={purchaseDate} readOnly />}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Serial Number(s)</label>
                            <div className="mt-1 space-y-2 max-h-40 overflow-y-auto pr-2">
                                {serialNumbers.map((sn, index) => (
                                    <FormInput
                                        key={index}
                                        label={quantity > 1 ? `Serial Number ${index + 1}` : 'Serial Number'}
                                        aria-label={`Serial Number ${index + 1}`}
                                        type="text"
                                        value={sn.value}
                                        onChange={(e) => handleSerialNumberChange(index, e.target.value)}
                                        required
                                        error={sn.error}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </fieldset>

                <fieldset className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-6">
                    <legend className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4">Status & Assignment</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-6">
                         <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
                            <input type="text" value={formData.status} className="mt-1 block w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm" readOnly />
                        </div>
                         <FormInput label="Location" type="text" name="location" value={formData.location} onChange={handleChange} required />
                         <FormSelect label="Assign To (Type)" name="assigneeType" value={formData.assigneeType ?? ''} onChange={handleChange}>
                            <option value="">Unassigned</option>
                            <option value="user">User</option>
                            <option value="department">Department</option>
                            <option value="branch">Branch</option>
                        </FormSelect>
                        {formData.assigneeType && (
                            <FormSelect label={`Select ${formData.assigneeType.charAt(0).toUpperCase() + formData.assigneeType.slice(1)}`} name="assigneeId" value={formData.assigneeId ?? ''} onChange={handleChange}>
                                <option value="">Select...</option>
                                {assigneeOptions()}
                            </FormSelect>
                        )}
                    </div>
                </fieldset>
                
                <fieldset className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-6">
                    <legend className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4">Warranty Details</legend>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <FormSelect label="Warranty Type" name="warrantyType" value={formData.warrantyType} onChange={handleChange}>
                                <option value="None">No Warranty</option>
                                <option value="Years">By Years</option>
                                <option value="Date Range">By Date Range</option>
                        </FormSelect>
                        {formData.warrantyType === 'Years' && (
                            <FormInput label="Warranty (Years)" type="number" name="warrantyYears" value={formData.warrantyYears ?? ''} onChange={handleChange} />
                        )}
                        {formData.warrantyType === 'Date Range' && (
                            <>
                                <FormInput label="Warranty Start Date" type="date" name="warrantyStartDate" value={formData.warrantyStartDate} onChange={handleChange} />
                                <FormInput label="Warranty End Date" type="date" name="warrantyEndDate" value={formData.warrantyEndDate} onChange={handleChange} />
                            </>
                        )}
                    </div>
                     {formData.warrantyType !== 'None' && formData.warrantyType !== 'Date Range' && (
                        <FormInput label="Warranty Start Date" type="date" name="warrantyStartDate" value={formData.warrantyStartDate} onChange={handleChange} className="mt-4" />
                    )}
                </fieldset>

                {assetType === 'Device' && (
                    <fieldset className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-6">
                        <legend className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4">Device Specifications</legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                             {Object.keys(initialFormState.specs).map(key => (
                                 <div key={key}>
                                     <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">{key.replace(/([A-Z])/g, ' $1')}</label>
                                     <input type="text" name={key} value={(formData.specs as any)[key] || ''} onChange={handleSpecChange} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm shadow-sm placeholder-slate-400 dark:placeholder-slate-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 text-slate-900 dark:text-slate-100" />
                                 </div>
                             ))}
                        </div>
                        <div className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-6">
                            <h4 className="text-md font-semibold text-slate-700 dark:text-slate-200 mb-4">Custom Specifications</h4>
                            <div className="space-y-3">
                                {customFields.map((field) => (
                                    <div key={field.id} className="flex items-center gap-2">
                                        <input type="text" name="fieldName" value={field.fieldName} onChange={(e) => handleCustomFieldChange(field.id, e)} placeholder="Field Name (e.g. GPU)" className="w-1/2 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm shadow-sm placeholder-slate-400 dark:placeholder-slate-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 text-slate-900 dark:text-slate-100"/>
                                        <input type="text" name="fieldValue" value={field.fieldValue} onChange={(e) => handleCustomFieldChange(field.id, e)} placeholder="Field Value (e.g. NVIDIA RTX 3080)" className="flex-1 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm shadow-sm placeholder-slate-400 dark:placeholder-slate-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 text-slate-900 dark:text-slate-100"/>
                                        <button type="button" onClick={() => removeCustomField(field.id)} className="flex-shrink-0 flex items-center justify-center w-8 h-8 bg-red-100 text-red-600 rounded-full hover:bg-red-200 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500">{ICONS.remove}</button>
                                    </div>
                                ))}
                            </div>
                            <button type="button" onClick={addCustomField} className="mt-4 text-sm font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 flex items-center gap-1"><span className="w-5 h-5">{ICONS.add}</span> Add Custom Field</button>
                        </div>
                    </fieldset>
                )}
                
                <fieldset className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-6">
                     <FormTextarea label="Remarks" name="remarks" value={formData.remarks} onChange={handleChange} />
                </fieldset>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 pt-6 gap-3">
                    <button type="button" onClick={onClose} className="w-full sm:w-auto justify-center bg-slate-200 text-slate-800 px-5 py-2 rounded-lg hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 font-medium transition-all duration-200 active:scale-95 flex items-center">Cancel</button>
                    <button type="submit" className="w-full sm:w-auto justify-center bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700 font-medium transition-all duration-200 active:scale-95 flex items-center">Save Asset</button>
                </div>
            </form>
        </Modal>
    );
};

export default AssetForm;