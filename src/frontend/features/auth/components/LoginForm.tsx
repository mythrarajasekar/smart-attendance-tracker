import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppDispatch, RootState } from '../../../store';
import { loginThunk, clearError } from '../store/authSlice';

interface LoginFormProps {
  onSuccess?: () => void;
}

const ROLE_DASHBOARD: Record<string, string> = {
  student: '/student/dashboard',
  faculty: '/faculty/dashboard',
  admin: '/admin/dashboard',
};

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { isLoading, error } = useSelector((state: RootState) => state.auth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [clientError, setClientError] = useState('');

  const validate = (): boolean => {
    if (!email.trim()) {
      setClientError('Email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setClientError('Please enter a valid email address');
      return false;
    }
    if (!password) {
      setClientError('Password is required');
      return false;
    }
    setClientError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(clearError());

    if (!validate()) return;

    const result = await dispatch(loginThunk({ email: email.trim().toLowerCase(), password }));

    if (loginThunk.fulfilled.match(result)) {
      const role = result.payload.user.role;
      onSuccess?.();
      navigate(ROLE_DASHBOARD[role] || '/dashboard');
    }
  };

  const displayError = clientError || error;

  return (
    <form
      data-testid="login-form"
      onSubmit={handleSubmit}
      noValidate
      aria-label="Login form"
    >
      <div>
        <label htmlFor="login-email">Email address</label>
        <input
          id="login-email"
          data-testid="login-email-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          autoFocus
          disabled={isLoading}
          aria-required="true"
          aria-describedby={displayError ? 'login-error-message' : undefined}
        />
      </div>

      <div>
        <label htmlFor="login-password">Password</label>
        <div style={{ position: 'relative' }}>
          <input
            id="login-password"
            data-testid="login-password-input"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={isLoading}
            aria-required="true"
          />
          <button
            type="button"
            data-testid="login-password-toggle"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            disabled={isLoading}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      {displayError && (
        <div
          id="login-error-message"
          data-testid="login-error-message"
          role="alert"
          aria-live="assertive"
        >
          {displayError}
        </div>
      )}

      <button
        type="submit"
        data-testid="login-submit-button"
        disabled={isLoading}
        aria-busy={isLoading}
      >
        {isLoading ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
};

export default LoginForm;
