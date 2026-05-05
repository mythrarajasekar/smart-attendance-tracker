import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import ReportFilters from './ReportFilters';
import ExportButtons from './ExportButtons';

type ReportScope = 'student' | 'subject';

const AdminReports: React.FC = () => {
  const [scope, setScope] = useState<ReportScope>('subject');
  const [targetId, setTargetId] = useState('');
  const subjects = useSelector((s: RootState) => s.subjects.list);
  const users = useSelector((s: RootState) => s.users.list);

  return (
    <div data-testid="admin-reports" aria-label="Admin reports">
      <h2>Attendance Reports</h2>

      <div>
        <label htmlFor="admin-report-scope">Report Scope</label>
        <select
          id="admin-report-scope"
          data-testid="admin-report-scope-select"
          value={scope}
          onChange={e => { setScope(e.target.value as ReportScope); setTargetId(''); }}
          aria-label="Select report scope"
        >
          <option value="student">Student Report</option>
          <option value="subject">Subject Report</option>
        </select>
      </div>

      {scope === 'student' && (
        <div>
          <label htmlFor="admin-report-student">Select Student</label>
          <select
            id="admin-report-student"
            data-testid="admin-report-student-select"
            value={targetId}
            onChange={e => setTargetId(e.target.value)}
            aria-label="Select student"
          >
            <option value="">-- Select Student --</option>
            {users.filter(u => u.role === 'student').map(u => (
              <option key={u._id} value={u._id}>{u.name} ({u.rollNumber})</option>
            ))}
          </select>
        </div>
      )}

      {scope === 'subject' && (
        <div>
          <label htmlFor="admin-report-subject">Select Subject</label>
          <select
            id="admin-report-subject"
            data-testid="admin-report-subject-select"
            value={targetId}
            onChange={e => setTargetId(e.target.value)}
            aria-label="Select subject"
          >
            <option value="">-- Select Subject --</option>
            {subjects.map(s => (
              <option key={s._id} value={s._id}>{s.code} — {s.name}</option>
            ))}
          </select>
        </div>
      )}

      {targetId && (
        <>
          <ReportFilters />
          <ExportButtons scope={scope} targetId={targetId} />
        </>
      )}
    </div>
  );
};

export default AdminReports;
