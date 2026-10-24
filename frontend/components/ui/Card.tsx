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
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={event => { if (onClick && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onClick(); } }}
        className={`bg-surface  rounded-xl shadow-sm  p-4 sm:p-6 flex items-center transition-all duration-300 hover:shadow-lg  hover:-translate-y-1 ${onClick ? 'cursor-pointer' : ''}`}
        onClick={onClick}
    >
        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0 ${color}`}>
            {icon}
        </div>
        <div className="ml-2 sm:ml-4 min-w-0">
            <p className="text-sm font-medium text-quiet">{title}</p>
            <div className="flex items-baseline gap-2 flex-wrap">
                <p className="text-xl sm:text-2xl font-bold text-ink">{value}</p>
                {badge && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface text-ink border border-line whitespace-nowrap">
                        {badge}
                    </span>
                )}
            </div>
        </div>
    </div>
);

export default Card;
