import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axiosInstance from '../../../shared/api/axiosInstance';

export type UserRole = 'student' | 'faculty' | 'admin';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  error: string | null;
}

const REFRESH_TOKEN_KEY = 'sat_refresh_token';

const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: false,
  user: null,
  accessToken: null,
  refreshToken: null,
  error: null,
};

// ─── Async Thunks ────────────────────────────────────────────────────────────

export const loginThunk = createAsyncThunk(
  'auth/login',
  async (credentials: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const { data } = await axiosInstance.post('/auth/login', credentials);
      localStorage.setItem(REFRESH_TOKEN_KEY, data.data.refreshToken);
      return data.data;
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { code?: string; message?: string } }; status?: number } };
      const status = error.response?.status;
      const code = error.response?.data?.error?.code;
      const message = error.response?.data?.error?.message;

      if (status === 423) {
        return rejectWithValue({ code: 'ACCOUNT_LOCKED', message: message || 'Account locked' });
      }
      if (status === 429) {
        return rejectWithValue({ code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please wait.' });
      }
      return rejectWithValue({ code: code || 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }
  }
);

export const logoutThunk = createAsyncThunk(
  'auth/logout',
  async (_, { getState }) => {
    const state = getState() as { auth: AuthState };
    const refreshToken = state.auth.refreshToken || localStorage.getItem(REFRESH_TOKEN_KEY);
    try {
      await axiosInstance.post('/auth/logout', { refreshToken });
    } catch {
      // Logout always succeeds client-side even if server call fails
    }
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
);

// ─── Slice ───────────────────────────────────────────────────────────────────

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.isAuthenticated = false;
      state.isLoading = false;
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.error = null;
    },
    tokenRefreshed(
      state,
      action: PayloadAction<{ accessToken: string; refreshToken: string }>
    ) {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.error = null;
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        const payload = action.payload as { message?: string } | undefined;
        state.error = payload?.message || 'Login failed';
      })
      .addCase(logoutThunk.fulfilled, (state) => {
        Object.assign(state, initialState);
      });
  },
});

export const { logout, tokenRefreshed, clearError } = authSlice.actions;
export default authSlice.reducer;
