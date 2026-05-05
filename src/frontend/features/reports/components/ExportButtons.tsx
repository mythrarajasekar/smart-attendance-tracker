import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../../store';
import { downloadStudentReport, downloadSubjectReport } from '../store/reportSlice';

interface ExportButtonsProps {
  scope: 'student' | 'subject';
  targetId: string;
}

const ExportButtons: React.FC<ExportButtonsProps> = ({ scope, targetId }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { filters, isGenerating, error, lastFilename } = useSelector((s: RootState) => s.reports);

  const handleExport = () => {
    if (scope === 'student') {
      dispatch(downloadStudentReport({ studentId: targetId, filters }));
    } else {
      dispatch(downloadSubjectReport({ subjectId: targetId, filters }));
    }
  };

  return (
    <div data-testid="export-buttons" aria-label="Export report">
      <button
        data-testid="export-download-button"
        onClick={handleExport}
        disabled={isGenerating}
        aria-busy={isGenerating}
        aria-label={`Download ${filters.format.toUpperCase()} report`}
      >
        {isGenerating ? 'Generating...' : `Download ${filters.format.toUpperCase()}`}
      </button>
      {error && <div role="alert" aria-live="assertive">{error}</div>}
      {lastFilename && !isGenerating && (
        <div role="status" aria-live="polite">Downloaded: {lastFilename}</div>
      )}
    </div>
  );
};

export default ExportButtons;
