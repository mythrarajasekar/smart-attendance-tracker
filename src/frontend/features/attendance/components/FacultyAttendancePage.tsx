import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import AttendanceSheet from './AttendanceSheet';
import AttendanceAnalytics from './AttendanceAnalytics';

interface FacultyAttendancePageProps {
  subjectId: string;
  students: Array<{ _id: string; name: string; rollNumber: string }>;
}

type Tab = 'mark' | 'analytics';

const FacultyAttendancePage: React.FC<FacultyAttendancePageProps> = ({ subjectId, students }) => {
  const [activeTab, setActiveTab] = useState<Tab>('mark');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [sessionLabel, setSessionLabel] = useState('Default');

  return (
    <div data-testid="faculty-attendance-page" aria-label="Faculty attendance management">
      <nav aria-label="Attendance tabs">
        <button
          data-testid="tab-mark-attendance"
          onClick={() => setActiveTab('mark')}
          aria-selected={activeTab === 'mark'}
          aria-controls="panel-mark"
        >
          Mark Attendance
        </button>
        <button
          data-testid="tab-analytics"
          onClick={() => setActiveTab('analytics')}
          aria-selected={activeTab === 'analytics'}
          aria-controls="panel-analytics"
        >
          Analytics
        </button>
      </nav>

      {activeTab === 'mark' && (
        <div id="panel-mark" role="tabpanel">
          <div>
            <label htmlFor="attendance-date">Date</label>
            <input
              id="attendance-date"
              data-testid="attendance-date-input"
              type="date"
              value={selectedDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={e => setSelectedDate(e.target.value)}
            />
            <label htmlFor="session-label">Session</label>
            <select
              id="session-label"
              data-testid="session-label-select"
              value={sessionLabel}
              onChange={e => setSessionLabel(e.target.value)}
            >
              <option value="Default">Default</option>
              <option value="Morning">Morning</option>
              <option value="Afternoon">Afternoon</option>
              <option value="Lab">Lab</option>
            </select>
          </div>
          <AttendanceSheet
            subjectId={subjectId}
            students={students}
            date={selectedDate}
            sessionLabel={sessionLabel}
          />
        </div>
      )}

      {activeTab === 'analytics' && (
        <div id="panel-analytics" role="tabpanel">
          <AttendanceAnalytics subjectId={subjectId} />
        </div>
      )}
    </div>
  );
};

export default FacultyAttendancePage;
