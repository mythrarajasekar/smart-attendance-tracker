import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import ReportFilters from './ReportFilters';
import ExportButtons from './ExportButtons';

const StudentReports: React.FC = () => {
  const userId = useSelector((s: RootState) => s.auth.user?.id);
  if (!userId) return null;

  return (
    <div data-testid="student-reports" aria-label="My attendance reports">
      <h2>My Attendance Reports</h2>
      <ReportFilters />
      <ExportButtons scope="student" targetId={userId} />
    </div>
  );
};

export default StudentReports;
