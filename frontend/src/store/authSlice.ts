import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../api/axios';

interface AuthUser { id: string; name: string; role: string; }
interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: JSON.parse(localStorage.getItem('sat_user') || 'null'),
  isAuthenticated: !!localStorage.getItem('sat_access_token'),
  isLoading: false,
  error: null,
};

export const loginThunk = createAsyncThunk('auth/login', async (creds: { email: string; password: string }, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/auth/login', creds);
    localStorage.setItem('sat_access_token', data.data.accessToken);
    localStorage.setItem('sat_refresh_token', data.data.refreshToken);
    localStorage.setItem('sat_user', JSON.stringify(data.data.user));
    return data.data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error?.message || 'Login failed');
  }
});

export const logoutThunk = createAsyncThunk('auth/logout', async () => {
  const refreshToken = localStorage.getItem('sat_refresh_token');
  try { await api.post('/auth/logout', { refreshToken }); } catch {}
  localStorage.removeItem('sat_access_token');
  localStorage.removeItem('sat_refresh_token');
  localStorage.removeItem('sat_user');
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(loginThunk.fulfilled, (state, action: PayloadAction<any>) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(logoutThunk.fulfilled, (state) => {
        state.isAuthenticated = false;
        state.user = null;
      });
  },
});

export const { clearError } = authSlice.actions;
export default authSlice.reducer;
