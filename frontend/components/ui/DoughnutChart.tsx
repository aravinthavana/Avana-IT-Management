import React from 'react';

interface DoughnutChartProps {
    title: string;
    data: { [key: string]: number };
    colors: string[];
    onItemClick?: (key: string) => void;
}

const DoughnutChart: React.FC<DoughnutChartProps> = ({ title, data, colors, onItemClick }) => {
    const dataEntries = Object.entries(data) as [string, number][];
    const total = dataEntries.reduce((sum, [, value]) => sum + value, 0);

    if (total === 0) {
        return (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md h-full">
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">{title}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-center py-16">No data available.</p>
            </div>
        );
    }

    let cumulativePercentage = 0;
    const gradientParts = dataEntries.map(([, value], index) => {
        const percentage = (value / total) * 100;
        const start = cumulativePercentage;
        cumulativePercentage += percentage;
        const end = cumulativePercentage;
        return `${colors[index % colors.length]} ${start}% ${end}%`;
    });

    const conicGradient = `conic-gradient(${gradientParts.join(', ')})`;

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between overflow-hidden min-w-0">
            <div>
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">{title}</h3>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0">
                        {total} Total
                    </span>
                </div>

                {/* Centered Donut Graphic */}
                <div className="flex justify-center my-3">
                    <div className="relative w-32 h-32 rounded-full flex items-center justify-center shrink-0 shadow-inner hover:scale-105 transition-transform" style={{ background: conicGradient }}>
                        <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-full flex flex-col items-center justify-center shadow-sm">
                            <span className="text-lg font-black text-slate-900 dark:text-white font-mono leading-none">{total}</span>
                            <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider mt-0.5">Total</span>
                        </div>
                    </div>
                </div>

                {/* Responsive 2-column Legend Grid (Never overflows width!) */}
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/60 w-full min-w-0">
                    {dataEntries.map(([key, value], index) => {
                        const pct = ((value / total) * 100).toFixed(1);
                        return (
                            <li 
                                key={key} 
                                className={`flex items-center justify-between p-1.5 px-2 rounded-xl bg-slate-50/70 dark:bg-slate-750 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors min-w-0 ${onItemClick ? 'cursor-pointer' : ''}`}
                                onClick={() => onItemClick && onItemClick(key)}
                                title={`${key}: ${value} (${pct}%)`}
                            >
                                <span className="flex items-center min-w-0 mr-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full mr-1.5 shrink-0" style={{ backgroundColor: colors[index % colors.length] }}></span>
                                    <span className="font-semibold text-slate-700 dark:text-slate-300 truncate text-[11px]">{key}</span>
                                </span>
                                <span className="font-mono font-bold text-slate-900 dark:text-white text-[11px] shrink-0">
                                    {value} <span className="text-[9px] font-normal text-slate-400 font-sans">({pct}%)</span>
                                </span>
                            </li>
                        );
                    })}
                </ul>
            </div>
            {onItemClick && (
                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 text-[11px] text-slate-400 text-center">
                    Click any segment to view filtered assets
                </div>
            )}
        </div>
    );
};

export default DoughnutChart;
