import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../hooks/useAppContext';

interface UserAccessory {
    id: number;
    name: string;
    category: string;
    brand?: string;
    serialNumber?: string;
    condition?: string;
    status: string;
    assignedAt: string;
    warrantyEndDate?: string;
    batch?: { name: string; invoiceNumber?: string };
}

interface MyAccessoriesCardProps {
    userId: number;
    onNavigateAssets: () => void;
}

const CATEGORY_ICON: Record<string, string> = {
    Mouse: '🖱️',
    Keyboard: '⌨️',
    Headset: '🎧',
    Monitor: '🖥️',
    'Pen Drive': '💾',
    Dock: '🔌',
    Bag: '🎒',
    Adapter: '🔋',
    Other: '📦',
};

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080';

const MyAccessoriesCard: React.FC<MyAccessoriesCardProps> = ({ userId }) => {
    const { getHeaders } = useAppContext();
    const [accessories, setAccessories] = useState<UserAccessory[]>([]);
    const [loading, setLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(true);

    useEffect(() => {
        const fetchAccessories = async () => {
            try {
                const res = await fetch(`${API_URL}/api/users/${userId}/accessories`, {
                    headers: getHeaders(),
                    credentials: 'include',
                });
                if (res.ok) {
                    const data = await res.json();
                    // Only show currently assigned accessories
                    setAccessories(data.filter((a: UserAccessory) => a.status === 'Assigned'));
                }
            } catch {
                // Silently fail — not critical for the user portal
            } finally {
                setLoading(false);
            }
        };
        fetchAccessories();
    }, [userId, getHeaders]);

    if (loading) return null; // Don't flash a skeleton card
    if (accessories.length === 0) return null; // Clean — only show if accessories exist

    const getWarrantyBadge = (warrantyEndDate?: string) => {
        if (!warrantyEndDate) return null;
        const today = new Date();
        const exp = new Date(warrantyEndDate);
        const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft < 0) return { label: 'Warranty Expired', color: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300' };
        if (daysLeft <= 30) return { label: `Expiring in ${daysLeft}d`, color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' };
        return { label: `Under Warranty`, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' };
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div
                className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 cursor-pointer"
                onClick={() => setIsExpanded(prev => !prev)}
            >
                <div className="flex items-center gap-3">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-tight">
                        My Peripherals & Accessories
                    </h3>
                    <span className="px-2.5 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full text-xs font-bold">
                        {accessories.length}
                    </span>
                </div>
                <span className="text-slate-400 text-xs font-bold select-none">
                    {isExpanded ? '▲ Hide' : '▼ Show'}
                </span>
            </div>

            {isExpanded && (
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {accessories.map(acc => {
                        const icon = CATEGORY_ICON[acc.category] ?? '📦';
                        const warrantyBadge = getWarrantyBadge(acc.warrantyEndDate);
                        return (
                            <div key={acc.id} className="px-6 py-3.5 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xl shrink-0 shadow-inner">
                                    {icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-semibold text-slate-900 dark:text-white text-sm">{acc.name}</p>
                                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                            {acc.category}
                                        </span>
                                        {warrantyBadge && (
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${warrantyBadge.color}`}>
                                                🛡️ {warrantyBadge.label}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        {acc.brand && <span className="mr-2">{acc.brand}</span>}
                                        {acc.serialNumber && <span className="font-mono mr-2">S/N: {acc.serialNumber}</span>}
                                        {acc.condition && <span>{acc.condition}</span>}
                                    </p>
                                </div>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0">
                                    Issued {new Date(acc.assignedAt).toLocaleDateString()}
                                </p>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default MyAccessoriesCard;
