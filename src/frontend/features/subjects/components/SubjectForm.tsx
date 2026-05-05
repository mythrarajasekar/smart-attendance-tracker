import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../../store';
import { createSubject, updateSubject, fetchSubjectById } from '../store/subjectSlice';

interface SubjectFormProps {
  subjectId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const DEPARTMENTS = ['Computer Science', 'Electronics', 'Mechanical', 'Civil', 'Mathematics'];
const SEMESTERS = ['1st Sem', '2nd Sem', '3rd Sem', '4th Sem', '5th Sem', '6th Sem'];

const SubjectForm: React.FC<SubjectFormProps> = ({ subjectId, onSuccess, onCancel }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { currentSubject, isSaving, error } = useSelector((s: RootState) => s.subjects);
  const isEdit = Boolean(subjectId);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [department, setDepartment] = useState('');
  const [semester, setSemester] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [credits, setCredits] = useState(3);
  const [capacity, setCapacity] = useState<string>('');

  useEffect(() => {
    if (subjectId) dispatch(fetchSubjectById(subjectId));
  }, [subjectId, dispatch]);

  useEffect(() => {
    if (isEdit && currentSubject) {
      setName(currentSubject.name);
      setCode(currentSubject.code);
      setDepartment(currentSubject.department);
      setSemester(currentSubject.semester);
      setAcademicYear(currentSubject.academicYear);
      setCredits(currentSubject.credits);
      setCapacity(currentSubject.capacity ? String(currentSubject.capacity) : '');
    }
  }, [isEdit, currentSubject]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name, code: code.toUpperCase(), department, semester, academicYear,
      credits, capacity: capacity ? parseInt(capacity, 10) : null,
    };
    const action = isEdit
      ? dispatch(updateSubject({ id: subjectId!, updates: payload }))
      : dispatch(createSubject(payload));
    const result = await action;
    if ((isEdit ? updateSubject : createSubject).fulfilled.match(result)) onSuccess();
  };

  return (
    <form data-testid="subject-form" onSubmit={handleSubmit} aria-label={isEdit ? 'Edit subject' : 'Create subject'}>
      <div>
        <label htmlFor="subject-name">Subject Name</label>
        <input id="subject-name" data-testid="subject-form-name-input" value={name} onChange={e => setName(e.target.value)} required aria-required="true" />
      </div>
      <div>
        <label htmlFor="subject-code">Subject Code</label>
        <input id="subject-code" data-testid="subject-form-code-input" value={code} onChange={e => setCode(e.target.value.toUpperCase())} required disabled={isEdit} aria-required="true" />
      </div>
      <div>
        <label htmlFor="subject-department">Department</label>
        <select id="subject-department" data-testid="subject-form-department-select" value={department} onChange={e => setDepartment(e.target.value)} required>
          <option value="">Select Department</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="subject-semester">Semester</label>
        <select id="subject-semester" data-testid="subject-form-semester-select" value={semester} onChange={e => setSemester(e.target.value)} required>
          <option value="">Select Semester</option>
          {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="subject-academic-year">Academic Year</label>
        <input id="subject-academic-year" data-testid="subject-form-academic-year-input" value={academicYear} onChange={e => setAcademicYear(e.target.value)} placeholder="2024-2025" required />
      </div>
      <div>
        <label htmlFor="subject-credits">Credits</label>
        <input id="subject-credits" data-testid="subject-form-credits-input" type="number" min={1} max={10} value={credits} onChange={e => setCredits(parseInt(e.target.value, 10))} required />
      </div>
      <div>
        <label htmlFor="subject-capacity">Capacity (leave blank for unlimited)</label>
        <input id="subject-capacity" data-testid="subject-form-capacity-input" type="number" min={1} value={capacity} onChange={e => setCapacity(e.target.value)} />
      </div>

      {error && <div role="alert">{error}</div>}

      <button type="submit" data-testid="subject-form-submit-button" disabled={isSaving} aria-busy={isSaving}>
        {isSaving ? 'Saving...' : isEdit ? 'Update Subject' : 'Create Subject'}
      </button>
      <button type="button" data-testid="subject-form-cancel-button" onClick={onCancel}>Cancel</button>
    </form>
  );
};

export default SubjectForm;
