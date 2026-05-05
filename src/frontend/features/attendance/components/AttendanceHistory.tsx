import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../../store';
import { fetchStudentHistory } from '../store/attendanceSlice';

interface AttendanceHistoryProps {
  studentId: string;
  subjectId?: string;
}

const AttendanceHistory: React.FC<AttendanceHistoryProps> = ({ studentId, subjectId }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { records, pagination, isLoading } = useSelector((s: RootState) => s.attendance);

  useEffect(() => {
    dispatch(fetchStudentHistory({ studentId, subjectId }));
  }, [dispatch, studentId, subjectId]);

  return (
    <div data-testid="attendance-history" aria-label="Attendance history">
      {isLoading && <div aria-busy="true">Loading...</div>}
      <table aria-label="Attendance records">
        <thead>
          <tr><th>Date</th><th>Subject</th><th>Session</th><th>Status</th></tr>
        </thead>
        <tbody>
          {records.map(record => (
            <tr key={record._id} data-testid={`history-row-${record._id}`}>
              <td>{new Date(record.date).toLocaleDateString()}</td>
              <td>{record.subjectId}</td>
              <td>{record.sessionId.split('_').pop()}</td>
              <td>
                <span aria-label={record.status} style={{ color: record.status === 'present' ? 'green' : 'red' }}>
                  {record.status === 'present' ? 'Present' : 'Absent'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p aria-live="polite">Total: {pagination.total} records</p>
    </div>
  );
};

export default AttendanceHistory;
