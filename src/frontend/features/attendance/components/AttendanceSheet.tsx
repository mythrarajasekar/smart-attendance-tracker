import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../../store';
import { markAttendance, lockSession, clearLastMarkResult } from '../store/attendanceSlice';

interface Student { _id: string; name: string; rollNumber: string; }

interface AttendanceSheetProps {
  subjectId: string;
  students: Student[];
  date: string;
  sessionLabel?: string;
}

const AttendanceSheet: React.FC<AttendanceSheetProps> = ({
  subjectId, students, date, sessionLabel = 'Default',
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { isSaving, lastMarkResult, error } = useSelector((s: RootState) => s.attendance);
  const [statuses, setStatuses] = useState<Record<string, 'present' | 'absent'>>(() =>
    Object.fromEntries(students.map(s => [s._id, 'present']))
  );
  const [isLocked, setIsLocked] = useState(false);

  const toggleStatus = (studentId: string) => {
    setStatuses(prev => ({ ...prev, [studentId]: prev[studentId] === 'present' ? 'absent' : 'present' }));
  };

  const handleMarkAll = (status: 'present' | 'absent') => {
    setStatuses(Object.fromEntries(students.map(s => [s._id, status])));
  };

  const handleSubmit = async () => {
    const records = students.map(s => ({ studentId: s._id, status: statuses[s._id] }));
    await dispatch(markAttendance({ subjectId, date, sessionLabel, records }));
  };

  const handleLock = async () => {
    if (!lastMarkResult?.sessionId) return;
    await dispatch(lockSession(lastMarkResult.sessionId));
    setIsLocked(true);
  };

  return (
    <div data-testid="attendance-sheet" aria-label="Attendance sheet">
      <div>
        <button onClick={() => handleMarkAll('present')} disabled={isLocked} aria-label="Mark all present">All Present</button>
        <button onClick={() => handleMarkAll('absent')} disabled={isLocked} aria-label="Mark all absent">All Absent</button>
      </div>

      <table aria-label="Student attendance">
        <thead>
          <tr><th>Roll No</th><th>Name</th><th>Status</th></tr>
        </thead>
        <tbody>
          {students.map(student => (
            <tr key={student._id} data-testid={`attendance-row-${student._id}`}>
              <td>{student.rollNumber}</td>
              <td>{student.name}</td>
              <td>
                <button
                  data-testid={`attendance-toggle-${student._id}`}
                  onClick={() => toggleStatus(student._id)}
                  disabled={isLocked}
                  aria-pressed={statuses[student._id] === 'present'}
                  aria-label={`${student.name}: ${statuses[student._id]}`}
                >
                  {statuses[student._id] === 'present' ? '✓ Present' : '✗ Absent'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {error && <div role="alert" aria-live="assertive">{error}</div>}

      {lastMarkResult && (
        <div role="status" aria-live="polite" data-testid="attendance-mark-result">
          Marked: {lastMarkResult.marked} | Present: {lastMarkResult.presentCount} | Absent: {lastMarkResult.absentCount}
        </div>
      )}

      <button
        data-testid="attendance-submit-button"
        onClick={handleSubmit}
        disabled={isSaving || isLocked}
        aria-busy={isSaving}
      >
        {isSaving ? 'Saving...' : 'Submit Attendance'}
      </button>

      {lastMarkResult && !isLocked && (
        <button
          data-testid="attendance-lock-button"
          onClick={handleLock}
          aria-label="Lock session to prevent further edits"
        >
          Lock Session
        </button>
      )}

      {isLocked && <p role="status">Session locked — no further edits allowed.</p>}
    </div>
  );
};

export default AttendanceSheet;
