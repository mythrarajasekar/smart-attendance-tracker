import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../../store';
import { enrollStudents, bulkEnrollCSV, clearBulkResult } from '../store/subjectSlice';

interface EnrollmentManagerProps {
  subjectId: string;
}

const EnrollmentManager: React.FC<EnrollmentManagerProps> = ({ subjectId }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { bulkResult, isSaving, error } = useSelector((s: RootState) => s.subjects);
  const [studentIdInput, setStudentIdInput] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);

  const handleEnrollSingle = async () => {
    if (!studentIdInput.trim()) return;
    await dispatch(enrollStudents({ subjectId, studentIds: [studentIdInput.trim()] }));
    setStudentIdInput('');
  };

  const handleBulkUpload = async () => {
    if (!csvFile) return;
    dispatch(clearBulkResult());
    await dispatch(bulkEnrollCSV({ subjectId, file: csvFile }));
    setCsvFile(null);
  };

  return (
    <div data-testid="enrollment-manager" aria-label="Enrollment manager">
      <h3>Enroll Students</h3>

      {/* Single enrollment */}
      <div>
        <label htmlFor="enroll-student-id">Student ID</label>
        <input
          id="enroll-student-id"
          data-testid="enrollment-student-id-input"
          value={studentIdInput}
          onChange={e => setStudentIdInput(e.target.value)}
          placeholder="MongoDB ObjectId"
          aria-label="Student ID to enroll"
        />
        <button
          data-testid="enrollment-enroll-button"
          onClick={handleEnrollSingle}
          disabled={!studentIdInput.trim() || isSaving}
          aria-label="Enroll student"
        >
          Enroll
        </button>
      </div>

      {/* Bulk CSV upload */}
      <div>
        <label htmlFor="bulk-upload">Bulk Enroll via CSV (rollNumber column required, max 1000 rows)</label>
        <input
          id="bulk-upload"
          data-testid="enrollment-bulk-upload-input"
          type="file"
          accept=".csv,text/csv"
          onChange={e => setCsvFile(e.target.files?.[0] || null)}
          aria-label="CSV file for bulk enrollment"
        />
        <button
          data-testid="enrollment-bulk-upload-button"
          onClick={handleBulkUpload}
          disabled={!csvFile || isSaving}
          aria-busy={isSaving}
          aria-label="Upload CSV and enroll"
        >
          {isSaving ? 'Uploading...' : 'Upload & Enroll'}
        </button>
      </div>

      {error && <div role="alert" aria-live="assertive">{error}</div>}

      {/* Bulk result summary */}
      {bulkResult && (
        <div data-testid="enrollment-bulk-result" role="status" aria-live="polite">
          <p>Enrolled: {bulkResult.enrolled}</p>
          <p>Already enrolled: {bulkResult.alreadyEnrolled}</p>
          <p>Capacity exceeded: {bulkResult.capacityExceeded}</p>
          <p>Not found: {bulkResult.notFound}</p>
          {bulkResult.failed.length > 0 && (
            <details>
              <summary>Errors ({bulkResult.failed.length})</summary>
              <ul>
                {bulkResult.failed.map((f, i) => (
                  <li key={i}>{f.studentId}: {f.reason}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
};

export default EnrollmentManager;
