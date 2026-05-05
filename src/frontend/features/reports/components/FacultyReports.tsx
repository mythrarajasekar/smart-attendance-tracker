import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import ReportFilters from './ReportFilters';
import ExportButtons from './ExportButtons';

const FacultyReports: React.FC = () => {
  const subjects = useSelector((s: RootState) => s.subjects.list);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');

  return (
    <div data-testid="faculty-reports" aria-label="Faculty reports">
      <h2>Subject Attendance Reports</h2>
      <div>
        <label htmlFor="faculty-report-subject">Select Subject</label>
        <select
          id="faculty-report-subject"
          data-testid="faculty-report-subject-select"
          value={selectedSubjectId}
          onChange={e => setSelectedSubjectId(e.target.value)}
          aria-label="Select subject for report"
        >
          <option value="">-- Select Subject --</option>
          {subjects.map(s => (
            <option key={s._id} value={s._id}>{s.code} — {s.name}</option>
          ))}
        </select>
      </div>
      {selectedSubjectId && (
        <>
          <ReportFilters />
          <ExportButtons scope="subject" targetId={selectedSubjectId} />
        </>
      )}
    </div>
  );
};

export default FacultyReports;
