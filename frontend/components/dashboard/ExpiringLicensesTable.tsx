import React, { useMemo } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { ICONS } from '../../constants';
import { License } from '../../types';

const ExpiringLicensesTable: React.FC = () => {
    const { licenses, navigate } = useAppContext();

    const expiringLicenses = useMemo(() => {
        const today = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(today.getDate() + 30);

        return licenses.filter(license => {
            if (!license.expirationDate) return false;
            const expDate = new Date(license.expirationDate);
            return expDate > today && expDate <= thirtyDaysFromNow;
        }).sort((a, b) => new Date(a.expirationDate!).getTime() - new Date(b.expirationDate!).getTime());
    }, [licenses]);

    if (expiringLicenses.length === 0) {
        return null;
    }

    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <span className="text-yellow-600 dark:text-yellow-500">{ICONS.licenses}</span>
                    Licenses Expiring Soon (30 Days)
                </h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                            <th className="px-4 py-3 font-medium">License Name</th>
                            <th className="px-4 py-3 font-medium">Category</th>
                            <th className="px-4 py-3 font-medium text-right">Expiration Date</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {expiringLicenses.map(license => (
                            <tr 
                                key={license.id} 
                                onClick={() => navigate('licenses')}
                                className="hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                            >
                                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                                    {license.name}
                                </td>
                                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                                    {license.category}
                                </td>
                                <td className="px-4 py-3 text-right text-yellow-600 dark:text-yellow-500 font-medium">
                                    {new Date(license.expirationDate!).toLocaleDateString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ExpiringLicensesTable;
