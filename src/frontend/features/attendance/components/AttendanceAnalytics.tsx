import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../../store';
import { fetchSubjectAttendance } from '../store/attendanceSlice';

interface AttendanceAnalyticsProps {
  subjectId: string;
  threshold?: number;
}

interface StudentSummary {
  studentId: string;
  attended: number;
  total: number;
  percentage: number;
}

const AttendanceAnalytics: React.FC<AttendanceAnalyticsProps> = ({ subjectId, threshold = 75 }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { subjectSummary, pagination, isLoading } = useSelector((s: RootState) => s.attendance);

  useEffect(() => {
    dispatch(fetchSubjectAttendance({ subjectId }));
  }, [dispatch, subjectId]);

  const summaries = subjectSummary as StudentSummary[];
  const belowThreshold = summaries.filter(s => s.percentage < threshold);

  return (
    <div data-testid="attendance-analytics" aria-label="Attendance analytics">
      <h3>Attendance Summary</h3>
      {isLoading && <div aria-busy="true">Loading...</div>}

      {belowThreshold.length > 0 && (
        <div role="alert" aria-label="Low attendance warning">
          <strong>{belowThreshold.length} student(s) below {threshold}% threshold</strong>
        </div>
      )}

      <table aria-label="Student attendance percentages">
        <thead>
          <tr><th>Student ID</th><th>Attended</th><th>Total</th><th>Percentage</th></tr>
        </thead>
        <tbody>
          {summaries.map(s => (
            <tr
              key={s.studentId}
              data-testid={`analytics-row-${s.studentId}`}
              aria-label={`${s.studentId}: ${s.percentage}%`}
            >
              <td>{s.studentId}</td>
              <td>{s.attended}</td>
              <td>{s.total}</td>
              <td style={{ color: s.percentage < threshold ? 'red' : 'green' }}>
                {s.percentage.toFixed(2)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p aria-live="polite">Total students: {pagination.total}</p>
    </div>
  );
};

export default AttendanceAnalytics;
