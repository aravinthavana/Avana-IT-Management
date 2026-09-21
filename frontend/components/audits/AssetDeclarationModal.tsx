import React, { useState, useRef } from 'react';
import Modal from '../ui/Modal';
import { Asset, SelfAudit, DeclaredAssetItem } from '../../types';
import { useAppContext } from '../../hooks/useAppContext';
import { ASSET_ICONS, ICONS } from '../../constants';

interface AssetDeclarationModalProps {
    isOpen: boolean;
    onClose: () => void;
    userAssignedAssets: Asset[];
    targetAudit?: SelfAudit | null;
    targetAsset?: Asset | null;
    onCompleted: (declarationId: number, shouldContinueToAudit: boolean, assetToAudit?: Asset | null) => void;
}

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080';

const CATEGORY_OPTIONS = [
    { key: 'Laptop', label: 'Laptop', icon: '💻', desc: 'ThinkPad, MacBook, Dell Latitude, etc.' },
    { key: 'Desktop', label: 'Desktop / Workstation', icon: '🖥️', desc: 'Tower PC, All-in-One, Mini PC' },
    { key: 'Monitor', label: 'External Monitor', icon: '🖥️', desc: 'Display screen 22", 24", 27"+' },
    { key: 'Keyboard', label: 'Keyboard', icon: '⌨️', desc: 'Wired or Wireless keyboard' },
    { key: 'Mouse', label: 'Mouse', icon: '🖱️', desc: 'Optical / Bluetooth / Wireless mouse' },
    { key: 'Headset', label: 'Headset / Audio', icon: '🎧', desc: 'Over-ear, in-ear, USB headphones' },
    { key: 'Dock', label: 'Docking Station / Hub', icon: '🔌', desc: 'USB-C dock, Multi-port adapter' },
    { key: 'Pen Drive', label: 'Pen Drive / Storage', icon: '💾', desc: 'USB Flash Drive, External HDD/SSD' },
    { key: 'Mobile', label: 'Mobile / SIM / Tablet', icon: '📱', desc: 'Company smartphone, iPad, SIM card' },
    { key: 'Other', label: 'Other Accessories', icon: '📦', desc: 'Webcam, Cables, Laptop Stand, Bag' },
];

const compressImage = (fileOrDataUrl: File | string, maxWidth = 1280, maxHeight = 1280, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '');
                return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', quality);
            resolve(compressed);
        };
        img.onerror = (err) => reject(err);

        if (typeof fileOrDataUrl === 'string') {
            img.src = fileOrDataUrl;
        } else {
            const reader = new FileReader();
            reader.onload = (e) => {
                img.src = e.target?.result as string;
            };
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(fileOrDataUrl);
        }
    });
};

