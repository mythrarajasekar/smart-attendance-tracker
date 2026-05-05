import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../../store';
import { markAsRead, markAllAsRead, deleteNotification } from '../store/notificationSlice';

interface NotificationListProps {
  onClose?: () => void;
}

const NotificationList: React.FC<NotificationListProps> = ({ onClose }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { list, unreadCount, isLoading } = useSelector((s: RootState) => s.notifications);

  return (
    <div data-testid="notification-list" aria-label="Notification list">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px' }}>
        <h3 style={{ margin: 0 }}>Notifications {unreadCount > 0 && `(${unreadCount} unread)`}</h3>
        <div>
          {unreadCount > 0 && (
            <button
              data-testid="notification-mark-all-read"
              onClick={() => dispatch(markAllAsRead())}
              aria-label="Mark all notifications as read"
            >
              Mark all read
            </button>
          )}
          {onClose && (
            <button onClick={onClose} aria-label="Close notifications">✕</button>
          )}
        </div>
      </div>

      {isLoading && <div aria-busy="true">Loading...</div>}

      {list.length === 0 && !isLoading && (
        <p style={{ padding: '16px', textAlign: 'center', color: '#666' }}>No notifications</p>
      )}

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 400, overflowY: 'auto' }}>
        {list.map(notification => (
          <li
            key={notification._id}
            data-testid={`notification-item-${notification._id}`}
            style={{
              padding: '12px',
              borderBottom: '1px solid #eee',
              background: notification.read ? '#fff' : '#fff8e1',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <p style={{ margin: 0, fontSize: 14 }}>{notification.message}</p>
              <div>
                {!notification.read && (
                  <button
                    data-testid={`notification-read-${notification._id}`}
                    onClick={() => dispatch(markAsRead(notification._id))}
                    aria-label="Mark as read"
                    style={{ fontSize: 12 }}
                  >
                    ✓
                  </button>
                )}
                <button
                  data-testid={`notification-delete-${notification._id}`}
                  onClick={() => dispatch(deleteNotification(notification._id))}
                  aria-label="Delete notification"
                  style={{ fontSize: 12, marginLeft: 4 }}
                >
                  ✕
                </button>
              </div>
            </div>
            <small style={{ color: '#999' }}>
              {new Date(notification.createdAt).toLocaleString()}
              {!notification.read && <span style={{ color: '#f57c00', marginLeft: 8 }}>● Unread</span>}
            </small>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default NotificationList;
