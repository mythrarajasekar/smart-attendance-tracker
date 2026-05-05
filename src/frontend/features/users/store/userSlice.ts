import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axiosInstance from '../../../shared/api/axiosInstance';

export interface UserProfile {
  _id: string;
  email: string;
  role: 'student' | 'faculty' | 'admin';
  name: string;
  isActive: boolean;
  rollNumber?: string;
  department?: string;
  yearSemester?: string;
  academicYear?: string;
  profilePhotoUrl?: string | null;
  phone?: string | null;
  parentContact?: string | null;
  employeeId?: string;
  designation?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserFilters {
  role?: string;
  department?: string;
  academicYear?: string;
  isActive?: boolean;
  search?: string;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface UsersState {
  currentProfile: UserProfile | null;
  list: UserProfile[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
  filters: UserFilters;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

const defaultFilters: UserFilters = {
  page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc',
};

const initialState: UsersState = {
  currentProfile: null,
  list: [],
  pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
  filters: defaultFilters,
  isLoading: false,
  isSaving: false,
  error: null,
};

// ─── Thunks ──────────────────────────────────────────────────────────────────

export const fetchMyProfile = createAsyncThunk('users/fetchMyProfile', async (_, { rejectWithValue }) => {
  try {
    const { data } = await axiosInstance.get('/users/me');
    return data.data as UserProfile;
  } catch (err: unknown) {
    const e = err as { response?: { data?: { error?: { message?: string } } } };
    return rejectWithValue(e.response?.data?.error?.message || 'Failed to load profile');
  }
});

export const updateMyProfile = createAsyncThunk('users/updateMyProfile', async (updates: Partial<UserProfile>, { rejectWithValue }) => {
  try {
    const { data } = await axiosInstance.put('/users/me', updates);
    return data.data as UserProfile;
  } catch (err: unknown) {
    const e = err as { response?: { data?: { error?: { message?: string } } } };
    return rejectWithValue(e.response?.data?.error?.message || 'Failed to update profile');
  }
});

export const fetchUsers = createAsyncThunk('users/fetchUsers', async (filters: Partial<UserFilters>, { rejectWithValue }) => {
  try {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)); });
    const { data } = await axiosInstance.get(`/users?${params.toString()}`);
    return { data: data.data as UserProfile[], meta: data.meta };
  } catch (err: unknown) {
    const e = err as { response?: { data?: { error?: { message?: string } } } };
    return rejectWithValue(e.response?.data?.error?.message || 'Failed to load users');
  }
});

export const createUser = createAsyncThunk('users/createUser', async (userData: Record<string, unknown>, { rejectWithValue }) => {
  try {
    const { data } = await axiosInstance.post('/users', userData);
    return data.data as UserProfile;
  } catch (err: unknown) {
    const e = err as { response?: { data?: { error?: { message?: string } } } };
    return rejectWithValue(e.response?.data?.error?.message || 'Failed to create user');
  }
});

export const deactivateUser = createAsyncThunk('users/deactivateUser', async (userId: string, { rejectWithValue }) => {
  try {
    await axiosInstance.delete(`/users/${userId}`);
    return userId;
  } catch (err: unknown) {
    const e = err as { response?: { data?: { error?: { message?: string } } } };
    return rejectWithValue(e.response?.data?.error?.message || 'Failed to deactivate user');
  }
});

export const uploadProfilePhoto = createAsyncThunk('users/uploadPhoto', async (file: File, { rejectWithValue }) => {
  try {
    const formData = new FormData();
    formData.append('photo', file);
    const { data } = await axiosInstance.post('/users/me/photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data.profilePhotoUrl as string;
  } catch (err: unknown) {
    const e = err as { response?: { data?: { error?: { message?: string } } } };
    return rejectWithValue(e.response?.data?.error?.message || 'Failed to upload photo');
  }
});

// ─── Slice ───────────────────────────────────────────────────────────────────

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    setFilters(state, action: PayloadAction<Partial<UserFilters>>) {
      state.filters = { ...state.filters, ...action.payload, page: 1 };
    },
    resetFilters(state) {
      state.filters = defaultFilters;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyProfile.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(fetchMyProfile.fulfilled, (state, action) => { state.isLoading = false; state.currentProfile = action.payload; })
      .addCase(fetchMyProfile.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; })

      .addCase(updateMyProfile.pending, (state) => { state.isSaving = true; state.error = null; })
      .addCase(updateMyProfile.fulfilled, (state, action) => { state.isSaving = false; state.currentProfile = action.payload; })
      .addCase(updateMyProfile.rejected, (state, action) => { state.isSaving = false; state.error = action.payload as string; })

      .addCase(fetchUsers.pending, (state) => { state.isLoading = true; })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.isLoading = false;
        state.list = action.payload.data;
        state.pagination = action.payload.meta;
      })
      .addCase(fetchUsers.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; })

      .addCase(createUser.fulfilled, (state, action) => { state.list.unshift(action.payload); state.pagination.total += 1; })

      .addCase(deactivateUser.fulfilled, (state, action) => {
        const idx = state.list.findIndex(u => u._id === action.payload);
        if (idx !== -1) state.list[idx].isActive = false;
      })

      .addCase(uploadProfilePhoto.fulfilled, (state, action) => {
        if (state.currentProfile) state.currentProfile.profilePhotoUrl = action.payload;
      });
  },
});

export const { setFilters, resetFilters, clearError } = usersSlice.actions;
export default usersSlice.reducer;
