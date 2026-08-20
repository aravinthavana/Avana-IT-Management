import React, { useState, useRef } from 'react';
import Modal from '../ui/Modal';
import { Asset } from '../../types';
import { useAppContext } from '../../hooks/useAppContext';

interface SelfAuditModalProps {
    isOpen: boolean;
    onClose: () => void;
    asset: Asset;
}

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080';

const SelfAuditModal: React.FC<SelfAuditModalProps> = ({ isOpen, onClose, asset }) => {
    const { setNotification, getHeaders } = useAppContext();
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [scannedId, setScannedId] = useState('');
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [remarks, setRemarks] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCameraActive, setIsCameraActive] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

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
            setNotification({ message: 'Could not access camera. Using upload fallback.', type: 'error' });
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

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const context = canvasRef.current.getContext('2d');
            if (context) {
                canvasRef.current.width = videoRef.current.videoWidth;
                canvasRef.current.height = videoRef.current.videoHeight;
                context.drawImage(videoRef.current, 0, 0);
                const dataUrl = canvasRef.current.toDataURL('image/jpeg');
                setImageSrc(dataUrl);
                stopCamera();
                setStep(3);
            }
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
                setImageSrc(loadEvent.target?.result as string);
                setStep(3);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleVerifyScan = () => {
        if (scannedId.trim().toLowerCase() === asset.assetId.trim().toLowerCase()) {
            setNotification({ message: 'QR Code verified successfully.', type: 'success' });
            setStep(2);
        } else {
            setNotification({ message: 'Incorrect Asset ID. Please scan the correct QR code on your laptop.', type: 'error' });
        }
    };

    const handleSimulateScan = () => {
        setScannedId(asset.assetId);
        setNotification({ message: 'Scan simulated.', type: 'info' });
    };

    const handleSubmitAudit = async () => {
        setIsSubmitting(true);
        try {
            const res = await fetch(`${API_URL}/api/self-audits`, {
                method: 'POST',
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify({
                    assetId: asset.id,
                    scannedAssetId: scannedId,
                    imageUrl: imageSrc,
                    remarks
                })
            });

            if (!res.ok) throw new Error('Failed to submit audit');
            setNotification({ message: 'Self Audit submitted successfully for review.', type: 'success' });
            onClose();
        } catch (error: any) {
            setNotification({ message: error.message || 'Error submitting audit', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetModal = () => {
        stopCamera();
        setStep(1);
        setScannedId('');
        setImageSrc(null);
        setRemarks('');
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={resetModal} title={`Self Audit: ${asset.name}`} maxWidth="max-w-md">
            <div className="space-y-6 py-2">
                {/* Stepper Header */}
                <div className="flex justify-between items-center px-4">
                    <span className={`text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center ${step >= 1 ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-600'}`}>1</span>
                    <div className={`flex-1 h-0.5 mx-2 ${step >= 2 ? 'bg-brand-600' : 'bg-slate-200'}`}></div>
                    <span className={`text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center ${step >= 2 ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-600'}`}>2</span>
                    <div className={`flex-1 h-0.5 mx-2 ${step >= 3 ? 'bg-brand-600' : 'bg-slate-200'}`}></div>
                    <span className={`text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center ${step >= 3 ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-600'}`}>3</span>
                </div>

                {step === 1 && (
                    <div className="space-y-4 text-center">
                        <div className="mx-auto w-16 h-16 bg-red-50 dark:bg-red-900/20 text-brand-600 dark:text-red-400 rounded-full flex items-center justify-center text-3xl font-bold">
                            🔍
                        </div>
                        <h3 className="text-base font-bold text-slate-800 dark:text-white">Step 1: Scan QR Code</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Scan the QR label attached to your {asset.category} or enter its Asset ID manually below.</p>
                        
                        <div className="mt-4">
                            <input 
                                type="text" 
                                value={scannedId} 
                                onChange={(e) => setScannedId(e.target.value)} 
                                placeholder="Enter Asset ID manually"
                                className="w-full text-center px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-slate-100"
                            />
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button onClick={handleSimulateScan} className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 py-2 rounded-lg text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                                Simulate Scan
                            </button>
                            <button onClick={handleVerifyScan} disabled={!scannedId.trim()} className="flex-1 bg-brand-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-brand-700 disabled:opacity-50 transition-colors shadow-md">
                                Verify & Proceed
                            </button>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-4 text-center">
                        <div className="mx-auto w-16 h-16 bg-red-50 dark:bg-red-900/20 text-brand-600 dark:text-red-400 rounded-full flex items-center justify-center text-3xl">
                            📷
                        </div>
                        <h3 className="text-base font-bold text-slate-800 dark:text-white">Step 2: Take Asset Photo</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Provide a live picture showing the condition of your {asset.category}.</p>

                        {isCameraActive ? (
                            <div className="relative bg-black rounded-lg overflow-hidden border border-slate-300">
                                <video ref={videoRef} className="w-full h-48 object-cover" playsInline muted></video>
                                <button onClick={capturePhoto} className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white text-slate-900 font-bold px-4 py-2 rounded-full shadow-lg text-xs hover:bg-slate-100">
                                    Capture Image
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3 py-2">
                                <button onClick={startCamera} className="w-full bg-slate-800 text-white py-2.5 rounded-lg text-xs font-bold hover:bg-slate-900 transition-colors flex justify-center items-center gap-2">
                                    <span>📷</span> Open Camera
                                </button>
                                <label className="w-full cursor-pointer bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 py-2.5 rounded-lg text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-center">
                                    <span>📁</span> Upload Photo Instead
                                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                                </label>
                            </div>
                        )}
                        <canvas ref={canvasRef} className="hidden"></canvas>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-4">
                        <h3 className="text-base font-bold text-slate-800 dark:text-white text-center">Step 3: Submit Verification</h3>
                        {imageSrc && (
                            <div className="relative w-full h-32 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700">
                                <img src={imageSrc} alt="Captured asset" className="w-full h-full object-cover" />
                                <button onClick={() => setStep(2)} className="absolute top-2 right-2 bg-slate-900/70 text-white p-1 rounded-full text-xs" title="Retake Photo">
                                    ✖
                                </button>
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Remarks / Condition Notes</label>
                            <textarea 
                                value={remarks} 
                                onChange={(e) => setRemarks(e.target.value)} 
                                rows={3} 
                                placeholder="Describe current state (e.g. Good condition, small scratch on lid)"
                                className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-slate-100"
                            ></textarea>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button onClick={() => setStep(2)} className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 py-2 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors">
                                Back
                            </button>
                            <button onClick={handleSubmitAudit} disabled={isSubmitting || !imageSrc} className="flex-1 bg-green-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-green-700 disabled:opacity-50 transition-colors shadow-md">
                                {isSubmitting ? 'Submitting...' : 'Submit Self Audit'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default SelfAuditModal;
