import React from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { getAssigneeDisplayInfo } from '../../utils/assigneeUtils';

import { Asset } from '../../types';

interface RecentAssetsTableProps {
    assets?: Asset[];
}

const RecentAssetsTable: React.FC<RecentAssetsTableProps> = ({ assets: propAssets }) => {
    const { assets: contextAssets, users, departments, branches } = useAppContext();
    const assets = propAssets || contextAssets;
    const recentAssets = [...assets].sort((a, b) => b.id - a.id).slice(0, 5);

    return (
        <div className="bg-surface p-6 rounded-lg shadow-md">
             <h3 className="text-lg font-semibold text-ink mb-4">Recently Added Assets</h3>
             <div className="space-y-3">
                {recentAssets.map(asset => {
                    const assignee = getAssigneeDisplayInfo(asset.assigneeId, asset.assigneeType, users, departments, branches);
                    return (
                         <div key={asset.id} className="flex justify-between items-center p-3 bg-canvas rounded-md">
                            <div>
                                <p className="font-medium text-ink text-sm">{asset.name}</p>
                                <p className="text-xs text-quiet">{asset.category}</p>
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
                    )
                })}
            </div>
        </div>
    );
};

export default RecentAssetsTable;