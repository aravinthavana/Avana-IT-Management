import React, { useMemo } from 'react';
import { Asset } from '../../types';

interface CompanyAnalyticsCardProps {
    assets: Asset[];
    selectedCompany: string;
    onSelectCompany: (company: string) => void;
    onNavigateToCompanyAssets: (company: string) => void;
}

export const CompanyAnalyticsCard: React.FC<CompanyAnalyticsCardProps> = ({
    assets,
    selectedCompany,
    onSelectCompany,
    onNavigateToCompanyAssets
}) => {
    const companyStats = useMemo(() => {
        const companies = [
            { code: 'AMD', name: 'Avana Medical Devices', color: 'bg-brand-600', badgeColor: 'bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300 border-brand-200 dark:border-brand-800' },
            { code: 'ASSP', name: 'Avana Surgical Specialties', color: 'bg-emerald-600', badgeColor: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
            { code: 'ATS', name: 'Avana Technology Solutions', color: 'bg-purple-600', badgeColor: 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800' },
        ];

        const totalAssets = assets.length;

        return companies.map(comp => {
            const compAssets = assets.filter(a => (a.company || '').toUpperCase() === comp.code);
            const count = compAssets.length;
            const laptops = compAssets.filter(a => a.category === 'Laptop').length;
            const desktops = compAssets.filter(a => a.category === 'Desktop').length;
            const assigned = compAssets.filter(a => a.status === 'Assigned').length;
            const inStock = compAssets.filter(a => a.status === 'In Stock').length;
            const inRepair = compAssets.filter(a => a.status === 'In Repair' || a.status === 'Under Inspection').length;
            const utilizationPct = count > 0 ? ((assigned / count) * 100).toFixed(0) : '0';
            const sharePct = totalAssets > 0 ? ((count / totalAssets) * 100).toFixed(1) : '0';

            return {
                ...comp,
                count,
                laptops,
                desktops,
                assigned,
                inStock,
                inRepair,
                utilizationPct,
                sharePct
            };
        });
    }, [assets]);

    return (
        <div className="p-6 rounded-2xl shadow-sm border flex flex-col justify-between overflow-hidden min-w-0 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <div className="min-w-0">
                <div className="flex justify-between items-center mb-4">
                    <div className="min-w-0 mr-2">
                        <h3 className="text-base sm:text-lg font-bold truncate text-slate-900 dark:text-white">Company Fleet Analytics</h3>
                        <p className="text-xs mt-0.5 truncate text-slate-500 dark:text-slate-400">
                            Multi-entity hardware allocation &amp; deployment rate
                        </p>
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full shrink-0 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        3 Entities
                    </span>
                </div>

                {/* Comparative Multi-segment bar */}
                <div className="mb-5">
                    <div className="h-3 rounded-full overflow-hidden flex w-full bg-slate-100 dark:bg-slate-700">
                        {companyStats.map(comp => (
                            <div
                                key={comp.code}
                                className={`${comp.color} transition-all duration-500 hover:opacity-90`}
                                style={{ width: `${comp.sharePct}%` }}
                                title={`${comp.code}: ${comp.count} assets (${comp.sharePct}%)`}
                            />
                        ))}
                    </div>
                    <div className="flex justify-between items-center text-[10px] mt-1.5 px-0.5 text-slate-400">
                        {companyStats.map(comp => (
                            <span key={comp.code} className="flex items-center gap-1 font-medium">
                                <span className={`w-1.5 h-1.5 rounded-full ${comp.color}`}></span>
                                <span>{comp.code} ({comp.sharePct}%)</span>
                            </span>
                        ))}
                    </div>
                </div>

                {/* Company Breakdown Cards */}
                <div className="space-y-3">
                    {companyStats.map(comp => {
                        const isSelected = selectedCompany === comp.code;

                        return (
                            <div
                                key={comp.code}
                                className={`p-3.5 rounded-xl border transition-all cursor-pointer min-w-0 ${
                                    isSelected
                                        ? 'shadow-sm border-brand-500 bg-brand-50/40 dark:bg-brand-950/20'
                                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-850'
                                }`}
                                onClick={() => onSelectCompany(isSelected ? 'All' : comp.code)}
                            >
                                <div className="flex justify-between items-start gap-2 min-w-0">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <span className={`w-7 h-7 rounded-lg ${comp.color} font-black text-xs flex items-center justify-center shadow-sm shrink-0 text-white`}>
                                            {comp.code}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <h4 className="font-bold text-xs truncate text-slate-900 dark:text-white">
                                                {comp.name}
                                            </h4>
                                            <p className="text-[11px] font-medium truncate text-slate-500 dark:text-slate-400">
                                                {comp.laptops} Laptops &bull; {comp.desktops} Desktops
                                            </p>
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                        <span className="text-base font-black font-mono leading-none text-slate-900 dark:text-white">
                                            {comp.count}
                                        </span>
                                        <p className="text-[10px] font-bold mt-0.5 text-emerald-600 dark:text-emerald-400">
                                            {comp.utilizationPct}% Active
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-2.5 pt-2 border-t flex items-center justify-between text-[11px] gap-2 min-w-0 border-slate-200/60 dark:border-slate-700/60">
                                    <div className="flex items-center gap-2 text-[10px] truncate text-slate-500 dark:text-slate-400">
                                        <span>Assigned: <strong className="text-slate-700 dark:text-slate-200">{comp.assigned}</strong></span>
                                        <span>Stock: <strong className="text-slate-700 dark:text-slate-200">{comp.inStock}</strong></span>
                                        {comp.inRepair > 0 && (
                                            <span className="text-amber-600 dark:text-amber-400">Repair: <strong>{comp.inRepair}</strong></span>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onNavigateToCompanyAssets(comp.code);
                                        }}
                                        className="text-[11px] font-bold flex items-center gap-1 shrink-0 text-brand-600 hover:text-brand-700 dark:text-brand-400"
                                    >
                                        <span>View</span>
                                        <span>&rarr;</span>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="mt-4 pt-3 border-t flex items-center justify-between text-[11px] border-slate-100 dark:border-slate-700/60 text-slate-400">
                <span>Click a company card to toggle dashboard view</span>
                {selectedCompany !== 'All' && (
                    <button
                        onClick={() => onSelectCompany('All')}
                        className="text-xs font-bold hover:underline text-brand-600 dark:text-brand-400"
                    >
                        Reset Filter
                    </button>
                )}
            </div>
        </div>
    );
};

export default CompanyAnalyticsCard;
