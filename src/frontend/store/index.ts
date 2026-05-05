import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/store/authSlice';
import usersReducer from '../features/users/store/userSlice';
import subjectsReducer from '../features/subjects/store/subjectSlice';
import attendanceReducer from '../features/attendance/store/attendanceSlice';
import reportsReducer from '../features/reports/store/reportSlice';
import notificationsReducer from '../features/notifications/store/notificationSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    users: usersReducer,
    subjects: subjectsReducer,
    attendance: attendanceReducer,
    reports: reportsReducer,
    notifications: notificationsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
