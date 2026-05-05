import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axiosInstance from '../../../shared/api/axiosInstance';

export interface ReportFilters {
  month: number;
  year: number;
  format: 'pdf' | 'excel' | 'csv';
}

interface ReportsState {
  filters: ReportFilters;
  isGenerating: boolean;
  error: string | null;
  lastFilename: string | null;
}

const currentDate = new Date();
const initialState: ReportsState = {
  filters: { month: currentDate.getMonth() + 1, year: currentDate.getFullYear(), format: 'pdf' },
  isGenerating: false,
  error: null,
  lastFilename: null,
};

async function downloadReport(url: string, params: ReportFilters, filename: string): Promise<string> {
  const response = await axiosInstance.get(url, {
    params,
    responseType: 'blob',
  });
  const blob = new Blob([response.data], { type: response.headers['content-type'] });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
  return filename;
}

export const downloadStudentReport = createAsyncThunk(
  'reports/downloadStudent',
  async ({ studentId, filters }: { studentId: string; filters: ReportFilters }, { rejectWithValue }) => {
    try {
      const ext = filters.format === 'excel' ? 'xlsx' : filters.format;
      const filename = `attendance_${studentId}_${filters.year}_${String(filters.month).padStart(2, '0')}.${ext}`;
      return await downloadReport(`/reports/student/${studentId}/monthly`, filters, filename);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      return rejectWithValue(e.response?.data?.error?.message || 'Failed to generate report');
    }
  }
);

export const downloadSubjectReport = createAsyncThunk(
  'reports/downloadSubject',
  async ({ subjectId, filters }: { subjectId: string; filters: ReportFilters }, { rejectWithValue }) => {
    try {
      const ext = filters.format === 'excel' ? 'xlsx' : filters.format;
      const filename = `attendance_subject_${subjectId}_${filters.year}_${String(filters.month).padStart(2, '0')}.${ext}`;
      return await downloadReport(`/reports/subject/${subjectId}/monthly`, filters, filename);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      return rejectWithValue(e.response?.data?.error?.message || 'Failed to generate report');
    }
  }
);

const reportsSlice = createSlice({
  name: 'reports',
  initialState,
  reducers: {
    setFilters(state, action: PayloadAction<Partial<ReportFilters>>) {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(downloadStudentReport.pending, (state) => { state.isGenerating = true; state.error = null; })
      .addCase(downloadStudentReport.fulfilled, (state, action) => { state.isGenerating = false; state.lastFilename = action.payload; })
      .addCase(downloadStudentReport.rejected, (state, action) => { state.isGenerating = false; state.error = action.payload as string; })
      .addCase(downloadSubjectReport.pending, (state) => { state.isGenerating = true; state.error = null; })
      .addCase(downloadSubjectReport.fulfilled, (state, action) => { state.isGenerating = false; state.lastFilename = action.payload; })
      .addCase(downloadSubjectReport.rejected, (state, action) => { state.isGenerating = false; state.error = action.payload as string; });
  },
});

export const { setFilters, clearError } = reportsSlice.actions;
export default reportsSlice.reducer;