const AssetDeclarationModal: React.FC<AssetDeclarationModalProps> = ({
    isOpen,
    onClose,
    userAssignedAssets,
    targetAudit,
    targetAsset,
    onCompleted
}) => {
    const { setNotification, getHeaders, fetchAllData } = useAppContext();

    // Steps: 1 (Possession), 2 (Categories), 3 (Item Details), 4 (IT Cross-Check), 5 (Ghost Audits), 6 (Completed)
    const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Step 1: Possession
    const [hasAssets, setHasAssets] = useState<boolean | null>(null);
    const [noAssetRemarks, setNoAssetRemarks] = useState('');

    // Step 2: Categories
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

    // Step 3: Declared Items
    const [declaredItems, setDeclaredItems] = useState<DeclaredAssetItem[]>([]);

    // Step 4: Verification against IT records
    const [systemRecordsOk, setSystemRecordsOk] = useState<boolean | null>(null);
    const [discrepancyNotes, setDiscrepancyNotes] = useState('');

    // Step 5: Ghost Asset Audits (Index of ghost asset being audited)
    const [activeGhostIndex, setActiveGhostIndex] = useState<number>(0);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Helper: list of ghost assets requiring photo/condition check
    const ghostAssets = declaredItems.filter(it => it.isGhost);

    const handleCategoryToggle = (catKey: string) => {
        if (selectedCategories.includes(catKey)) {
            setSelectedCategories(selectedCategories.filter(c => c !== catKey));
        } else {
            setSelectedCategories([...selectedCategories, catKey]);
        }
    };

    const handleProceedToItemDetails = () => {
        if (selectedCategories.length === 0) {
            setNotification({ message: 'Please select at least one asset category.', type: 'error' });
            return;
        }

        // Prepopulate items based on selected categories if list is empty
        const initialItems: DeclaredAssetItem[] = selectedCategories.map((cat, idx) => {
            const existing = declaredItems.find(d => d.category === cat);
            if (existing) return existing;
            return {
                id: `item-${Date.now()}-${idx}`,
                name: '',
                category: cat,
                brand: '',
                serialNumber: '',
                condition: 'Good',
                location: 'Head Office',
                isGhost: true
            };
        });

        // Retain any custom extra items added previously
        const extraItems = declaredItems.filter(it => !selectedCategories.includes(it.category));
        setDeclaredItems([...initialItems, ...extraItems]);
        setStep(3);
    };

    const handleAddItem = (category = 'Other') => {
        const newItem: DeclaredAssetItem = {
            id: `item-${Date.now()}-${declaredItems.length}`,
            name: '',
            category,
            brand: '',
            serialNumber: '',
            condition: 'Good',
            location: 'Head Office',
            isGhost: true
        };
        setDeclaredItems([...declaredItems, newItem]);
    };

    const handleUpdateItem = (index: number, field: keyof DeclaredAssetItem, value: any) => {
        const updated = [...declaredItems];
        updated[index] = { ...updated[index], [field]: value };
        setDeclaredItems(updated);
    };

    const handleRemoveItem = (index: number) => {
        if (declaredItems.length === 1) {
            setNotification({ message: 'You must declare at least one item.', type: 'error' });
            return;
        }
        setDeclaredItems(declaredItems.filter((_, i) => i !== index));
    };

    const handleProceedToCrossCheck = () => {
        // Validation: Every item must have a Name
        const emptyItem = declaredItems.find(it => !it.name || it.name.trim() === '');
        if (emptyItem) {
            setNotification({ message: `Please provide a name for the ${emptyItem.category} item. Only the name is required.`, type: 'error' });
            return;
        }

        // Auto-detect ghost items vs items matching official database records
        const resolvedItems = declaredItems.map(item => {
            const matchingDbAsset = userAssignedAssets.find(a => 
                a.category.toLowerCase() === item.category.toLowerCase() ||
                a.name.toLowerCase().includes(item.name.toLowerCase()) ||
                (item.serialNumber && a.serialNumber && a.serialNumber.toLowerCase() === item.serialNumber.toLowerCase())
            );

            return {
                ...item,
                isGhost: !matchingDbAsset,
                convertedAssetId: matchingDbAsset ? matchingDbAsset.id : undefined,
                convertedAssetTag: matchingDbAsset ? matchingDbAsset.assetId : undefined
            };
        });

        setDeclaredItems(resolvedItems);
        setStep(4);
    };

    // Camera Handlers for Ghost Asset Audit
    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }
            setIsCameraActive(true);
        } catch (err) {
            setNotification({ message: 'Could not access webcam. Please use photo upload instead.', type: 'error' });
            setIsCameraActive(false);
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setIsCameraActive(false);
    };

    const capturePhoto = async () => {
        if (!videoRef.current) return;
        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const rawData = canvas.toDataURL('image/jpeg', 0.8);
            stopCamera();
            try {
                const compressed = await compressImage(rawData);
                updateCurrentGhostPhoto(compressed);
            } catch (err) {
                updateCurrentGhostPhoto(rawData);
            }
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const compressed = await compressImage(file);
            updateCurrentGhostPhoto(compressed);
        } catch (err) {
            setNotification({ message: 'Failed to process selected image.', type: 'error' });
        }
    };

    const updateCurrentGhostPhoto = (imgData: string) => {
        const currentGhost = ghostAssets[activeGhostIndex];
        if (!currentGhost) return;
        const itemIdx = declaredItems.findIndex(d => d.id === currentGhost.id);
        if (itemIdx !== -1) {
            handleUpdateItem(itemIdx, 'imageUrl', imgData);
        }
    };

    // Submissions
    const handleSubmitNoAssets = async () => {
        setIsSubmitting(true);
        try {
            const res = await fetch(`${API_URL}/api/asset-declarations`, {
                method: 'POST',
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify({
                    hasAssets: false,
                    selectedTypes: [],
                    declaredItems: [],
                    systemRecordsOk: userAssignedAssets.length === 0,
                    discrepancyNotes: noAssetRemarks.trim() || 'Employee declared having no IT assets in possession.',
                    auditId: targetAudit?.id || null
                })
            });

            if (!res.ok) throw new Error('Failed to record declaration.');
            const data = await res.json();
            setNotification({ message: 'Zero-asset declaration recorded. IT Admin has been notified to verify records.', type: 'info' });
            fetchAllData().catch(() => {});
            onCompleted(data.id, false);
            handleClose();
        } catch (error: any) {
            setNotification({ message: error.message || 'Error submitting declaration', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmitFullDeclaration = async () => {
        setIsSubmitting(true);
        try {
            stopCamera();

            const res = await fetch(`${API_URL}/api/asset-declarations`, {
                method: 'POST',
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify({
                    hasAssets: true,
                    selectedTypes: selectedCategories,
                    declaredItems,
                    systemRecordsOk: systemRecordsOk ?? true,
                    discrepancyNotes: discrepancyNotes.trim() || null,
                    auditId: targetAudit?.id || null
                })
            });

            if (!res.ok) throw new Error('Failed to submit asset declaration.');
            const data = await res.json();
            setNotification({ message: 'Asset verification & declaration successfully submitted!', type: 'success' });
            fetchAllData().catch(() => {});

            // Check if there is an assigned device to continue physical self-audit
            const shouldAudit = Boolean(targetAsset || (userAssignedAssets.length > 0 && targetAudit));
            onCompleted(data.id, shouldAudit, targetAsset || userAssignedAssets[0]);
            handleClose();
        } catch (error: any) {
            setNotification({ message: error.message || 'Error submitting declaration', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        stopCamera();
        setStep(1);
        setHasAssets(null);
        setSelectedCategories([]);
        setDeclaredItems([]);
        setSystemRecordsOk(null);
        setDiscrepancyNotes('');
        onClose();
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={handleClose} 
            title="Pre-Audit Asset Discovery & Reconciliation" 
            maxWidth="max-w-2xl"
        >
            <div className="space-y-6 py-2">
                {/* Stepper Indicator */}
                <div className="flex items-center justify-between px-2">
                    {[
                        { num: 1, label: 'Possession' },
                        { num: 2, label: 'Categories' },
                        { num: 3, label: 'Items' },
                        { num: 4, label: 'Verify IT Records' },
                        ...(ghostAssets.length > 0 ? [{ num: 5, label: 'Ghost Audits' }] : [])
                    ].map((st, i, arr) => (
                        <React.Fragment key={st.num}>
                            <div className="flex flex-col items-center">
                                <span className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-all ${
                                    step >= st.num ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                                }`}>
                                    {st.num}
                                </span>
                                <span className="text-[10px] font-semibold text-slate-500 mt-1">{st.label}</span>
                            </div>
                            {i < arr.length - 1 && (
                                <div className={`flex-1 h-0.5 mx-2 ${step > st.num ? 'bg-brand-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
                            )}
                        </React.Fragment>
                    ))}
                </div>

                {/* STEP 1: Possession Check */}
                {step === 1 && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="text-center max-w-md mx-auto">
                            <div className="w-16 h-16 rounded-3xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center text-3xl mx-auto mb-3 shadow-inner">
                                💼
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                                Do you currently have company IT assets in your possession?
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2">
                                We are verifying all equipment across Avana Group to ensure accurate records for every employee.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={() => { setHasAssets(true); setStep(2); }}
                                className={`p-6 rounded-2xl border-2 text-left transition-all active:scale-98 flex flex-col justify-between ${
                                    hasAssets === true 
                                        ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/30 ring-2 ring-brand-500/20' 
                                        : 'border-slate-200 dark:border-slate-700 hover:border-brand-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'
                                }`}
                            >
                                <div className="text-3xl mb-3">✅</div>
                                <div>
                                    <h4 className="font-bold text-slate-900 dark:text-white text-base">Yes, I have equipment</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                        I possess a company laptop, desktop, monitor, keyboard, mouse, or accessories.
                                    </p>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setHasAssets(false)}
                                className={`p-6 rounded-2xl border-2 text-left transition-all active:scale-98 flex flex-col justify-between ${
                                    hasAssets === false 
                                        ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 ring-2 ring-amber-500/20' 
                                        : 'border-slate-200 dark:border-slate-700 hover:border-amber-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'
                                }`}
                            >
                                <div className="text-3xl mb-3">❌</div>
                                <div>
                                    <h4 className="font-bold text-slate-900 dark:text-white text-base">No, I have no equipment</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                        I do not currently hold any company hardware or devices.
                                    </p>
                                </div>
                            </button>
                        </div>

                        {/* If user clicks NO, show remarks and quick submit */}
                        {hasAssets === false && (
                            <div className="p-5 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-2xl space-y-3 animate-fade-in">
                                {userAssignedAssets.length > 0 && (
                                    <div className="flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
                                        <span className="text-base leading-none">⚠️</span>
                                        <span>
                                            <strong>Notice:</strong> IT records show <strong>{userAssignedAssets.length} asset(s)</strong> currently assigned under your name ({userAssignedAssets.map(a => a.name).join(', ')}). Submitting this will alert IT Admin to verify and clear the records.
                                        </span>
                                    </div>
                                )}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                                        Explanation / Remarks (Optional)
                                    </label>
                                    <textarea
                                        value={noAssetRemarks}
                                        onChange={(e) => setNoAssetRemarks(e.target.value)}
                                        placeholder="e.g. Returned to HR last week, using personal device, etc."
                                        rows={3}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-slate-100"
                                    />
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={handleClose}
                                        className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        disabled={isSubmitting}
                                        onClick={handleSubmitNoAssets}
                                        className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold shadow-md shadow-amber-600/20 active:scale-95 transition-all flex items-center gap-2"
                                    >
                                        {isSubmitting ? 'Recording...' : 'Submit Zero-Asset Declaration'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 2: Category Multi-Select */}
                {step === 2 && (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                What types of IT equipment are in your possession?
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Select all categories that apply. You will enter simple item names in the next step.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {CATEGORY_OPTIONS.map((cat) => {
                                const isSelected = selectedCategories.includes(cat.key);
                                return (
                                    <button
                                        key={cat.key}
                                        type="button"
                                        onClick={() => handleCategoryToggle(cat.key)}
                                        className={`p-3.5 rounded-2xl border text-left transition-all active:scale-95 flex flex-col justify-between ${
                                            isSelected 
                                                ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-950/40 ring-2 ring-brand-500/20 shadow-sm' 
                                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-2xl">{cat.icon}</span>
                                            <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center ${
                                                isSelected ? 'bg-brand-600 text-white' : 'border border-slate-300 dark:border-slate-600'
                                            }`}>
                                                {isSelected ? '✓' : ''}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-900 dark:text-white leading-snug">{cat.label}</p>
                                            <p className="text-[10px] text-slate-400 truncate mt-0.5">{cat.desc}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700">
                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
                            >
                                &larr; Back
                            </button>
                            <button
                                type="button"
                                onClick={handleProceedToItemDetails}
                                className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold rounded-xl shadow-md shadow-brand-500/20 active:scale-95 transition-all flex items-center gap-2"
                            >
                                Continue ({selectedCategories.length} selected) &rarr;
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 3: Collect Item Details (Only Name Required) */}
                {step === 3 && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                    Declare Item Details
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    <strong>Only the Asset Name is required</strong> (e.g. &ldquo;Lenovo Laptop&rdquo;, &ldquo;Dell Mouse&rdquo;, &ldquo;HP Monitor&rdquo;). Other details are optional.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleAddItem()}
                                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0"
                            >
                                ➕ Add Item
                            </button>
                        </div>

                        <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
                            {declaredItems.map((item, index) => (
                                <div 
                                    key={item.id} 
                                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3 relative group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-lg bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 text-xs font-black flex items-center justify-center">
                                                #{index + 1}
                                            </span>
                                            <select
                                                value={item.category}
                                                onChange={(e) => handleUpdateItem(index, 'category', e.target.value)}
                                                className="px-2.5 py-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-bold text-slate-800 dark:text-white"
                                            >
                                                {CATEGORY_OPTIONS.map(c => (
                                                    <option key={c.key} value={c.key}>{c.icon} {c.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        {declaredItems.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveItem(index)}
                                                className="text-slate-400 hover:text-red-500 text-xs font-bold p-1"
                                                title="Remove Item"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>

                                    {/* Asset Name (MANDATORY) */}
                                    <div>
                                        <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                                            Item / Asset Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={item.name}
                                            onChange={(e) => handleUpdateItem(index, 'name', e.target.value)}
                                            placeholder={`e.g. Lenovo ThinkPad, Dell Wireless Mouse, HP 24" Monitor`}
                                            className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-slate-100"
                                        />
                                    </div>

                                    {/* Optional Fields Row */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">
                                                Brand (Optional)
                                            </label>
                                            <input
                                                type="text"
                                                value={item.brand || ''}
                                                onChange={(e) => handleUpdateItem(index, 'brand', e.target.value)}
                                                placeholder="e.g. Dell, Lenovo"
                                                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-xs text-slate-800 dark:text-slate-200"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">
                                                Serial / Tag (Optional)
                                            </label>
                                            <input
                                                type="text"
                                                value={item.serialNumber || ''}
                                                onChange={(e) => handleUpdateItem(index, 'serialNumber', e.target.value)}
                                                placeholder="If visible on label"
                                                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-200"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">
                                                Condition (Optional)
                                            </label>
                                            <select
                                                value={item.condition || 'Good'}
                                                onChange={(e) => handleUpdateItem(index, 'condition', e.target.value)}
                                                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-xs text-slate-800 dark:text-slate-200 font-medium"
                                            >
                                                <option value="Good">Good</option>
                                                <option value="Minor Scratches">Minor Scratches</option>
                                                <option value="Damaged">Damaged</option>
                                                <option value="Needs IT Attention">Needs IT Attention</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700">
                            <button
                                type="button"
                                onClick={() => setStep(2)}
                                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
                            >
                                &larr; Back
                            </button>
                            <button
                                type="button"
                                onClick={handleProceedToCrossCheck}
                                className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold rounded-xl shadow-md shadow-brand-500/20 active:scale-95 transition-all flex items-center gap-2"
                            >
                                Verify Against IT Records &rarr;
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 4: Verification Against IT Records */}
                {step === 4 && (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                Verify Current IT Records
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Compare what our database currently has on record for you versus the items you declared.
                            </p>
                        </div>

                        {/* Side-by-Side Comparison */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Official IT Records */}
                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                                    <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                        Official IT Database
                                    </span>
                                    <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[10px] font-bold text-slate-700 dark:text-slate-300">
                                        {userAssignedAssets.length} on record
                                    </span>
                                </div>
                                {userAssignedAssets.length > 0 ? (
                                    <div className="space-y-2 max-h-[160px] overflow-y-auto">
                                        {userAssignedAssets.map(a => (
                                            <div key={a.id} className="p-2.5 rounded-xl bg-white dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 text-xs">
                                                <p className="font-bold text-slate-900 dark:text-white">{a.name}</p>
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                                    Tag: <span className="text-brand-600 dark:text-brand-400 font-bold">{a.assetId}</span> &bull; {a.category}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-500 italic py-4 text-center">
                                        No assets currently recorded under your account.
                                    </p>
                                )}
                            </div>

                            {/* What Employee Declared */}
                            <div className="p-4 rounded-2xl bg-brand-50/40 dark:bg-brand-950/20 border border-brand-200 dark:border-brand-900/40 space-y-2.5">
                                <div className="flex items-center justify-between pb-2 border-b border-brand-200 dark:border-brand-900/40">
                                    <span className="text-xs font-black uppercase tracking-wider text-brand-700 dark:text-brand-300">
                                        What You Declared
                                    </span>
                                    <span className="px-2 py-0.5 bg-brand-100 dark:bg-brand-900/60 rounded text-[10px] font-bold text-brand-700 dark:text-brand-300">
                                        {declaredItems.length} items
                                    </span>
                                </div>
                                <div className="space-y-2 max-h-[160px] overflow-y-auto">
                                    {declaredItems.map(item => (
                                        <div key={item.id} className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-brand-100 dark:border-brand-900/30 text-xs flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-slate-900 dark:text-white">{item.name}</p>
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400">{item.category}</p>
                                            </div>
                                            {item.isGhost ? (
                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-300">
                                                    Unrecorded
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 border border-green-300">
                                                    Matched
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Confirmation Questions */}
                        <div className="space-y-3 pt-2">
                            <label className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                                Do the official IT records accurately reflect what you have?
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setSystemRecordsOk(true)}
                                    className={`py-3 px-4 rounded-xl border text-center font-bold text-xs transition-all ${
                                        systemRecordsOk === true 
                                            ? 'bg-green-600 text-white border-green-600 shadow-md shadow-green-600/20' 
                                            : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'
                                    }`}
                                >
                                    ✅ Yes, Records Match
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSystemRecordsOk(false)}
                                    className={`py-3 px-4 rounded-xl border text-center font-bold text-xs transition-all ${
                                        systemRecordsOk === false 
                                            ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/20' 
                                            : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'
                                    }`}
                                >
                                    ⚠️ Discrepancy / Incorrect
                                </button>
                            </div>

                            {/* Discrepancy Remarks */}
                            {systemRecordsOk === false && (
                                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 space-y-2 animate-fade-in">
                                    <label className="block text-[11px] font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                                        Please describe what is incorrect or missing in our records:
                                    </label>
                                    <textarea
                                        value={discrepancyNotes}
                                        onChange={(e) => setDiscrepancyNotes(e.target.value)}
                                        placeholder="e.g. I never received the keyboard listed, I returned the monitor last month, the serial number is different..."
                                        rows={3}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Ghost Notice */}
                        {ghostAssets.length > 0 && (
                            <div className="p-3.5 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 rounded-xl flex items-center gap-3">
                                <span className="text-xl">📸</span>
                                <p className="text-xs text-purple-900 dark:text-purple-200">
                                    You declared <strong>{ghostAssets.length} unrecorded asset(s)</strong>. Next, snap a quick photo and check condition so IT Admin can register it immediately!
                                </p>
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700">
                            <button
                                type="button"
                                onClick={() => setStep(3)}
                                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
                            >
                                &larr; Back
                            </button>
                            {ghostAssets.length > 0 ? (
                                <button
                                    type="button"
                                    disabled={systemRecordsOk === null}
                                    onClick={() => setStep(5)}
                                    className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-md shadow-purple-600/20 active:scale-95 transition-all flex items-center gap-2"
                                >
                                    Audit Ghost Assets ({ghostAssets.length}) &rarr;
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    disabled={systemRecordsOk === null || isSubmitting}
                                    onClick={handleSubmitFullDeclaration}
                                    className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-md shadow-brand-500/20 active:scale-95 transition-all flex items-center gap-2"
                                >
                                    {isSubmitting ? 'Submitting...' : 'Confirm & Complete Declaration &rarr;'}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* STEP 5: Immediate Ghost Asset Self-Audit (Photo & Condition) */}
                {step === 5 && (
                    <div className="space-y-6 animate-fade-in">
                        {ghostAssets.length > 0 && (
                            <>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-300">
                                            Unrecorded Equipment Audit ({activeGhostIndex + 1} of {ghostAssets.length})
                                        </span>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                                            {ghostAssets[activeGhostIndex]?.name} ({ghostAssets[activeGhostIndex]?.category})
                                        </h3>
                                    </div>
                                    {ghostAssets.length > 1 && (
                                        <div className="flex gap-1">
                                            {ghostAssets.map((g, idx) => (
                                                <button
                                                    key={g.id}
                                                    type="button"
                                                    onClick={() => { stopCamera(); setActiveGhostIndex(idx); }}
                                                    className={`w-7 h-7 rounded-lg text-xs font-bold ${
                                                        activeGhostIndex === idx ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                                                    }`}
                                                >
                                                    {idx + 1}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Location & Condition Inputs for this Ghost Asset */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                                            Current Physical Location
                                        </label>
                                        <select
                                            value={ghostAssets[activeGhostIndex]?.location || 'Head Office'}
                                            onChange={(e) => {
                                                const itemIdx = declaredItems.findIndex(d => d.id === ghostAssets[activeGhostIndex].id);
                                                if (itemIdx !== -1) handleUpdateItem(itemIdx, 'location', e.target.value);
                                            }}
                                            className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-800 dark:text-white"
                                        >
                                            <option value="Head Office">Head Office</option>
                                            <option value="Remote / WFH">Remote / WFH</option>
                                            <option value="Branch / Plant">Branch / Plant</option>
                                            <option value="Client Site">Client Site</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                                            Device Condition
                                        </label>
                                        <select
                                            value={ghostAssets[activeGhostIndex]?.condition || 'Good'}
                                            onChange={(e) => {
                                                const itemIdx = declaredItems.findIndex(d => d.id === ghostAssets[activeGhostIndex].id);
                                                if (itemIdx !== -1) handleUpdateItem(itemIdx, 'condition', e.target.value);
                                            }}
                                            className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-800 dark:text-white"
                                        >
                                            <option value="Good">Good (Working fine)</option>
                                            <option value="Minor Scratches">Minor Scratches</option>
                                            <option value="Damaged">Damaged / Physical defect</option>
                                            <option value="Needs IT Attention">Needs IT Attention / Repair</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Photo Proof for this Ghost Asset */}
                                <div className="space-y-3">
                                    <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                        Photo Proof of Equipment / Label <span className="text-purple-600">(For IT Admin Verification)</span>
                                    </label>

                                    {ghostAssets[activeGhostIndex]?.imageUrl ? (
                                        <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900 max-h-[220px] flex items-center justify-center">
                                            <img 
                                                src={ghostAssets[activeGhostIndex].imageUrl} 
                                                alt="Ghost Asset Preview" 
                                                className="max-h-[220px] object-contain w-full"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const itemIdx = declaredItems.findIndex(d => d.id === ghostAssets[activeGhostIndex].id);
                                                    if (itemIdx !== -1) handleUpdateItem(itemIdx, 'imageUrl', undefined);
                                                }}
                                                className="absolute top-2 right-2 px-3 py-1 bg-black/70 hover:bg-black text-white text-xs font-bold rounded-lg backdrop-blur-md transition-all"
                                            >
                                                Retake Photo
                                            </button>
                                        </div>
                                    ) : isCameraActive ? (
                                        <div className="relative rounded-2xl overflow-hidden bg-black flex flex-col items-center">
                                            <video ref={videoRef} autoPlay playsInline className="w-full h-52 object-cover" />
                                            <div className="absolute bottom-3 flex gap-3">
                                                <button
                                                    type="button"
                                                    onClick={capturePhoto}
                                                    className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs shadow-lg active:scale-95"
                                                >
                                                    📸 Snap Photo
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={stopCamera}
                                                    className="px-3 py-2 bg-black/60 text-white rounded-xl font-bold text-xs"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <button
                                                type="button"
                                                onClick={startCamera}
                                                className="flex-1 py-6 px-4 border-2 border-dashed border-purple-300 dark:border-purple-800/60 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-purple-50/50 dark:hover:bg-purple-950/20 transition-all text-purple-700 dark:text-purple-300"
                                            >
                                                <span className="text-3xl">📷</span>
                                                <span className="text-xs font-bold">Use Camera to Snap Photo</span>
                                                <span className="text-[10px] text-slate-400">Auto-compressed for fast upload</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                className="flex-1 py-6 px-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-slate-600 dark:text-slate-300"
                                            >
                                                <span className="text-3xl">📁</span>
                                                <span className="text-xs font-bold">Upload from Files</span>
                                                <span className="text-[10px] text-slate-400">JPEG, PNG accepted</span>
                                            </button>
                                            <input 
                                                ref={fileInputRef} 
                                                type="file" 
                                                accept="image/*" 
                                                className="hidden" 
                                                onChange={handleFileUpload} 
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700">
                                    <button
                                        type="button"
                                        onClick={() => { stopCamera(); setStep(4); }}
                                        className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
                                    >
                                        &larr; Back
                                    </button>

                                    {activeGhostIndex < ghostAssets.length - 1 ? (
                                        <button
                                            type="button"
                                            onClick={() => { stopCamera(); setActiveGhostIndex(activeGhostIndex + 1); }}
                                            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl shadow-md active:scale-95 transition-all"
                                        >
                                            Next Ghost Asset ({activeGhostIndex + 2} of {ghostAssets.length}) &rarr;
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            disabled={isSubmitting}
                                            onClick={handleSubmitFullDeclaration}
                                            className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold rounded-xl shadow-md shadow-brand-500/20 active:scale-95 transition-all flex items-center gap-2"
                                        >
                                            {isSubmitting ? 'Submitting Declaration...' : 'Submit Complete Declaration &rarr;'}
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default AssetDeclarationModal;
