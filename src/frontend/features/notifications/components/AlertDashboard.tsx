import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../../store';
import { fetchNotifications, markAllAsRead } from '../store/notificationSlice';

const AlertDashboard: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { list, unreadCount, pagination, isLoading } = useSelector((s: RootState) => s.notifications);

  useEffect(() => {
    dispatch(fetchNotifications({ read: false }));
  }, [dispatch]);

  const lowAttendanceAlerts = list.filter(n => n.type === 'low_attendance');

  return (
    <div data-testid="alert-dashboard" aria-label="Alert dashboard">
      <h2>My Alerts</h2>

      {unreadCount > 0 && (
        <div role="status" aria-live="polite">
          <strong>{unreadCount} unread alert{unreadCount !== 1 ? 's' : ''}</strong>
          <button
            data-testid="alert-dashboard-mark-all-read"
            onClick={() => dispatch(markAllAsRead())}
            aria-label="Mark all alerts as read"
          >
            Mark all as read
          </button>
        </div>
      )}

      {isLoading && <div aria-busy="true">Loading alerts...</div>}

      {lowAttendanceAlerts.length === 0 && !isLoading && (
        <p role="status">No low attendance alerts. Keep it up! 🎉</p>
      )}

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {lowAttendanceAlerts.map(alert => (
          <li
            key={alert._id}
            data-testid={`alert-item-${alert._id}`}
            role="alert"
            style={{
              padding: '12px 16px',
              marginBottom: 8,
              borderLeft: `4px solid ${alert.read ? '#ccc' : '#f44336'}`,
              background: alert.read ? '#fafafa' : '#fff3e0',
              borderRadius: 4,
            }}
          >
            <p style={{ margin: 0 }}>{alert.message}</p>
            <small style={{ color: '#666' }}>
              {new Date(alert.createdAt).toLocaleString()}
              {!alert.read && (
                <span style={{ color: '#f44336', marginLeft: 8, fontWeight: 'bold' }}>● New</span>
              )}
            </small>
          </li>
        ))}
      </ul>

      <p aria-live="polite">Total alerts: {pagination.total}</p>
    </div>
  );
};

export default AlertDashboard;
