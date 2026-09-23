import React from 'react';

interface CardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
    onClick?: () => void;
    badge?: string;  // Optional pill badge (e.g. "85% Deployed")
}

const Card: React.FC<CardProps> = ({ title, value, icon, color, onClick, badge }) => (
    <div 
        className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm dark:shadow-slate-950 p-6 flex items-center transition-all duration-300 hover:shadow-lg dark:hover:shadow-slate-950 hover:-translate-y-1 ${onClick ? 'cursor-pointer' : ''}`}
        onClick={onClick}
    >
        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${color}`}>
            {icon}
        </div>
        <div className="ml-4 min-w-0">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
            <div className="flex items-baseline gap-2 flex-wrap">
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
                {badge && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
                        {badge}
                    </span>
                )}
            </div>
        </div>
    </div>
);

export default Card;
