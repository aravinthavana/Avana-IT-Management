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
            { code: 'AMD', name: 'Avana Medical Devices', color: 'bg-accent', badgeColor: 'bg-surface text-ink   border-accent ' },
            { code: 'ASSP', name: 'Avana Surgical Specialties', color: 'bg-olive', badgeColor: 'bg-surface text-ink   border-line ' },
            { code: 'ATS', name: 'Avana Technology Solutions', color: 'bg-olive', badgeColor: 'bg-surface text-ink   border-line ' },
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
        <div className="bg-surface p-6 rounded-2xl shadow-sm border border-line flex flex-col justify-between overflow-hidden min-w-0">
            <div className="min-w-0">
                <div className="flex justify-between items-center mb-4">
                    <div className="min-w-0 mr-2">
                        <h3 className="text-base sm:text-lg font-bold text-ink truncate">Company Fleet Analytics</h3>
                        <p className="text-xs text-quiet mt-0.5 truncate">
                            Multi-entity hardware allocation &amp; deployment rate
                        </p>
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-muted text-quiet shrink-0">
                        3 Entities
                    </span>
                </div>

                {/* Comparative Multi-segment bar */}
                <div className="mb-5">
                    <div className="h-3 rounded-full overflow-hidden flex w-full bg-muted">
                        {companyStats.map(comp => (
                            <div
                                key={comp.code}
                                className={`${comp.color} transition-all duration-500 hover:opacity-90`}
                                style={{ width: `${comp.sharePct}%` }}
                                title={`${comp.code}: ${comp.count} assets (${comp.sharePct}%)`}
                            />
                        ))}
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-quiet mt-1.5 px-0.5">
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
                                        ? 'border-accent bg-surface/40  shadow-sm'
                                        : 'border-line  hover:border-line  bg-canvas/50 dark:bg-muted'
                                }`}
                                onClick={() => onSelectCompany(isSelected ? 'All' : comp.code)}
                            >
                                <div className="flex justify-between items-start gap-2 min-w-0">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <span className={`w-7 h-7 rounded-lg ${comp.color} text-on-strong font-black text-xs flex items-center justify-center shadow-sm shrink-0`}>
                                            {comp.code}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <h4 className="font-bold text-xs text-ink truncate">
                                                {comp.name}
                                            </h4>
                                            <p className="text-[11px] text-quiet font-medium truncate">
                                                {comp.laptops} Laptops &bull; {comp.desktops} Desktops
                                            </p>
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                        <span className="text-base font-black text-ink font-mono leading-none">
                                            {comp.count}
                                        </span>
                                        <p className="text-[10px] font-bold text-ink mt-0.5">
                                            {comp.utilizationPct}% Active
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-2.5 pt-2 border-t border-line/60 flex items-center justify-between text-[11px] gap-2 min-w-0">
                                    <div className="flex items-center gap-2 text-quiet text-[10px] truncate">
                                        <span>Assigned: <strong className="text-ink">{comp.assigned}</strong></span>
                                        <span>Stock: <strong className="text-ink">{comp.inStock}</strong></span>
                                        {comp.inRepair > 0 && (
                                            <span className="text-ink">Repair: <strong>{comp.inRepair}</strong></span>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onNavigateToCompanyAssets(comp.code);
                                        }}
                                        className="text-[11px] font-bold text-ink hover:text-ink flex items-center gap-1 shrink-0"
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

            <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-[11px] text-quiet">
                <span>Click a company card to toggle dashboard view</span>
                {selectedCompany !== 'All' && (
                    <button
                        onClick={() => onSelectCompany('All')}
                        className="text-xs font-bold text-ink hover:underline"
                    >
                        Reset Filter
                    </button>
                )}
            </div>
        </div>
    );
};

export default CompanyAnalyticsCard;
