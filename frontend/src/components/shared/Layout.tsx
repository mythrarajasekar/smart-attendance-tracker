import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { logoutThunk } from '../../store/authSlice';
import { AppDispatch, RootState } from '../../store';

const ROLE_COLOR: Record<string, string> = {
  admin: '#e74c3c',
  faculty: '#2980b9',
  student: '#27ae60',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { user } = useSelector((s: RootState) => s.auth);

  const handleLogout = async () => {
    await dispatch(logoutThunk());
    navigate('/login');
  };

  const navLinks = user?.role === 'admin'
    ? [{ to: '/admin', label: '🏠 Dashboard' }, { to: '/admin/users', label: '👥 Users' }, { to: '/admin/subjects', label: '📚 Subjects' }]
    : user?.role === 'faculty'
    ? [{ to: '/faculty', label: '🏠 Dashboard' }, { to: '/faculty/attendance', label: '✅ Attendance' }]
    : [{ to: '/student', label: '🏠 Dashboard' }, { to: '/student/attendance', label: '📊 My Attendance' }];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Navbar */}
      <nav style={{ background: '#1a1a2e', color: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', height: 56, gap: 24 }}>
        <span style={{ fontWeight: 700, fontSize: 16, marginRight: 16 }}>🎓 SAT</span>
        {navLinks.map(l => (
          <Link key={l.to} to={l.to} style={{ color: '#ccc', textDecoration: 'none', fontSize: 14 }}>{l.label}</Link>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, background: ROLE_COLOR[user?.role || 'student'], padding: '2px 10px', borderRadius: 12, fontWeight: 600 }}>
            {user?.role?.toUpperCase()}
          </span>
          <span style={{ fontSize: 14, color: '#ccc' }}>{user?.name}</span>
          <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
            Logout
          </button>
        </div>
      </nav>
      {/* Content */}
      <main style={{ flex: 1, padding: 28, maxWidth: 1100, margin: '0 auto', width: '100%' }}>
        {children}
      </main>
    </div>
  );
}
