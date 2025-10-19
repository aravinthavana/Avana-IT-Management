import React from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { getWarrantyStatus } from '../../utils/assetUtils';
import { getAssigneeDisplayInfo } from '../../utils/assigneeUtils';

const ExpiringWarrantyTable: React.FC = () => {
    const { assets, users, departments, branches } = useAppContext();

    const expiringAssets = assets
        .filter(asset => getWarrantyStatus(asset).label === 'Expiring Soon')
        .sort((a, b) => {
            const getEndDate = (asset: typeof a): Date => {
                let endDate;
                if (asset.warrantyType === 'Years' && asset.warrantyStartDate && asset.warrantyYears) {
                    const startDate = new Date(asset.warrantyStartDate);
                    // Adjust for timezone to correctly handle date parsing across browsers/timezones
                    startDate.setTime(startDate.getTime() + startDate.getTimezoneOffset() * 60 * 1000);
                    endDate = new Date(startDate.setFullYear(startDate.getFullYear() + parseInt(asset.warrantyYears as string)));
                } else if (asset.warrantyType === 'Date Range' && asset.warrantyEndDate) {
                    endDate = new Date(asset.warrantyEndDate);
                    // Adjust for timezone
                    endDate.setTime(endDate.getTime() + endDate.getTimezoneOffset() * 60 * 1000);
                } else {
                    // This case should not be reached for assets filtered by "Expiring Soon", but acts as a safeguard.
                    return new Date(0);
                }
                return endDate;
            };
            return getEndDate(a).getTime() - getEndDate(b).getTime();
        })
        .slice(0, 5);

    if (expiringAssets.length === 0) {
        return (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md">
                 <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">Warranties Expiring Soon</h3>
                 <p className="text-gray-500 dark:text-gray-400 text-center py-8">No warranties expiring in the next 30 days.</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md">
             <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">Warranties Expiring Soon</h3>
             <div className="space-y-3">
                {expiringAssets.map(asset => {
                    const status = getWarrantyStatus(asset);
                    const expiryDate = status.text.split(': ')[1] || status.text.split('on ')[1] || 'N/A';
                    const assignee = getAssigneeDisplayInfo(asset.assigneeId, asset.assigneeType, users, departments, branches);
                    return (
                        <div key={asset.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900/50 rounded-md">
                            <div>
                                <p className="font-medium text-gray-800 dark:text-gray-100 text-sm">{asset.name}</p>
                                <p className="text-xs text-yellow-600 dark:text-yellow-400 font-semibold">{expiryDate}</p>
                            </div>
                            <div className="text-sm text-right text-gray-600 dark:text-gray-300">
                                {asset.assigneeId ? (
                                    <div className="flex items-center gap-1 justify-end">
                                        <span>{assignee.name}</span>
                                        {assignee.type && <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${assignee.typeColor}`}>{assignee.type}</span>}
                                    </div>
                                ) : <span className="text-xs font-semibold uppercase px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 rounded-full">In Stock</span>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ExpiringWarrantyTable;
