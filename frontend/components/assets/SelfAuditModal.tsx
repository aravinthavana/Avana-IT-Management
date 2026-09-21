import React, { useState, useRef } from 'react';
import Modal from '../ui/Modal';
import { Asset, SelfAudit } from '../../types';
import { useAppContext } from '../../hooks/useAppContext';
import { ASSET_ICONS } from '../../constants';

interface SelfAuditModalProps {
    isOpen: boolean;
    onClose: () => void;
    asset: Asset;
    auditRecord?: SelfAudit | null;
    onSubmitted?: () => void;
}

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080';

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

const SelfAuditModal: React.FC<SelfAuditModalProps> = ({ isOpen, onClose, asset, auditRecord, onSubmitted }) => {
    const { setNotification, getHeaders, fetchAllData } = useAppContext();
    const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

    // Step 1 State: Asset ID & Location
    const [scannedId, setScannedId] = useState(asset.assetId || '');
    const [location, setLocation] = useState<'Head Office' | 'Remote / WFH' | 'Branch / Plant' | 'Client Site'>('Head Office');

    // Step 2 State: Structured Hardware Checklist
    const [condition, setCondition] = useState<'Good' | 'Minor Scratches' | 'Damaged' | 'Needs IT Attention'>('Good');
    const [screenOk, setScreenOk] = useState(true);
    const [keyboardOk, setKeyboardOk] = useState(true);
    const [batteryOk, setBatteryOk] = useState(true);
    const [chargerOk, setChargerOk] = useState(true);
    const [bodyOk, setBodyOk] = useState(true);

    // Step 3 State: Photo Proof
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const phoneCameraInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Step 4 State: Remarks
    const [userRemarks, setUserRemarks] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const icon = ASSET_ICONS[asset.category] || ASSET_ICONS.default;

    // Camera control
    const startCamera = async () => {
        setIsCameraActive(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }
        } catch (err) {
            console.error('Camera access denied or unavailable', err);
            setNotification({ message: 'Could not access camera. Please upload a photo instead.', type: 'error' });
            setIsCameraActive(false);
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            const tracks = stream.getTracks();
            tracks.forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setIsCameraActive(false);
    };

    const capturePhoto = async () => {
        if (videoRef.current && canvasRef.current) {
            const context = canvasRef.current.getContext('2d');
            if (context) {
                canvasRef.current.width = videoRef.current.videoWidth;
                canvasRef.current.height = videoRef.current.videoHeight;
                context.drawImage(videoRef.current, 0, 0);
                const rawData = canvasRef.current.toDataURL('image/jpeg', 0.9);
                stopCamera();
                const compressed = await compressImage(rawData);
                setImageSrc(compressed);
                setStep(4);
            }
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const compressed = await compressImage(file);
                setImageSrc(compressed);
                setStep(4);
            } catch (err) {
                setNotification({ message: 'Failed to process image file.', type: 'error' });
            }
        }
    };

    const handleVerifyStep1 = () => {
        if (!scannedId.trim()) {
            setNotification({ message: 'Please enter or confirm your Asset ID.', type: 'error' });
            return;
        }
        if (scannedId.trim().toLowerCase() !== asset.assetId.trim().toLowerCase()) {
            setNotification({ message: `Asset ID does not match assigned asset (${asset.assetId}). Please verify label.`, type: 'error' });
            return;
        }
        setStep(2);
    };

    const handleSubmitAudit = async () => {
        setIsSubmitting(true);
        try {
            const hardwareChecks = {
                screenOk,
                keyboardOk,
                batteryOk,
                chargerOk,
                bodyOk
            };

            const res = await fetch(`${API_URL}/api/self-audits`, {
                method: 'POST',
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify({
                    assetId: asset.id,
                    scannedAssetId: scannedId.trim(),
                    imageUrl: imageSrc,
                    location,
                    condition,
                    hardwareChecks,
                    userRemarks: userRemarks.trim()
                })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to submit self-audit');
            }

            setNotification({ message: 'Equipment self-audit submitted successfully for IT review!', type: 'success' });
            if (onSubmitted) onSubmitted();
            fetchAllData().catch(() => {});
            resetModal();
        } catch (error: any) {
            setNotification({ message: error.message || 'Error submitting audit', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetModal = () => {
        stopCamera();
        setStep(1);
        setScannedId(asset.assetId || '');
        setImageSrc(null);
        setUserRemarks('');
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={resetModal} title={`Equipment Self-Audit: ${asset.name}`} maxWidth="max-w-xl">
            <div className="space-y-4 sm:space-y-5 py-1">
                {/* Stepper Header */}
                <div className="flex justify-between items-center px-1 sm:px-4">
                    {[
                        { num: 1, label: 'Location' },
                        { num: 2, label: 'Health' },
                        { num: 3, label: 'Photo' },
                        { num: 4, label: 'Submit' }
                    ].map((st, i, arr) => (
                        <React.Fragment key={st.num}>
                            <div className="flex flex-col items-center">
                                <span className={`text-[10px] sm:text-xs font-bold rounded-full h-6 w-6 sm:h-7 sm:w-7 flex items-center justify-center transition-colors ${step >= st.num ? 'bg-brand-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>{st.num}</span>
                                <span className="text-[9px] sm:text-[10px] font-semibold text-slate-500 mt-1">{st.label}</span>
                            </div>
                            {i < arr.length - 1 && (
                                <div className={`flex-1 h-0.5 mx-1.5 sm:mx-2 ${step > st.num ? 'bg-brand-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
                            )}
                        </React.Fragment>
                    ))}
                </div>

                {/* Step 1: Asset ID Verification & Location */}
                {step === 1 && (
                    <div className="space-y-3.5 sm:space-y-4">
                        {/* Mobile Camera Tip */}
                        <div className="p-3 sm:p-3.5 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-purple-500/10 border border-blue-200 dark:border-blue-800/50 rounded-xl flex items-start gap-2.5 text-[11px] sm:text-xs text-blue-950 dark:text-blue-200">
                            <span className="text-lg sm:text-xl shrink-0">📱</span>
                            <div className="leading-snug min-w-0">
                                <strong className="text-blue-700 dark:text-blue-300">Camera Required — Mobile Recommended:</strong> Because this audit requires capturing photos of your device and serial tag, we recommend opening this portal on your <strong>mobile phone browser</strong> to easily snap photos with your phone camera.
                            </div>
                        </div>

                        <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl flex items-center gap-3 sm:gap-4">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0 border border-brand-200 dark:border-brand-900/50">
                                <div className="w-5 h-5 sm:w-6 sm:h-6">{icon}</div>
                            </div>
                            <div className="min-w-0">
                                <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">{asset.name}</h4>
                                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                                    Tag: <span className="font-mono font-bold text-brand-600 dark:text-brand-400">{asset.assetId}</span> &bull; S/N: <code className="font-mono">{asset.serialNumber || 'N/A'}</code>
                                </p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                                Confirm Asset Tag / ID
                            </label>
                            <input 
                                type="text" 
                                value={scannedId} 
                                onChange={(e) => setScannedId(e.target.value)} 
                                placeholder="Enter Asset ID Tag"
                                className="w-full px-3 py-2 sm:py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-mono focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-slate-100"
                            />
                            <p className="text-[11px] text-slate-400 mt-1">
                                Enter the ID printed on the Avana IT label on your device.
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                                Current Physical Work Location
                            </label>
                            <select
                                value={location}
                                onChange={(e) => setLocation(e.target.value as any)}
                                className="w-full px-3 py-2 sm:py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-slate-100 font-medium"
                            >
                                <option value="Head Office">Head Office (On-Premises)</option>
                                <option value="Remote / WFH">Remote / Work from Home</option>
                                <option value="Branch / Plant">Branch / Plant Facility</option>
                                <option value="Client Site">Client Site / On Field</option>
                            </select>
                        </div>

                        <div className="flex justify-end pt-3 sm:pt-4 border-t border-slate-200 dark:border-slate-700">
                            <button
                                type="button"
                                onClick={handleVerifyStep1}
                                className="w-full sm:w-auto px-5 py-2.5 bg-brand-600 hover:bg-brand-700 active:scale-98 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                            >
                                Next: Hardware Health &rarr;
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 2: Structured Hardware Health Checklist */}
                {step === 2 && (
                    <div className="space-y-3.5 sm:space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                                Overall Physical Condition
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {[
                                    { val: 'Good', label: 'Good (No Damage)' },
                                    { val: 'Minor Scratches', label: 'Minor Scratches / Wear' },
                                    { val: 'Damaged', label: 'Noticeable Dents / Cracks' },
                                    { val: 'Needs IT Attention', label: 'Needs Immediate Repair' }
                                ].map(c => (
                                    <button
                                        key={c.val}
                                        type="button"
                                        onClick={() => setCondition(c.val as any)}
                                        className={`p-2.5 text-xs font-semibold rounded-xl border text-left transition-all active:scale-98 ${
                                            condition === c.val
                                                ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 ring-1 ring-brand-500'
                                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                                        }`}
                                    >
                                        {c.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                Functional Component Checks
                            </label>
                            <div className="space-y-1 sm:space-y-1.5 bg-slate-50 dark:bg-slate-800/60 p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
                                <label className="flex items-center justify-between cursor-pointer py-1 gap-2">
                                    <span className="text-slate-800 dark:text-slate-200 font-medium text-[11px] sm:text-xs">Display / Screen: Clear, no lines or cracks</span>
                                    <input type="checkbox" checked={screenOk} onChange={e => setScreenOk(e.target.checked)} className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 shrink-0" />
                                </label>
                                <label className="flex items-center justify-between cursor-pointer py-1 border-t border-slate-200 dark:border-slate-700 gap-2">
                                    <span className="text-slate-800 dark:text-slate-200 font-medium text-[11px] sm:text-xs">Keyboard &amp; Trackpad: All keys functioning properly</span>
                                    <input type="checkbox" checked={keyboardOk} onChange={e => setKeyboardOk(e.target.checked)} className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 shrink-0" />
                                </label>
                                <label className="flex items-center justify-between cursor-pointer py-1 border-t border-slate-200 dark:border-slate-700 gap-2">
                                    <span className="text-slate-800 dark:text-slate-200 font-medium text-[11px] sm:text-xs">Battery Backup: Holds charge normally (2+ hrs)</span>
                                    <input type="checkbox" checked={batteryOk} onChange={e => setBatteryOk(e.target.checked)} className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 shrink-0" />
                                </label>
                                <label className="flex items-center justify-between cursor-pointer py-1 border-t border-slate-200 dark:border-slate-700 gap-2">
                                    <span className="text-slate-800 dark:text-slate-200 font-medium text-[11px] sm:text-xs">Power Adapter / Charger: Cord intact, no cuts</span>
                                    <input type="checkbox" checked={chargerOk} onChange={e => setChargerOk(e.target.checked)} className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 shrink-0" />
                                </label>
                                <label className="flex items-center justify-between cursor-pointer py-1 border-t border-slate-200 dark:border-slate-700 gap-2">
                                    <span className="text-slate-800 dark:text-slate-200 font-medium text-[11px] sm:text-xs">Physical Hinges &amp; Casing: Intact and sturdy</span>
                                    <input type="checkbox" checked={bodyOk} onChange={e => setBodyOk(e.target.checked)} className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 shrink-0" />
                                </label>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-slate-200 dark:border-slate-700 gap-2">
                            <button type="button" onClick={() => setStep(1)} className="px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl">
                                &larr; Back
                            </button>
                            <button type="button" onClick={() => setStep(3)} className="px-4 sm:px-5 py-2 sm:py-2.5 bg-brand-600 hover:bg-brand-700 active:scale-98 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm">
                                Next: Photo Proof &rarr;
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Photo Proof with Client-Side Compression */}
                {step === 3 && (
                    <div className="space-y-3.5 sm:space-y-4 text-center">
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 rounded-xl text-xs text-left border border-blue-200 dark:border-blue-900/40 leading-relaxed">
                            <strong>Photo Requirement:</strong> Please capture a clear, lit photo showing the device screen, keyboard, or asset label.
                        </div>

                        {isCameraActive ? (
                            <div className="relative bg-black rounded-xl sm:rounded-2xl overflow-hidden border border-slate-300 shadow-inner">
                                <video ref={videoRef} className="w-full h-48 sm:h-56 object-cover" autoPlay playsInline muted />
                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
                                    <button onClick={capturePhoto} className="bg-white text-slate-900 font-bold px-4 sm:px-5 py-2 sm:py-2.5 rounded-full shadow-lg text-xs hover:bg-slate-100 flex items-center gap-1.5 active:scale-95">
                                        <span>📸</span> Capture Photo
                                    </button>
                                    <button onClick={stopCamera} className="bg-black/60 text-white font-bold px-3 py-2 sm:py-2.5 rounded-full text-xs hover:bg-black/80">
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 py-1 sm:py-2">
                                <button 
                                    type="button" 
                                    onClick={() => phoneCameraInputRef.current?.click()} 
                                    className="w-full bg-brand-600 hover:bg-brand-700 active:scale-98 text-white py-3 px-4 rounded-xl text-xs font-bold transition-all flex justify-center items-center gap-2 shadow-sm min-h-[46px]"
                                >
                                    <span>📱</span> Snap with Phone Camera
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => fileInputRef.current?.click()} 
                                    className="w-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-98 text-slate-700 dark:text-slate-200 py-3 px-4 rounded-xl text-xs font-bold transition-all flex justify-center items-center gap-2 min-h-[46px]"
                                >
                                    <span>📁</span> Upload Photo from Device
                                </button>
                                <button 
                                    type="button" 
                                    onClick={startCamera} 
                                    className="col-span-1 sm:col-span-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 py-1 text-[11px] font-medium transition-colors"
                                >
                                    Or open live webcam &rarr;
                                </button>
                                <input 
                                    ref={phoneCameraInputRef} 
                                    type="file" 
                                    accept="image/*" 
                                    capture="environment" 
                                    className="hidden" 
                                    onChange={handleFileUpload} 
                                />
                                <input 
                                    ref={fileInputRef} 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={handleFileUpload} 
                                />
                            </div>
                        )}
                        <canvas ref={canvasRef} className="hidden" />

                        <div className="flex justify-start pt-2 border-t border-slate-200 dark:border-slate-700">
                            <button type="button" onClick={() => { stopCamera(); setStep(2); }} className="px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl">
                                &larr; Back
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 4: Remarks & Final Submission */}
                {step === 4 && (
                    <div className="space-y-3.5 sm:space-y-4">
                        {imageSrc && (
                            <div className="relative w-full h-36 sm:h-44 rounded-xl sm:rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                                <img src={imageSrc} alt="Audit verification proof" className="w-full h-full object-cover" />
                                <button 
                                    onClick={() => setStep(3)} 
                                    className="absolute top-2 right-2 bg-black/70 hover:bg-black text-white px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-sm"
                                    title="Retake Photo"
                                >
                                    Retake Photo
                                </button>
                            </div>
                        )}

                        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                            <p><span className="font-semibold text-slate-500">Location:</span> {location}</p>
                            <p><span className="font-semibold text-slate-500">Condition:</span> {condition}</p>
                            <p><span className="font-semibold text-slate-500">Checks:</span> Screen {screenOk ? '✓' : '✗'}, Keyboard {keyboardOk ? '✓' : '✗'}, Battery {batteryOk ? '✓' : '✗'}, Charger {chargerOk ? '✓' : '✗'}</p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                                Additional Remarks / Issue Descriptions (Optional)
                            </label>
                            <textarea 
                                value={userRemarks} 
                                onChange={(e) => setUserRemarks(e.target.value)} 
                                rows={2} 
                                placeholder="Detail any hardware problems, recent software issues, or general remarks..."
                                className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-slate-100"
                            />
                        </div>

                        <div className="flex flex-col-reverse sm:flex-row justify-between items-center pt-3 sm:pt-4 border-t border-slate-200 dark:border-slate-700 gap-2">
                            <button type="button" onClick={() => setStep(3)} className="w-full sm:w-auto px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl text-center">
                                &larr; Back
                            </button>
                            <button 
                                type="button" 
                                onClick={handleSubmitAudit} 
                                disabled={isSubmitting || !imageSrc} 
                                className="w-full sm:w-auto px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs sm:text-sm font-bold disabled:opacity-50 transition-all shadow-sm flex items-center justify-center gap-2 min-h-[44px]"
                            >
                                {isSubmitting ? (
                                    <>
                                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Submitting...</span>
                                    </>
                                ) : (
                                    'Submit Self-Audit'
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default SelfAuditModal;
