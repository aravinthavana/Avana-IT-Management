import React, { useState, useMemo } from 'react';
import { Asset } from '../../types';

interface LocationAnalyticsProps {
    assets: Asset[];
    onLocationClick: (locationName: string) => void;
}

export const LocationAnalytics: React.FC<LocationAnalyticsProps> = ({ assets, onLocationClick }) => {
    const [isOtherModalOpen, setIsOtherModalOpen] = useState(false);

    // Categorize locations into Major Corporate Hubs vs Other / Remote
    const locationData = useMemo(() => {
        let chennaiHOCount = 0;
        let mumbaiCount = 0;
        let delhiCount = 0;
        let bangaloreCount = 0;
        let warehouseCount = 0;

        const otherCityMap: { [city: string]: { count: number; assets: Asset[] } } = {};

        assets.forEach(asset => {
            const loc = (asset.location || '').trim();
            const lower = loc.toLowerCase();

            if (lower.includes('warehouse')) {
                warehouseCount++;
            } else if (lower.includes('chennai') || lower === 'chennai -ho' || lower === 'chennai ho') {
                chennaiHOCount++;
            } else if (lower.includes('mumbai')) {
                mumbaiCount++;
            } else if (lower.includes('delhi')) {
                delhiCount++;
            } else if (lower.includes('bangalore') || lower.includes('bengaluru')) {
                bangaloreCount++;
            } else {
                const cityKey = loc || 'Unspecified / Remote';
                if (!otherCityMap[cityKey]) {
                    otherCityMap[cityKey] = { count: 0, assets: [] };
                }
                otherCityMap[cityKey].count++;
                otherCityMap[cityKey].assets.push(asset);
            }
        });

        const otherTotal = Object.values(otherCityMap).reduce((sum, item) => sum + item.count, 0);

        const majorHubs = [
            { label: 'Chennai HO', dbLocation: 'Chennai -HO', count: chennaiHOCount, color: 'bg-brand-500' },
            { label: 'Mumbai Reg. Office', dbLocation: 'Mumbai Reg. Office', count: mumbaiCount, color: 'bg-blue-500' },
            { label: 'Delhi Reg. Office', dbLocation: 'Delhi Reg. Office', count: delhiCount, color: 'bg-purple-500' },
            { label: 'Bangalore Reg. Office', dbLocation: 'Bangalore Reg. Office', count: bangaloreCount, color: 'bg-emerald-500' },
            { label: 'Chennai Warehouse', dbLocation: 'Chennai Warehouse', count: warehouseCount, color: 'bg-slate-500' },
        ];

        // Sort other cities by count descending
        const sortedOtherCities = Object.entries(otherCityMap)
            .map(([city, data]) => ({ city, count: data.count, assets: data.assets }))
            .sort((a, b) => b.count - a.count);

        return {
            majorHubs,
            otherTotal,
            otherCityCount: sortedOtherCities.length,
            sortedOtherCities,
            totalAssets: assets.length
        };
    }, [assets]);

    const maxCount = Math.max(
        ...locationData.majorHubs.map(h => h.count),
        locationData.otherTotal,
        1
    );

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
            <div>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Assets by Location</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Key regional headquarters &amp; field distribution
                        </p>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {assets.length} Total
                    </span>
                </div>

                <div className="space-y-3.5">
                    {/* Major Corporate Hubs */}
                    {locationData.majorHubs.map((hub) => {
                        const pct = locationData.totalAssets > 0 ? ((hub.count / locationData.totalAssets) * 100).toFixed(1) : '0';
                        const barWidth = Math.round((hub.count / maxCount) * 100);

                        return (
                            <div
                                key={hub.label}
                                onClick={() => onLocationClick(hub.dbLocation)}
                                className="group cursor-pointer p-1.5 -mx-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
                                role="button"
                                title={`Click to view assets in ${hub.label}`}
                            >
                                <div className="flex justify-between items-center text-xs mb-1">
                                    <span className="font-semibold text-slate-700 dark:text-slate-300 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors flex items-center gap-1.5">
                                        <span className={`w-2 h-2 rounded-full ${hub.color}`}></span>
                                        <span>{hub.label}</span>
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-slate-400 font-medium">{pct}%</span>
                                        <span className="font-bold text-slate-900 dark:text-white font-mono">{hub.count}</span>
                                    </div>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-700/60 rounded-full h-2 overflow-hidden">
                                    <div
                                        className={`h-2 rounded-full ${hub.color} transition-all duration-500 ease-out group-hover:opacity-90`}
                                        style={{ width: `${barWidth}%` }}
                                    ></div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Single Aggregated Other / Remote Row */}
                    <div
                        onClick={() => setIsOtherModalOpen(true)}
                        className="group cursor-pointer p-2.5 -mx-1.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/60 dark:hover:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/40 transition-all"
                        role="button"
                        title="Click to view full breakdown of all regional & remote field locations"
                    >
                        <div className="flex justify-between items-center text-xs mb-1">
                            <span className="font-bold text-amber-900 dark:text-amber-200 group-hover:text-amber-700 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                <span>Other / Remote</span>
                                <span className="text-[10px] px-1.5 py-0.2 bg-amber-200/70 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 rounded-md font-semibold">
                                    {locationData.otherCityCount} cities
                                </span>
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-amber-700/80 dark:text-amber-300/80 font-medium">
                                    {locationData.totalAssets > 0 ? ((locationData.otherTotal / locationData.totalAssets) * 100).toFixed(1) : '0'}%
                                </span>
                                <span className="font-black text-amber-900 dark:text-amber-200 font-mono">
                                    {locationData.otherTotal}
                                </span>
                                <span className="text-xs text-amber-600 dark:text-amber-400 group-hover:translate-x-0.5 transition-transform">
                                    &rarr;
                                </span>
                            </div>
                        </div>
                        <div className="w-full bg-amber-200/40 dark:bg-amber-900/30 rounded-full h-2 overflow-hidden">
                            <div
                                className="h-2 rounded-full bg-amber-500 transition-all duration-500 ease-out group-hover:opacity-90"
                                style={{ width: `${Math.round((locationData.otherTotal / maxCount) * 100)}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Hint footer */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
                <span>Click any location to filter assets</span>
                <button
                    onClick={() => setIsOtherModalOpen(true)}
                    className="font-semibold text-brand-600 dark:text-brand-400 hover:underline"
                >
                    View Remote ({locationData.otherTotal}) &rarr;
                </button>
            </div>

            {/* MODAL: Full Breakdown of Other / Remote Locations */}
            {isOtherModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
                    onClick={() => setIsOtherModalOpen(false)}
                >
                    <div
                        className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[85vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-gradient-to-r from-amber-500/10 to-orange-500/10">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white">
                                        Field &amp; Remote Offices
                                    </span>
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                        {locationData.otherTotal} total assets across {locationData.otherCityCount} cities
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                                    Regional &amp; Remote Field Locations
                                </h3>
                            </div>
                            <button
                                onClick={() => setIsOtherModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center font-bold text-sm transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body: City-by-city list */}
                        <div className="p-6 overflow-y-auto space-y-3 divide-y divide-slate-100 dark:divide-slate-700/60">
                            {locationData.sortedOtherCities.map((item) => (
                                <div
                                    key={item.city}
                                    className="pt-3 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                >
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-sm text-slate-900 dark:text-white">
                                                {item.city}
                                            </span>
                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                                {item.count} {item.count === 1 ? 'asset' : 'assets'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-md">
                                            {item.assets.map(a => a.name).slice(0, 3).join(', ')}
                                            {item.assets.length > 3 ? ` +${item.assets.length - 3} more` : ''}
                                        </p>
                                    </div>

                                    <button
                                        onClick={() => {
                                            setIsOtherModalOpen(false);
                                            onLocationClick(item.city);
                                        }}
                                        className="px-3.5 py-1.5 bg-brand-50 dark:bg-slate-700 hover:bg-brand-100 text-brand-700 dark:text-brand-300 text-xs font-bold rounded-xl transition-all self-start sm:self-auto flex items-center gap-1 shrink-0"
                                    >
                                        <span>View in Assets</span>
                                        <span>&rarr;</span>
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 flex justify-end">
                            <button
                                onClick={() => setIsOtherModalOpen(false)}
                                className="px-5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-100 transition-colors shadow-sm"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LocationAnalytics;
