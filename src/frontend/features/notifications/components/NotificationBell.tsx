import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../../store';
import { fetchNotifications } from '../store/notificationSlice';
import NotificationList from './NotificationList';

const NotificationBell: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { unreadCount } = useSelector((s: RootState) => s.notifications);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    dispatch(fetchNotifications());
    // Poll every 60 seconds for new notifications
    const interval = setInterval(() => dispatch(fetchNotifications()), 60000);
    return () => clearInterval(interval);
  }, [dispatch]);

  return (
    <div data-testid="notification-bell" style={{ position: 'relative' }}>
      <button
        data-testid="notification-bell-button"
        onClick={() => setIsOpen(prev => !prev)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        🔔
        {unreadCount > 0 && (
          <span
            data-testid="notification-badge"
            aria-label={`${unreadCount} unread notifications`}
            style={{
              position: 'absolute', top: -4, right: -4,
              background: 'red', color: 'white', borderRadius: '50%',
              width: 18, height: 18, fontSize: 11, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          data-testid="notification-dropdown"
          role="dialog"
          aria-label="Notifications panel"
          style={{ position: 'absolute', right: 0, top: '100%', zIndex: 1000, width: 360 }}
        >
          <NotificationList onClose={() => setIsOpen(false)} />
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
