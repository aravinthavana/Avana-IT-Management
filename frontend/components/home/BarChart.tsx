import React from 'react';

interface BarChartProps {
    title: string;
    data: { [key: string]: number };
    onItemClick: (key: string) => void;
}

const BarChart: React.FC<BarChartProps> = ({ title, data, onItemClick }) => {
    // FIX: Explicitly type the result of Object.entries to ensure values are treated as numbers
    // for sorting and calculations, resolving TypeScript errors about arithmetic operations.
    const dataEntries = (Object.entries(data) as [string, number][]).sort((a, b) => b[1] - a[1]);
    const maxValue = Math.max(...dataEntries.map(([, value]) => value), 0);
    const colors = ['bg-red-500', 'bg-sky-500', 'bg-amber-500', 'bg-emerald-500', 'bg-indigo-500', 'bg-pink-500'];

    if (dataEntries.length === 0) {
        return (
             <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md h-full">
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">{title}</h3>
                <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500 dark:text-gray-400 text-center py-16">No data available.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">{title}</h3>
            <div className="space-y-3">
                {dataEntries.map(([key, value], index) => (
                    <div 
                        key={key} 
                        onClick={() => onItemClick(key)} 
                        className="group cursor-pointer"
                        aria-label={`View assets in ${key}`}
                        role="button"
                    >
                        <div className="flex justify-between items-center text-sm mb-1">
                            <span className="font-medium text-slate-700 dark:text-slate-300 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">{key}</span>
                            <span className="font-bold text-slate-800 dark:text-slate-100">{value}</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                            <div 
                                className={`h-2.5 rounded-full ${colors[index % colors.length]} group-hover:opacity-80 transition-all duration-300 ease-out`} 
                                style={{ width: `${(value / maxValue) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BarChart;