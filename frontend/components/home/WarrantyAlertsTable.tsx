import React from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { getWarrantyStatus } from '../../utils/assetUtils';
import { getAssigneeDisplayInfo } from '../../utils/assigneeUtils';

import { Asset } from '../../types';

interface WarrantyAlertsTableProps {
    assets?: Asset[];
}

const WarrantyAlertsTable: React.FC<WarrantyAlertsTableProps> = ({ assets: propAssets }) => {
    const { assets: contextAssets, users, departments, branches } = useAppContext();
    const assets = propAssets || contextAssets;

    const expiringAssets = assets
        .filter(asset => getWarrantyStatus(asset).label === 'Expiring Soon')
        .sort((a, b) => {
            const getEndDate = (asset: typeof a) => {
                if (asset.warrantyType === 'Years' && asset.warrantyStartDate && asset.warrantyYears) {
                    const startDate = new Date(asset.warrantyStartDate);
                    return new Date(startDate.setFullYear(startDate.getFullYear() + parseInt(asset.warrantyYears as string)));
                }
                return new Date(asset.warrantyEndDate);
            };
            return getEndDate(a).getTime() - getEndDate(b).getTime();
        })
        .slice(0, 5);

    return (
        <div className="bg-surface p-6 rounded-lg shadow-md">
             <h3 className="text-lg font-semibold text-ink mb-4">Warranty Alerts</h3>
             {expiringAssets.length === 0 ? (
                 <p className="text-quiet text-center py-8">No warranties expiring in the next 30 days.</p>
             ) : (
                 <div className="space-y-3">
                    {expiringAssets.map(asset => {
                        const status = getWarrantyStatus(asset);
                        const expiryDate = status.text.split(': ')[1] || status.text.split('on ')[1] || 'N/A';
                        const assignee = getAssigneeDisplayInfo(asset.assigneeId, asset.assigneeType, users, departments, branches);
                        return (
                            <div key={asset.id} className="flex justify-between items-center p-3 bg-canvas rounded-md">
                                <div>
                                    <p className="font-medium text-ink text-sm">{asset.name}</p>
                                    <p className="text-xs text-ink font-semibold">{expiryDate}</p>
                                </div>
                                <div className="text-sm text-right text-quiet">
                                    {asset.assigneeId ? (
                                        <div className="flex items-center gap-1 justify-end">
                                            <span>{assignee.name}</span>
                                            {assignee.type && <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${assignee.typeColor}`}>{assignee.type}</span>}
                                        </div>
                                    ) : <span className="text-xs font-semibold uppercase px-2 py-1 bg-surface text-ink rounded-full">In Stock</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
             )}
        </div>
    );
};

export default WarrantyAlertsTable;