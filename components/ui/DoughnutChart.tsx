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
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">{title}</h3>
            <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="relative w-40 h-40 rounded-full" style={{ background: conicGradient }}>
                    <div className="absolute inset-2 bg-white dark:bg-slate-800 rounded-full"></div>
                </div>
                <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                    {dataEntries.map(([key, value], index) => (
                        <li 
                            key={key} 
                            className={`flex items-center ${onItemClick ? 'cursor-pointer transition-opacity hover:opacity-70' : ''}`}
                            onClick={() => onItemClick && onItemClick(key)}
                        >
                            <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: colors[index % colors.length] }}></span>
                            <span>{key}: <strong>{value}</strong> ({((value / total) * 100).toFixed(1)}%)</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default DoughnutChart;
