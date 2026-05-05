import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axiosInstance from '../../../shared/api/axiosInstance';

export interface AttendanceRecord {
  _id: string;
  sessionId: string;
  studentId: string;
  subjectId: string;
  date: string;
  status: 'present' | 'absent';
  markedAt: string;
  editedAt: string | null;
  editReason: string | null;
}

export interface AttendancePercentage {
  studentId: string;
  subjectId: string;
  attended: number;
  total: number;
  percentage: number;
}

export interface MarkAttendancePayload {
  subjectId: string;
  date: string;
  sessionLabel: string;
  records: Array<{ studentId: string; status: 'present' | 'absent' }>;
}

interface AttendanceState {
  records: AttendanceRecord[];
  percentages: Record<string, AttendancePercentage>; // key: `${studentId}:${subjectId}`
  subjectSummary: unknown[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  lastMarkResult: { sessionId: string; marked: number; presentCount: number; absentCount: number } | null;
}

const initialState: AttendanceState = {
  records: [], percentages: {}, subjectSummary: [],
  pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
  isLoading: false, isSaving: false, error: null, lastMarkResult: null,
};

const rejectMsg = (err: unknown, fallback: string) => {
  const e = err as { response?: { data?: { error?: { message?: string } } } };
  return e.response?.data?.error?.message || fallback;
};

export const markAttendance = createAsyncThunk('attendance/mark', async (payload: MarkAttendancePayload, { rejectWithValue }) => {
  try {
    const { data } = await axiosInstance.post('/attendance', payload);
    return data.data;
  } catch (err) { return rejectWithValue(rejectMsg(err, 'Failed to mark attendance')); }
});

export const editAttendance = createAsyncThunk('attendance/edit', async ({ id, status, editReason }: { id: string; status: string; editReason: string }, { rejectWithValue }) => {
  try {
    const { data } = await axiosInstance.put(`/attendance/${id}`, { status, editReason });
    return data.data as AttendanceRecord;
  } catch (err) { return rejectWithValue(rejectMsg(err, 'Failed to edit attendance')); }
});

export const lockSession = createAsyncThunk('attendance/lockSession', async (sessionId: string, { rejectWithValue }) => {
  try {
    await axiosInstance.post('/attendance/lock', { sessionId });
    return sessionId;
  } catch (err) { return rejectWithValue(rejectMsg(err, 'Failed to lock session')); }
});

export const fetchPercentage = createAsyncThunk('attendance/fetchPercentage', async ({ studentId, subjectId }: { studentId: string; subjectId: string }, { rejectWithValue }) => {
  try {
    const { data } = await axiosInstance.get(`/attendance/student/${studentId}/subject/${subjectId}/percentage`);
    return data.data as AttendancePercentage;
  } catch (err) { return rejectWithValue(rejectMsg(err, 'Failed to fetch percentage')); }
});

export const fetchSubjectAttendance = createAsyncThunk('attendance/fetchSubject', async ({ subjectId, page = 1, limit = 20 }: { subjectId: string; page?: number; limit?: number }, { rejectWithValue }) => {
  try {
    const { data } = await axiosInstance.get(`/attendance/subject/${subjectId}?page=${page}&limit=${limit}`);
    return { data: data.data, meta: data.meta };
  } catch (err) { return rejectWithValue(rejectMsg(err, 'Failed to fetch attendance')); }
});

export const fetchStudentHistory = createAsyncThunk('attendance/fetchHistory', async ({ studentId, subjectId, page = 1 }: { studentId: string; subjectId?: string; page?: number }, { rejectWithValue }) => {
  try {
    const params = new URLSearchParams({ page: String(page) });
    if (subjectId) params.set('subjectId', subjectId);
    const { data } = await axiosInstance.get(`/attendance/student/${studentId}?${params}`);
    return { data: data.data as AttendanceRecord[], meta: data.meta };
  } catch (err) { return rejectWithValue(rejectMsg(err, 'Failed to fetch history')); }
});

const attendanceSlice = createSlice({
  name: 'attendance',
  initialState,
  reducers: {
    clearError(state) { state.error = null; },
    clearLastMarkResult(state) { state.lastMarkResult = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(markAttendance.pending, (state) => { state.isSaving = true; state.error = null; })
      .addCase(markAttendance.fulfilled, (state, action) => { state.isSaving = false; state.lastMarkResult = action.payload; })
      .addCase(markAttendance.rejected, (state, action) => { state.isSaving = false; state.error = action.payload as string; })
      .addCase(editAttendance.fulfilled, (state, action) => {
        const idx = state.records.findIndex(r => r._id === action.payload._id);
        if (idx !== -1) state.records[idx] = action.payload;
      })
      .addCase(fetchPercentage.fulfilled, (state, action) => {
        const key = `${action.payload.studentId}:${action.payload.subjectId}`;
        state.percentages[key] = action.payload;
      })
      .addCase(fetchSubjectAttendance.pending, (state) => { state.isLoading = true; })
      .addCase(fetchSubjectAttendance.fulfilled, (state, action) => {
        state.isLoading = false;
        state.subjectSummary = action.payload.data;
        state.pagination = action.payload.meta;
      })
      .addCase(fetchStudentHistory.fulfilled, (state, action) => {
        state.records = action.payload.data;
        state.pagination = action.payload.meta;
      });
  },
});

export const { clearError, clearLastMarkResult } = attendanceSlice.actions;
export default attendanceSlice.reducer;
