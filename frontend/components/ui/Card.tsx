import React from 'react';

interface CardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
    onClick?: () => void;
}

const Card: React.FC<CardProps> = ({ title, value, icon, color, onClick }) => (
    <div 
        className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm dark:shadow-slate-950 p-6 flex items-center transition-all duration-300 hover:shadow-lg dark:hover:shadow-slate-950 hover:-translate-y-1 ${onClick ? 'cursor-pointer' : ''}`}
        onClick={onClick}
    >
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${color}`}>
            {icon}
        </div>
        <div className="ml-4">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
        </div>
    </div>
);

export default Card;
