import React from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { getAssigneeDisplayInfo } from '../../utils/assigneeUtils';

const RecentAssetsTable: React.FC = () => {
    const { assets, users, departments, branches } = useAppContext();
    const recentAssets = [...assets].sort((a, b) => b.id - a.id).slice(0, 5);
    
    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md">
             <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">Recently Added Assets</h3>
             <div className="space-y-3">
                {recentAssets.map(asset => {
                    const assignee = getAssigneeDisplayInfo(asset.assigneeId, asset.assigneeType, users, departments, branches);
                    return (
                         <div key={asset.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900/50 rounded-md">
                            <div>
                                <p className="font-medium text-gray-800 dark:text-gray-100 text-sm">{asset.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{asset.category}</p>
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
                    )
                })}
            </div>
        </div>
    );
};

export default RecentAssetsTable;