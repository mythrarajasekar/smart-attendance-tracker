import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../../store';
import { markAttendance, lockSession, clearMarkResult } from '../store/attendanceSlice';
import { fetchSubjects } from '../../subjects/store/subjectSlice';
import AttendanceSheet, { StudentAttendanceRow } from '../components/AttendanceSheet';
import axiosInstance from '../../../shared/api/axiosInstance';

const SLOTS = ['Morning', 'Afternoon', 'Evening', '1', '2', '3'];

const FacultyAttendancePage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { list: subjects } = useSelector((s: RootState) => s.subjects);
  const { isSubmitting, lastMarkResult, error } = useSelector((s: RootState) => s.attendance);

  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState('Morning');
  const [students, setStudents] = useState<StudentAttendanceRow[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [isSessionLocked, setIsSessionLocked] = useState(false);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);

  useEffect(() => {
    dispatch(fetchSubjects({ isActive: true, page: 1, limit: 50, sortBy: 'name', sortOrder: 'asc' }));
  }, [dispatch]);

  const handleLoadStudents = async () => {
    if (!selectedSubject) return;
    setIsLoadingStudents(true);
    try {
      const { data } = await axiosInstance.get(`/subjects/${selectedSubject}/students?limit=500`);
      const rows: StudentAttendanceRow[] = data.data.map((s: { _id: string; name: string; rollNumber: string }) => ({
        studentId: s._id,
        name: s.name,
        rollNumber: s.rollNumber || '',
        status: 'present' as const,
      }));
      setStudents(rows);
      setSessionId(`${selectedSubject}_${selectedDate}_${selectedSlot}`);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const handleSubmit = async (records: StudentAttendanceRow[]) => {
    dispatch(clearMarkResult());
    await dispatch(markAttendance({
      subjectId: selectedSubject,
      date: selectedDate,
      slot: selectedSlot,
      records: records.map(r => ({ studentId: r.studentId, status: r.status })),
    }));
  };

  const handleLock = async () => {
    if (!sessionId) return;
    await dispatch(lockSession(sessionId));
    setIsSessionLocked(true);
  };

  return (
    <div data-testid="faculty-attendance-page" aria-label="Mark attendance">
      <h2>Mark Attendance</h2>

      <div>
        <label htmlFor="att-subject">Subject</label>
        <select
          id="att-subject"
          data-testid="faculty-attendance-subject-select"
          value={selectedSubject}
          onChange={e => setSelectedSubject(e.target.value)}
          aria-label="Select subject"
        >
          <option value="">Select Subject</option>
          {subjects.map(s => (
            <option key={s._id} value={s._id}>{s.code} — {s.name}</option>
          ))}
        </select>

        <label htmlFor="att-date">Date</label>
        <input
          id="att-date"
          data-testid="faculty-attendance-date-input"
          type="date"
          value={selectedDate}
          max={new Date().toISOString().split('T')[0]}
          onChange={e => setSelectedDate(e.target.value)}
          aria-label="Attendance date"
        />

        <label htmlFor="att-slot">Slot</label>
        <select
          id="att-slot"
          data-testid="faculty-attendance-slot-select"
          value={selectedSlot}
          onChange={e => setSelectedSlot(e.target.value)}
          aria-label="Select slot"
        >
          {SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <button
          data-testid="faculty-attendance-load-button"
          type="button"
          onClick={handleLoadStudents}
          disabled={!selectedSubject || isLoadingStudents}
          aria-label="Load students"
        >
          {isLoadingStudents ? 'Loading...' : 'Load Students'}
        </button>
      </div>

      {error && <div role="alert" aria-live="assertive">{error}</div>}

      {lastMarkResult && (
        <div role="status" aria-live="polite">
          Marked: {lastMarkResult.marked} | Skipped: {lastMarkResult.skipped}
          {lastMarkResult.errors.length > 0 && ` | Errors: ${lastMarkResult.errors.length}`}
        </div>
      )}

      {students.length > 0 && (
        <>
          <AttendanceSheet
            students={students}
            isLocked={isSessionLocked}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
          />
          {!isSessionLocked && lastMarkResult && (
            <button
              data-testid="faculty-attendance-lock-button"
              type="button"
              onClick={handleLock}
              aria-label="Lock session"
            >
              Lock Session
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default FacultyAttendancePage;
