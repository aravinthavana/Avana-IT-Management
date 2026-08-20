import React, { useState } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { SelfAudit } from '../../types';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080';

const SelfAuditsList: React.FC = () => {
    const { selfAudits, setSelfAudits, getHeaders, setNotification } = useAppContext();
    const [selectedAudit, setSelectedAudit] = useState<SelfAudit | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleReview = (audit: SelfAudit) => {
        setSelectedAudit(audit);
    };

    const handleUpdateStatus = async (status: 'Approved' | 'Rejected') => {
        if (!selectedAudit) return;
        setIsSubmitting(true);
        try {
            const res = await fetch(`${API_URL}/api/self-audits/${selectedAudit.id}/status`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({ status }),
                credentials: 'include'
            });

            if (res.ok) {
                const updatedAudit = await res.json();
                setSelfAudits(selfAudits.map(a => a.id === updatedAudit.id ? updatedAudit : a));
                setNotification({ message: `Self-Audit successfully ${status.toLowerCase()}`, type: 'success' });
                setSelectedAudit(null);
            } else {
                const error = await res.json();
                setNotification({ message: error.error || `Failed to ${status.toLowerCase()} audit`, type: 'error' });
            }
        } catch (error) {
            console.error('Error updating audit status:', error);
            setNotification({ message: 'An unexpected error occurred.', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <svg className="w-6 h-6 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Pending Self-Audits
                </h1>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-800/50">
                            <tr>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">User</th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Asset</th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                                <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-800">
                            {selfAudits.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                                        <div className="flex flex-col items-center">
                                            <svg className="w-12 h-12 mb-3 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <p className="text-lg font-medium">No pending audits</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                selfAudits.map((audit) => (
                                    <tr key={audit.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                                            {new Date(audit.auditDate).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">
                                            {audit.user?.name || `User #${audit.userId}`}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                                            {audit.asset?.name || `Asset #${audit.assetId}`}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                                audit.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' :
                                                audit.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' :
                                                'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
                                            }`}>
                                                {audit.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            {audit.status === 'Pending Review' && (
                                                <button
                                                    onClick={() => handleReview(audit)}
                                                    className="inline-flex items-center text-brand-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 px-3 py-1.5 rounded-lg transition-colors"
                                                >
                                                    Review
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Review Modal */}
            {selectedAudit && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <svg className="w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                Review Self-Audit
                            </h3>
                            <button onClick={() => setSelectedAudit(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">User</p>
                                    <p className="font-semibold text-slate-900 dark:text-white mt-1">{selectedAudit.user?.name}</p>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Asset</p>
                                    <p className="font-semibold text-slate-900 dark:text-white mt-1">{selectedAudit.asset?.name}</p>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Scanned Asset ID</p>
                                    <p className="font-mono text-slate-900 dark:text-white mt-1">{selectedAudit.scannedAssetId || 'N/A'}</p>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Date</p>
                                    <p className="text-slate-900 dark:text-white mt-1">{new Date(selectedAudit.auditDate).toLocaleString()}</p>
                                </div>
                            </div>
                            
                            {selectedAudit.remarks && (
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Remarks</h4>
                                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm">
                                        {selectedAudit.remarks}
                                    </div>
                                </div>
                            )}

                            {selectedAudit.imageUrl && (
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Photo Proof</h4>
                                    <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-center">
                                        <img src={selectedAudit.imageUrl} alt="Audit Proof" className="max-h-96 object-contain" />
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex justify-end gap-3 shrink-0">
                            <button
                                onClick={() => setSelectedAudit(null)}
                                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleUpdateStatus('Rejected')}
                                disabled={isSubmitting}
                                className="px-4 py-2 text-sm font-medium text-white bg-brand-600 border border-transparent rounded-lg hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 transition-colors"
                            >
                                Reject
                            </button>
                            <button
                                onClick={() => handleUpdateStatus('Approved')}
                                disabled={isSubmitting}
                                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 border border-transparent rounded-lg hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-colors"
                            >
                                {isSubmitting ? 'Processing...' : 'Approve'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SelfAuditsList;
