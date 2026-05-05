import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../../store';
import { fetchSubjects, deactivateSubject, setFilters, resetFilters } from '../store/subjectSlice';

const DEPARTMENTS = ['Computer Science', 'Electronics', 'Mechanical', 'Civil', 'Mathematics'];
const SEMESTERS = ['1st Sem', '2nd Sem', '3rd Sem', '4th Sem', '5th Sem', '6th Sem'];

interface SubjectListProps {
  onEdit?: (subjectId: string) => void;
  onManageEnrollment?: (subjectId: string) => void;
}

const SubjectList: React.FC<SubjectListProps> = ({ onEdit, onManageEnrollment }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { list, pagination, filters, isLoading, error } = useSelector((s: RootState) => s.subjects);
  const role = useSelector((s: RootState) => s.auth.user?.role);

  useEffect(() => { dispatch(fetchSubjects(filters)); }, [dispatch, filters]);

  return (
    <div data-testid="subject-list" aria-label="Subject list">
      {/* Filters */}
      <div role="search">
        <input
          data-testid="subject-list-search-input"
          type="search"
          placeholder="Search subjects..."
          value={filters.search || ''}
          onChange={(e) => dispatch(setFilters({ search: e.target.value || undefined }))}
          aria-label="Search subjects"
        />
        <select
          data-testid="subject-list-department-filter"
          value={filters.department || ''}
          onChange={(e) => dispatch(setFilters({ department: e.target.value || undefined }))}
          aria-label="Filter by department"
        >
          <option value="">All Departments</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          data-testid="subject-list-semester-filter"
          value={filters.semester || ''}
          onChange={(e) => dispatch(setFilters({ semester: e.target.value || undefined }))}
          aria-label="Filter by semester"
        >
          <option value="">All Semesters</option>
          {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => dispatch(resetFilters())} aria-label="Reset filters">Reset</button>
      </div>

      {role === 'admin' && (
        <button data-testid="subject-list-create-button" onClick={() => onEdit?.('')} aria-label="Create subject">
          Create Subject
        </button>
      )}

      {error && <div role="alert">{error}</div>}
      {isLoading && <div aria-busy="true">Loading...</div>}

      <table aria-label="Subjects">
        <thead>
          <tr>
            <th>Code</th><th>Name</th><th>Department</th><th>Semester</th>
            <th>Credits</th><th>Enrolled</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map(subject => (
            <tr key={subject._id} data-testid={`subject-list-row-${subject._id}`}>
              <td>{subject.code}</td>
              <td>{subject.name}</td>
              <td>{subject.department}</td>
              <td>{subject.semester}</td>
              <td>{subject.credits}</td>
              <td>{subject.studentIds.length}{subject.capacity ? `/${subject.capacity}` : ''}</td>
              <td>{subject.isActive ? 'Active' : 'Inactive'}</td>
              <td>
                {role === 'admin' && (
                  <>
                    <button data-testid={`subject-list-edit-${subject._id}`} onClick={() => onEdit?.(subject._id)} aria-label={`Edit ${subject.name}`}>Edit</button>
                    <button data-testid={`subject-list-deactivate-${subject._id}`} onClick={() => dispatch(deactivateSubject(subject._id))} disabled={!subject.isActive} aria-label={`Deactivate ${subject.name}`}>Deactivate</button>
                    <button onClick={() => onManageEnrollment?.(subject._id)} aria-label={`Manage enrollment for ${subject.name}`}>Enrollment</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <nav aria-label="Pagination">
        <button data-testid="subject-list-pagination-prev" onClick={() => dispatch(setFilters({ page: filters.page - 1 }))} disabled={filters.page <= 1}>Previous</button>
        <span aria-live="polite">Page {pagination.page} of {pagination.totalPages}</span>
        <button data-testid="subject-list-pagination-next" onClick={() => dispatch(setFilters({ page: filters.page + 1 }))} disabled={filters.page >= pagination.totalPages}>Next</button>
      </nav>
    </div>
  );
};

export default SubjectList;
