import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppDispatch, RootState } from '../../../store';
import { fetchSubjects } from '../store/subjectSlice';

const FacultySubjects: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { list, isLoading, error } = useSelector((s: RootState) => s.subjects);

  useEffect(() => {
    dispatch(fetchSubjects({ isActive: true, page: 1, limit: 50, sortBy: 'name', sortOrder: 'asc' }));
  }, [dispatch]);

  if (isLoading) return <div aria-busy="true">Loading subjects...</div>;

  return (
    <div data-testid="faculty-subjects" aria-label="My subjects">
      <h2>My Subjects</h2>
      {error && <div role="alert">{error}</div>}
      {list.length === 0 && <p>No subjects assigned yet.</p>}
      <div>
        {list.map(subject => (
          <div
            key={subject._id}
            data-testid={`faculty-subject-card-${subject._id}`}
            role="article"
            aria-label={`Subject: ${subject.name}`}
          >
            <h3>{subject.code} — {subject.name}</h3>
            <p>{subject.department} | {subject.semester} | {subject.academicYear}</p>
            <p>Students enrolled: {subject.studentIds.length}{subject.capacity ? ` / ${subject.capacity}` : ''}</p>
            <button
              data-testid={`faculty-subject-mark-attendance-${subject._id}`}
              onClick={() => navigate(`/faculty/attendance/${subject._id}`)}
              aria-label={`Mark attendance for ${subject.name}`}
            >
              Mark Attendance
            </button>
            <button
              data-testid={`faculty-subject-view-students-${subject._id}`}
              onClick={() => navigate(`/faculty/subjects/${subject._id}/students`)}
              aria-label={`View students for ${subject.name}`}
            >
              View Students
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FacultySubjects;
