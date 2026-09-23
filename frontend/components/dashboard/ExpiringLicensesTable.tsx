import React, { useMemo } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { ICONS } from '../../constants';

interface ExpiringLicensesTableProps {
    selectedCompany?: string;
}

const ExpiringLicensesTable: React.FC<ExpiringLicensesTableProps> = ({ selectedCompany }) => {
    const { licenses, navigate } = useAppContext();

    const expiringLicenses = useMemo(() => {
        const today = new Date();
        const ninetyDaysFromNow = new Date();
        ninetyDaysFromNow.setDate(today.getDate() + 90);

        return licenses
            .filter(license => {
                if (!license.expirationDate) return false;
                const expDate = new Date(license.expirationDate);
                return expDate >= today && expDate <= ninetyDaysFromNow;
            })
            .sort((a, b) => new Date(a.expirationDate!).getTime() - new Date(b.expirationDate!).getTime());
    }, [licenses]);

    const getDaysUntilExpiry = (dateStr: string) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const exp = new Date(dateStr);
        exp.setHours(0, 0, 0, 0);
        return Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    };

    if (expiringLicenses.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/30 rounded-full flex items-center justify-center mb-3 text-emerald-500">
                    {ICONS.licenses}
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">All subscriptions are active</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
                    No software licenses or subscriptions are due for renewal in the next 90 days.
                </p>
                <button
                    onClick={() => navigate('licenses')}
                    className="mt-4 text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline"
                >
                    Manage All Licenses →
                </button>
            </div>
        );
    }

    return (
        <div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700">
                        <tr>
                            <th className="pb-2 font-semibold text-xs uppercase tracking-wider">License / Subscription</th>
                            <th className="pb-2 font-semibold text-xs uppercase tracking-wider">Category</th>
                            <th className="pb-2 font-semibold text-xs uppercase tracking-wider text-right">Renews In</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {expiringLicenses.map(license => {
                            const daysLeft = getDaysUntilExpiry(license.expirationDate!);
                            const isUrgent = daysLeft <= 14;
                            const isSoon = daysLeft <= 30;
                            return (
                                <tr
                                    key={license.id}
                                    onClick={() => navigate('licenses')}
                                    className="hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors"
                                >
                                    <td className="py-2.5 pr-4">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isUrgent ? 'bg-red-500' : isSoon ? 'bg-amber-500' : 'bg-yellow-400'}`} />
                                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[180px]" title={license.name}>
                                                {license.name}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-2.5 text-slate-500 dark:text-slate-400 text-xs">
                                        {license.category}
                                    </td>
                                    <td className="py-2.5 text-right">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                                            isUrgent
                                                ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                                                : isSoon
                                                    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                                                    : 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-800'
                                        }`}>
                                            {daysLeft === 0 ? 'Today' : daysLeft === 1 ? '1 day' : `${daysLeft}d`}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                <button
                    onClick={() => navigate('licenses')}
                    className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline"
                >
                    Manage All Licenses →
                </button>
            </div>
        </div>
    );
};

export default ExpiringLicensesTable;
