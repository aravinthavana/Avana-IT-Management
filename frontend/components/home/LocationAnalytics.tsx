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
            { label: 'Chennai HO', dbLocation: 'Chennai -HO', count: chennaiHOCount, color: 'bg-accent' },
            { label: 'Mumbai Reg. Office', dbLocation: 'Mumbai Reg. Office', count: mumbaiCount, color: 'bg-olive' },
            { label: 'Delhi Reg. Office', dbLocation: 'Delhi Reg. Office', count: delhiCount, color: 'bg-olive' },
            { label: 'Bangalore Reg. Office', dbLocation: 'Bangalore Reg. Office', count: bangaloreCount, color: 'bg-olive' },
            { label: 'Chennai Warehouse', dbLocation: 'Chennai Warehouse', count: warehouseCount, color: 'bg-strong' },
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
        <div className="bg-surface p-6 rounded-2xl shadow-sm border border-line flex flex-col justify-between">
            <div>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-ink">Assets by Location</h3>
                        <p className="text-xs text-quiet mt-0.5">
                            Key regional headquarters &amp; field distribution
                        </p>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-muted text-quiet">
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
                                className="group cursor-pointer p-1.5 -mx-1.5 rounded-xl hover:bg-canvas transition-colors"
                                role="button"
                                title={`Click to view assets in ${hub.label}`}
                            >
                                <div className="flex justify-between items-center text-xs mb-1">
                                    <span className="font-semibold text-ink group-hover:text-ink transition-colors flex items-center gap-1.5">
                                        <span className={`w-2 h-2 rounded-full ${hub.color}`}></span>
                                        <span>{hub.label}</span>
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-quiet font-medium">{pct}%</span>
                                        <span className="font-bold text-ink font-mono">{hub.count}</span>
                                    </div>
                                </div>
                                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
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
                        className="group cursor-pointer p-2.5 -mx-1.5 rounded-xl bg-surface/50 hover:bg-surface/60 border border-line/60 transition-all"
                        role="button"
                        title="Click to view full breakdown of all regional & remote field locations"
                    >
                        <div className="flex justify-between items-center text-xs mb-1">
                            <span className="font-bold text-ink group-hover:text-ink flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-olive"></span>
                                <span>Other / Remote</span>
                                <span className="text-[10px] px-1.5 py-0.2 bg-surface/70 text-ink rounded-md font-semibold">
                                    {locationData.otherCityCount} cities
                                </span>
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-ink font-medium">
                                    {locationData.totalAssets > 0 ? ((locationData.otherTotal / locationData.totalAssets) * 100).toFixed(1) : '0'}%
                                </span>
                                <span className="font-black text-ink font-mono">
                                    {locationData.otherTotal}
                                </span>
                                <span className="text-xs text-ink group-hover:translate-x-0.5 transition-transform">
                                    &rarr;
                                </span>
                            </div>
                        </div>
                        <div className="w-full bg-surface/40 rounded-full h-2 overflow-hidden">
                            <div
                                className="h-2 rounded-full bg-olive transition-all duration-500 ease-out group-hover:opacity-90"
                                style={{ width: `${Math.round((locationData.otherTotal / maxCount) * 100)}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Hint footer */}
            <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-[11px] text-quiet">
                <span>Click any location to filter assets</span>
                <button
                    onClick={() => setIsOtherModalOpen(true)}
                    className="font-semibold text-ink hover:underline"
                >
                    View Remote ({locationData.otherTotal}) &rarr;
                </button>
            </div>

            {/* MODAL: Full Breakdown of Other / Remote Locations */}
            {isOtherModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-strong/60 backdrop-blur-sm animate-fade-in"
                    onClick={() => setIsOtherModalOpen(false)}
                >
                    <div
                        className="bg-surface rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-line flex flex-col max-h-[85vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="p-6 border-b border-line flex justify-between items-center bg-gradient-to-r from-olive/10 to-olive/10">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-olive text-on-strong">
                                        Field &amp; Remote Offices
                                    </span>
                                    <span className="text-xs font-bold text-quiet">
                                        {locationData.otherTotal} total assets across {locationData.otherCityCount} cities
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-ink mt-1">
                                    Regional &amp; Remote Field Locations
                                </h3>
                            </div>
                            <button
                                onClick={() => setIsOtherModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-muted text-quiet hover:text-ink flex items-center justify-center font-bold text-sm transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body: City-by-city list */}
                        <div className="p-6 overflow-y-auto space-y-3 divide-y divide-line">
                            {locationData.sortedOtherCities.map((item) => (
                                <div
                                    key={item.city}
                                    className="pt-3 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                >
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-sm text-ink">
                                                {item.city}
                                            </span>
                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-muted text-ink">
                                                {item.count} {item.count === 1 ? 'asset' : 'assets'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-quiet mt-0.5 truncate max-w-md">
                                            {item.assets.map(a => a.name).slice(0, 3).join(', ')}
                                            {item.assets.length > 3 ? ` +${item.assets.length - 3} more` : ''}
                                        </p>
                                    </div>

                                    <button
                                        onClick={() => {
                                            setIsOtherModalOpen(false);
                                            onLocationClick(item.city);
                                        }}
                                        className="px-3.5 py-1.5 bg-surface hover:bg-surface text-ink text-xs font-bold rounded-xl transition-all self-start sm:self-auto flex items-center gap-1 shrink-0"
                                    >
                                        <span>View in Assets</span>
                                        <span>&rarr;</span>
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-line bg-canvas flex justify-end">
                            <button
                                onClick={() => setIsOtherModalOpen(false)}
                                className="px-5 py-2 text-xs font-bold text-ink bg-surface border border-line rounded-xl hover:bg-muted transition-colors shadow-sm"
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
