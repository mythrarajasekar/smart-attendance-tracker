import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import LoginForm from '../components/LoginForm';

const ROLE_DASHBOARD: Record<string, string> = {
  student: '/student/dashboard',
  faculty: '/faculty/dashboard',
  admin: '/admin/dashboard',
};

/**
 * Full-page login screen.
 * Redirects to role-appropriate dashboard if already authenticated.
 */
const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(ROLE_DASHBOARD[user.role] || '/dashboard', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  return (
    <main aria-label="Login page">
      <h1>Smart Attendance Tracker</h1>
      <LoginForm />
    </main>
  );
};

export default LoginPage;
