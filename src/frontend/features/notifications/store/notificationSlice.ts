import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axiosInstance from '../../../shared/api/axiosInstance';

export interface Notification {
  _id: string;
  userId: string;
  subjectId: string;
  type: 'low_attendance';
  message: string;
  read: boolean;
  readAt: string | null;
  emailStatus: 'pending' | 'sent' | 'failed' | 'skipped';
  createdAt: string;
}

interface NotificationsState {
  list: Notification[];
  unreadCount: number;
  pagination: { total: number; page: number; limit: number; totalPages: number };
  isLoading: boolean;
  error: string | null;
}

const initialState: NotificationsState = {
  list: [], unreadCount: 0,
  pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
  isLoading: false, error: null,
};

const rejectMsg = (err: unknown, fallback: string) => {
  const e = err as { response?: { data?: { error?: { message?: string } } } };
  return e.response?.data?.error?.message || fallback;
};

export const fetchNotifications = createAsyncThunk('notifications/fetch', async (params: { read?: boolean; page?: number } = {}, { rejectWithValue }) => {
  try {
    const query = new URLSearchParams();
    if (params.read !== undefined) query.set('read', String(params.read));
    if (params.page) query.set('page', String(params.page));
    const { data } = await axiosInstance.get(`/notifications?${query}`);
    return { data: data.data as Notification[], meta: data.meta };
  } catch (err) { return rejectWithValue(rejectMsg(err, 'Failed to load notifications')); }
});

export const markAsRead = createAsyncThunk('notifications/markRead', async (id: string, { rejectWithValue }) => {
  try {
    await axiosInstance.put(`/notifications/${id}/read`);
    return id;
  } catch (err) { return rejectWithValue(rejectMsg(err, 'Failed to mark as read')); }
});

export const markAllAsRead = createAsyncThunk('notifications/markAllRead', async (_, { rejectWithValue }) => {
  try {
    await axiosInstance.put('/notifications/read-all');
  } catch (err) { return rejectWithValue(rejectMsg(err, 'Failed to mark all as read')); }
});

export const deleteNotification = createAsyncThunk('notifications/delete', async (id: string, { rejectWithValue }) => {
  try {
    await axiosInstance.delete(`/notifications/${id}`);
    return id;
  } catch (err) { return rejectWithValue(rejectMsg(err, 'Failed to delete notification')); }
});

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    clearError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => { state.isLoading = true; })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.isLoading = false;
        state.list = action.payload.data;
        state.unreadCount = action.payload.meta.unreadCount;
        state.pagination = action.payload.meta;
      })
      .addCase(fetchNotifications.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; })
      .addCase(markAsRead.fulfilled, (state, action) => {
        const n = state.list.find(n => n._id === action.payload);
        if (n && !n.read) { n.read = true; state.unreadCount = Math.max(0, state.unreadCount - 1); }
      })
      .addCase(markAllAsRead.fulfilled, (state) => {
        state.list.forEach(n => { n.read = true; });
        state.unreadCount = 0;
      })
      .addCase(deleteNotification.fulfilled, (state, action) => {
        const idx = state.list.findIndex(n => n._id === action.payload);
        if (idx !== -1) {
          if (!state.list[idx].read) state.unreadCount = Math.max(0, state.unreadCount - 1);
          state.list.splice(idx, 1);
        }
      });
  },
});

export const { clearError } = notificationsSlice.actions;
export default notificationsSlice.reducer;
