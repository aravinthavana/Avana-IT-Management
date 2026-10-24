import React, { useEffect, useRef } from 'react';
import { NotificationType } from '../../types';
interface NotificationProps { notification: NotificationType | null; onClear: () => void; }
const Notification: React.FC<NotificationProps> = ({ notification, onClear }) => {
    const clear = useRef(onClear);
    clear.current = onClear;
    useEffect(() => {
        if (!notification || notification.type === 'error') return;
        const timer = setTimeout(() => clear.current(), 6000);
        return () => clearTimeout(timer);
    }, [notification]);
    if (!notification) return null;
    const error = notification.type === 'error';
    return (
        <div role={error ? 'alert' : 'status'} aria-live={error ? 'assertive' : 'polite'} aria-atomic="true"
            className={`fixed bottom-4 left-3 right-3 sm:left-auto sm:right-5 sm:max-w-md z-[80] max-h-[40dvh] overflow-y-auto flex items-start gap-3 ${error ? 'bg-red-600' : 'bg-green-700'} text-white px-4 py-3 rounded-xl shadow-lg border border-white/20`}>
            <span aria-hidden="true" className="font-bold text-lg">{error ? '!' : '✓'}</span>
            <div className="min-w-0 flex-1"><p className="font-semibold text-sm">{error ? 'Action needed' : 'Success'}</p><p className="text-sm break-words mt-0.5">{notification.message}</p></div>
            <button type="button" onClick={onClear} aria-label="Dismiss notification" className="shrink-0 p-2 rounded-lg border border-line">×</button>
        </div>
    );
};
export default Notification;
