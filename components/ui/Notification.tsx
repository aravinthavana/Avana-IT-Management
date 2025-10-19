import React, { useEffect, useState } from 'react';
import { NotificationType } from '../../types';

interface NotificationProps {
    notification: NotificationType | null;
    onClear: () => void;
}

const Notification: React.FC<NotificationProps> = ({ notification, onClear }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (notification) {
            setIsVisible(true);
            const timer = setTimeout(() => {
                setIsVisible(false);
                // Wait for animation to finish before clearing
                setTimeout(onClear, 300);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [notification, onClear]);

    if (!notification) return null;

    const baseStyle = "fixed bottom-5 right-5 text-white px-6 py-3 rounded-lg shadow-lg z-[70] transition-all duration-300 transform";
    const typeStyles = { success: 'bg-green-500', error: 'bg-red-500' };
    const visibilityStyles = isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12';
    
    return (
        <div className={`${baseStyle} ${typeStyles[notification.type] || 'bg-gray-800'} ${visibilityStyles}`}>
            {notification.message}
        </div>
    );
};

export default Notification;