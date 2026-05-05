import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axiosInstance from '../../../shared/api/axiosInstance';

export interface Subject {
  _id: string;
  name: string;
  code: string;
  department: string;
  semester: string;
  academicYear: string;
  credits: number;
  capacity: number | null;
  isActive: boolean;
  facultyIds: string[];
  studentIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SubjectFilters {
  department?: string;
  semester?: string;
  academicYear?: string;
  isActive?: boolean;
  search?: string;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface BulkEnrollmentResult {
  enrolled: number;
  alreadyEnrolled: number;
  capacityExceeded: number;
  notFound: number;
  failed: Array<{ studentId: string; reason: string }>;
  parseErrors?: Array<{ row: number; reason: string }>;
}

interface SubjectsState {
  list: Subject[];
  currentSubject: Subject | null;
  pagination: { total: number; page: number; limit: number; totalPages: number };
  filters: SubjectFilters;
  isLoading: boolean;
  isSaving: boolean;
  bulkResult: BulkEnrollmentResult | null;
  error: string | null;
}

const defaultFilters: SubjectFilters = { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' };

const initialState: SubjectsState = {
  list: [], currentSubject: null,
  pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
  filters: defaultFilters,
  isLoading: false, isSaving: false, bulkResult: null, error: null,
};

const rejectMsg = (err: unknown, fallback: string) => {
  const e = err as { response?: { data?: { error?: { message?: string } } } };
  return e.response?.data?.error?.message || fallback;
};

export const fetchSubjects = createAsyncThunk('subjects/fetchSubjects', async (filters: Partial<SubjectFilters>, { rejectWithValue }) => {
  try {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)); });
    const { data } = await axiosInstance.get(`/subjects?${params}`);
    return { data: data.data as Subject[], meta: data.meta };
  } catch (err) { return rejectWithValue(rejectMsg(err, 'Failed to load subjects')); }
});

export const fetchSubjectById = createAsyncThunk('subjects/fetchById', async (id: string, { rejectWithValue }) => {
  try {
    const { data } = await axiosInstance.get(`/subjects/${id}`);
    return data.data as Subject;
  } catch (err) { return rejectWithValue(rejectMsg(err, 'Failed to load subject')); }
});

export const createSubject = createAsyncThunk('subjects/create', async (subjectData: Partial<Subject>, { rejectWithValue }) => {
  try {
    const { data } = await axiosInstance.post('/subjects', subjectData);
    return data.data as Subject;
  } catch (err) { return rejectWithValue(rejectMsg(err, 'Failed to create subject')); }
});

export const updateSubject = createAsyncThunk('subjects/update', async ({ id, updates }: { id: string; updates: Partial<Subject> }, { rejectWithValue }) => {
  try {
    const { data } = await axiosInstance.put(`/subjects/${id}`, updates);
    return data.data as Subject;
  } catch (err) { return rejectWithValue(rejectMsg(err, 'Failed to update subject')); }
});

export const deactivateSubject = createAsyncThunk('subjects/deactivate', async (id: string, { rejectWithValue }) => {
  try {
    await axiosInstance.delete(`/subjects/${id}`);
    return id;
  } catch (err) { return rejectWithValue(rejectMsg(err, 'Failed to deactivate subject')); }
});

export const enrollStudents = createAsyncThunk('subjects/enrollStudents', async ({ subjectId, studentIds }: { subjectId: string; studentIds: string[] }, { rejectWithValue }) => {
  try {
    const { data } = await axiosInstance.post(`/subjects/${subjectId}/students`, { studentIds });
    return data.data as BulkEnrollmentResult;
  } catch (err) { return rejectWithValue(rejectMsg(err, 'Failed to enroll students')); }
});

export const bulkEnrollCSV = createAsyncThunk('subjects/bulkEnrollCSV', async ({ subjectId, file }: { subjectId: string; file: File }, { rejectWithValue }) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await axiosInstance.post(`/subjects/${subjectId}/students/bulk`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data as BulkEnrollmentResult;
  } catch (err) { return rejectWithValue(rejectMsg(err, 'Bulk enrollment failed')); }
});

const subjectsSlice = createSlice({
  name: 'subjects',
  initialState,
  reducers: {
    setFilters(state, action: PayloadAction<Partial<SubjectFilters>>) {
      state.filters = { ...state.filters, ...action.payload, page: 1 };
    },
    resetFilters(state) { state.filters = defaultFilters; },
    clearBulkResult(state) { state.bulkResult = null; },
    clearError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSubjects.pending, (state) => { state.isLoading = true; })
      .addCase(fetchSubjects.fulfilled, (state, action) => {
        state.isLoading = false;
        state.list = action.payload.data;
        state.pagination = action.payload.meta;
      })
      .addCase(fetchSubjects.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; })
      .addCase(fetchSubjectById.fulfilled, (state, action) => { state.currentSubject = action.payload; })
      .addCase(createSubject.fulfilled, (state, action) => { state.list.unshift(action.payload); })
      .addCase(updateSubject.fulfilled, (state, action) => {
        const idx = state.list.findIndex(s => s._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
        if (state.currentSubject?._id === action.payload._id) state.currentSubject = action.payload;
      })
      .addCase(deactivateSubject.fulfilled, (state, action) => {
        const idx = state.list.findIndex(s => s._id === action.payload);
        if (idx !== -1) state.list[idx].isActive = false;
      })
      .addCase(enrollStudents.fulfilled, (state, action) => { state.bulkResult = action.payload; })
      .addCase(bulkEnrollCSV.pending, (state) => { state.isSaving = true; state.bulkResult = null; })
      .addCase(bulkEnrollCSV.fulfilled, (state, action) => { state.isSaving = false; state.bulkResult = action.payload; })
      .addCase(bulkEnrollCSV.rejected, (state, action) => { state.isSaving = false; state.error = action.payload as string; });
  },
});

export const { setFilters, resetFilters, clearBulkResult, clearError } = subjectsSlice.actions;
export default subjectsSlice.reducer;
