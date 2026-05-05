import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from './store';
import LoginPage from './components/auth/LoginPage';
import Layout from './components/shared/Layout';
import ProtectedRoute from './components/shared/ProtectedRoute';
import AdminDashboard from './components/dashboard/AdminDashboard';
import FacultyDashboard from './components/dashboard/FacultyDashboard';
import StudentDashboard from './components/dashboard/StudentDashboard';

function RootRedirect() {
  const { isAuthenticated, user } = useSelector((s: RootState) => s.auth);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role === 'admin') return <Navigate to="/admin" replace />;
  if (user?.role === 'faculty') return <Navigate to="/faculty" replace />;
  return <Navigate to="/student" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/unauthorized" element={
          <div style={{ textAlign: 'center', padding: 60 }}>
            <h2>403 — Access Denied</h2>
            <p>You don't have permission to view this page.</p>
            <a href="/login">Go to Login</a>
          </div>
        } />

        {/* Admin routes */}
        <Route path="/admin/*" element={
          <ProtectedRoute roles={['admin']}>
            <Layout>
              <Routes>
                <Route index element={<AdminDashboard />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="subjects" element={<SubjectsPage />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        } />

        {/* Faculty routes */}
        <Route path="/faculty/*" element={
          <ProtectedRoute roles={['faculty']}>
            <Layout>
              <Routes>
                <Route index element={<FacultyDashboard />} />
                <Route path="attendance" element={<AttendancePage />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        } />

        {/* Student routes */}
        <Route path="/student/*" element={
          <ProtectedRoute roles={['student']}>
            <Layout>
              <Routes>
                <Route index element={<StudentDashboard />} />
                <Route path="attendance" element={<StudentAttendancePage />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

// ─── Inline page components ───────────────────────────────────────────────────

function UsersPage() {
  const [users, setUsers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [form, setForm] = React.useState({ name: '', email: '', password: '', role: 'student', department: '', rollNumber: '', employeeId: '', yearSemester: '', academicYear: '' });
  const [msg, setMsg] = React.useState('');

  React.useEffect(() => {
    import('./api/axios').then(({ default: api }) => {
      api.get('/users?limit=50').then(r => { setUsers(r.data.data || []); setLoading(false); }).catch(() => setLoading(false));
    });
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { default: api } = await import('./api/axios');
    try {
      const payload: any = { name: form.name, email: form.email, password: form.password, role: form.role };
      if (form.role !== 'admin') payload.department = form.department;
      if (form.role === 'student') { payload.rollNumber = form.rollNumber; payload.yearSemester = form.yearSemester; payload.academicYear = form.academicYear; }
      if (form.role === 'faculty') payload.employeeId = form.employeeId;
      await api.post('/users', payload);
      setMsg('✅ User created successfully!');
      // Reset form
      setForm({ name: '', email: '', password: '', role: 'student', department: '', rollNumber: '', employeeId: '', yearSemester: '', academicYear: '' });
      const r = await api.get('/users?limit=100');
      setUsers(r.data.data || []);
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.error?.message || 'Failed to create user'));
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24, color: '#1a1a2e' }}>User Management</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Create form */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          <h3 style={{ marginBottom: 16, fontSize: 16 }}>Create New User</h3>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Full Name', key: 'name', type: 'text', required: true },
              { label: 'Email', key: 'email', type: 'email', required: true },
              { label: 'Password (min 6 chars)', key: 'password', type: 'password', required: true },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input type={f.type} required={f.required} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #ddd', borderRadius: 6, fontSize: 13 }} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Role</label>
              <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #ddd', borderRadius: 6, fontSize: 13 }}>
                <option value="student">Student</option>
                <option value="faculty">Faculty</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {form.role !== 'admin' && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Department</label>
                <input required placeholder="e.g. Computer Science" value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #ddd', borderRadius: 6, fontSize: 13 }} />
              </div>
            )}
            {form.role === 'student' && (
              <>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Roll Number</label>
                  <input required placeholder="e.g. CS2024001" value={form.rollNumber} onChange={e => setForm(p => ({ ...p, rollNumber: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #ddd', borderRadius: 6, fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Year / Semester</label>
                  <input required placeholder="e.g. 3rd Sem" value={form.yearSemester} onChange={e => setForm(p => ({ ...p, yearSemester: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #ddd', borderRadius: 6, fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Academic Year</label>
                  <input required placeholder="e.g. 2024-2025" value={form.academicYear} onChange={e => setForm(p => ({ ...p, academicYear: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #ddd', borderRadius: 6, fontSize: 13 }} />
                </div>
              </>
            )}
            {form.role === 'faculty' && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Employee ID</label>
                <input required placeholder="e.g. FAC001" value={form.employeeId} onChange={e => setForm(p => ({ ...p, employeeId: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #ddd', borderRadius: 6, fontSize: 13 }} />
              </div>
            )}
            {msg && <div style={{ fontSize: 13, padding: '8px 12px', background: msg.startsWith('✅') ? '#f0fff4' : '#fff0f0', borderRadius: 6, color: msg.startsWith('✅') ? '#27ae60' : '#e74c3c' }}>{msg}</div>}
            <button type="submit" style={{ background: '#667eea', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Create User</button>
          </form>
        </div>
        {/* User list */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          <h3 style={{ marginBottom: 16, fontSize: 16 }}>All Users ({users.length})</h3>
          {loading ? <p>Loading…</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
              {users.map((u: any) => (
                <div key={u._id} style={{ padding: '10px 14px', border: '1px solid #eee', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{u.name}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>{u.email}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: u.role === 'admin' ? '#fde8e8' : u.role === 'faculty' ? '#e8f0fe' : '#e8fdf0', color: u.role === 'admin' ? '#e74c3c' : u.role === 'faculty' ? '#2980b9' : '#27ae60' }}>
                    {u.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SubjectsPage() {
  const [subjects, setSubjects] = React.useState<any[]>([]);
  const [users, setUsers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [form, setForm] = React.useState({ name: '', code: '', department: '', semester: '1st Sem', academicYear: '2024-2025', credits: '4' });
  const [msg, setMsg] = React.useState('');
  const [selectedSubject, setSelectedSubject] = React.useState<any>(null);
  const [enrollMsg, setEnrollMsg] = React.useState('');
  const [assignMsg, setAssignMsg] = React.useState('');
  const [selectedFacultyId, setSelectedFacultyId] = React.useState('');
  const [selectedStudentId, setSelectedStudentId] = React.useState('');

  const load = async () => {
    const { default: api } = await import('./api/axios');
    try {
      const [sRes, uRes] = await Promise.all([
        api.get('/subjects?limit=100'),
        api.get('/users?limit=200'),
      ]);
      setSubjects(sRes.data.data || []);
      setUsers(uRes.data.data || []);
    } catch (err: any) {
      console.error('Failed to load subjects/users:', err?.response?.data || err?.message);
    }
    setLoading(false);
  };
  React.useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { default: api } = await import('./api/axios');
    try {
      await api.post('/subjects', { ...form, code: form.code.toUpperCase(), credits: parseInt(form.credits) });
      setMsg('✅ Subject created!');
      setForm({ name: '', code: '', department: '', semester: '1st Sem', academicYear: '2024-2025', credits: '4' });
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.error?.message || 'Failed'));
    }
  };

  const handleEnrollStudent = async (subjectId: string, studentId: string) => {
    if (!studentId) return;
    const { default: api } = await import('./api/axios');
    try {
      const res = await api.post(`/subjects/${subjectId}/students`, { studentIds: [studentId] });
      const r = res.data.data;
      if (r.enrolled > 0) setEnrollMsg('✅ Student enrolled successfully!');
      else if (r.alreadyEnrolled > 0) setEnrollMsg('ℹ️ Student is already enrolled.');
      else setEnrollMsg('❌ Could not enroll: ' + (r.failed?.[0]?.reason || 'Unknown error'));
      load();
    } catch (err: any) {
      setEnrollMsg('❌ ' + (err.response?.data?.error?.message || 'Failed'));
    }
  };

  const handleAssignFaculty = async (subjectId: string, facultyId: string) => {
    if (!facultyId) return;
    const { default: api } = await import('./api/axios');
    try {
      await api.post(`/subjects/${subjectId}/faculty`, { facultyId });
      setAssignMsg('✅ Faculty assigned successfully!');
      load();
    } catch (err: any) {
      setAssignMsg('❌ ' + (err.response?.data?.error?.message || 'Failed'));
    }
  };

  const handleUnenroll = async (subjectId: string, studentId: string) => {
    const { default: api } = await import('./api/axios');
    try {
      await api.delete(`/subjects/${subjectId}/students/${studentId}`);
      setEnrollMsg('✅ Student unenrolled.');
      load();
      // Refresh selected subject
      if (selectedSubject?._id === subjectId) {
        setSelectedSubject((prev: any) => ({ ...prev, studentIds: prev.studentIds.filter((id: string) => id !== studentId) }));
      }
    } catch (err: any) {
      setEnrollMsg('❌ ' + (err.response?.data?.error?.message || 'Failed'));
    }
  };

  const students = users.filter((u: any) => u.role === 'student');
  const faculty = users.filter((u: any) => u.role === 'faculty');

  // Enrich selected subject with user names
  const enrichedSubject = selectedSubject ? {
    ...selectedSubject,
    enrolledStudents: students.filter((s: any) => selectedSubject.studentIds?.includes(s._id)),
    assignedFaculty: faculty.filter((f: any) => selectedSubject.facultyIds?.includes(f._id)),
  } : null;

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24, color: '#1a1a2e' }}>Subject Management</h2>
      <div style={{ display: 'grid', gridTemplateColumns: selectedSubject ? '1fr 1fr' : '1fr 2fr', gap: 24 }}>

        {/* Create Subject */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          <h3 style={{ marginBottom: 16, fontSize: 16 }}>Create Subject</h3>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Subject Name', key: 'name', placeholder: 'Data Structures' },
              { label: 'Subject Code', key: 'code', placeholder: 'CS301' },
              { label: 'Department', key: 'department', placeholder: 'Computer Science' },
              { label: 'Academic Year', key: 'academicYear', placeholder: '2024-2025' },
              { label: 'Credits', key: 'credits', placeholder: '4' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input required placeholder={f.placeholder} value={(form as any)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #ddd', borderRadius: 6, fontSize: 13 }} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Semester</label>
              <select value={form.semester} onChange={e => setForm(p => ({ ...p, semester: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #ddd', borderRadius: 6, fontSize: 13 }}>
                {['1st Sem','2nd Sem','3rd Sem','4th Sem','5th Sem','6th Sem'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            {msg && <div style={{ fontSize: 13, padding: '8px 12px', background: msg.startsWith('✅') ? '#f0fff4' : '#fff0f0', borderRadius: 6 }}>{msg}</div>}
            <button type="submit" style={{ background: '#9b59b6', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Create Subject
            </button>
          </form>
        </div>

        {/* Subject List */}
        {!selectedSubject ? (
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
            <h3 style={{ marginBottom: 16, fontSize: 16 }}>All Subjects ({subjects.length})</h3>
            {loading ? <p>Loading…</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 500, overflowY: 'auto' }}>
                {subjects.map((s: any) => (
                  <div key={s._id} style={{ padding: '12px 16px', border: '1px solid #eee', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{s.code} — {s.name}</div>
                      <div style={{ fontSize: 12, color: '#888' }}>{s.department} · {s.semester} · {s.academicYear}</div>
                      <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                        👥 {s.studentIds?.length ?? 0} students · 👨‍🏫 {s.facultyIds?.length ?? 0} faculty
                      </div>
                    </div>
                    <button onClick={() => { setSelectedSubject(s); setEnrollMsg(''); setAssignMsg(''); }}
                      style={{ background: '#667eea', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                      Manage
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Enrollment Management Panel */
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>{selectedSubject.code} — {selectedSubject.name}</h3>
                <div style={{ fontSize: 13, color: '#888' }}>{selectedSubject.department} · {selectedSubject.semester}</div>
              </div>
              <button onClick={() => setSelectedSubject(null)}
                style={{ background: '#f5f5f5', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}>
                ← Back
              </button>
            </div>

            {/* Assign Faculty */}
            <div style={{ marginBottom: 20, padding: 16, background: '#f8f9ff', borderRadius: 8 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>👨‍🏫 Assign Faculty</h4>
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  value={selectedFacultyId}
                  onChange={e => setSelectedFacultyId(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', border: '1.5px solid #ddd', borderRadius: 6, fontSize: 13 }}>
                  <option value="">-- Select Faculty --</option>
                  {faculty.map((f: any) => (
                    <option key={f._id} value={f._id}>{f.name} ({f.employeeId || f.email})</option>
                  ))}
                </select>
                <button
                  onClick={() => { handleAssignFaculty(selectedSubject._id, selectedFacultyId); setSelectedFacultyId(''); }}
                  disabled={!selectedFacultyId}
                  style={{ background: selectedFacultyId ? '#2980b9' : '#aaa', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: selectedFacultyId ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600 }}>
                  Assign
                </button>
              </div>
              {assignMsg && <div style={{ marginTop: 8, fontSize: 13, color: assignMsg.startsWith('✅') ? '#27ae60' : '#e74c3c' }}>{assignMsg}</div>}
              {enrichedSubject?.assignedFaculty?.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Currently assigned:</div>
                  {enrichedSubject.assignedFaculty.map((f: any) => (
                    <span key={f._id} style={{ display: 'inline-block', background: '#e8f0fe', color: '#2980b9', padding: '2px 10px', borderRadius: 12, fontSize: 12, marginRight: 6 }}>
                      {f.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Enroll Students */}
            <div style={{ padding: 16, background: '#f0fff4', borderRadius: 8 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>👥 Enroll Students</h4>
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  value={selectedStudentId}
                  onChange={e => setSelectedStudentId(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', border: '1.5px solid #ddd', borderRadius: 6, fontSize: 13 }}>
                  <option value="">-- Select Student --</option>
                  {students.map((s: any) => (
                    <option key={s._id} value={s._id}>{s.name} ({s.rollNumber || s.email})</option>
                  ))}
                </select>
                <button
                  onClick={() => { handleEnrollStudent(selectedSubject._id, selectedStudentId); setSelectedStudentId(''); }}
                  disabled={!selectedStudentId}
                  style={{ background: selectedStudentId ? '#27ae60' : '#aaa', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: selectedStudentId ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600 }}>
                  Enroll
                </button>
              </div>
              {enrollMsg && <div style={{ marginTop: 8, fontSize: 13, color: enrollMsg.startsWith('✅') ? '#27ae60' : enrollMsg.startsWith('ℹ️') ? '#2980b9' : '#e74c3c' }}>{enrollMsg}</div>}

              {/* Enrolled students list */}
              {enrichedSubject?.enrolledStudents?.length > 0 ? (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
                    Enrolled students ({enrichedSubject.enrolledStudents.length}):
                  </div>
                  <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {enrichedSubject.enrolledStudents.map((s: any) => (
                      <div key={s._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#fff', borderRadius: 6, border: '1px solid #e0f0e8' }}>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</span>
                          <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>{s.rollNumber || s.email}</span>
                        </div>
                        <button onClick={() => handleUnenroll(selectedSubject._id, s._id)}
                          style={{ background: 'none', border: '1px solid #e74c3c', color: '#e74c3c', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 12 }}>
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 10, fontSize: 13, color: '#888' }}>No students enrolled yet.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AttendancePage() {
  const [subjects, setSubjects] = React.useState<any[]>([]);
  const [selected, setSelected] = React.useState('');
  const [students, setStudents] = React.useState<any[]>([]);
  const [statuses, setStatuses] = React.useState<Record<string, string>>({});
  const [date, setDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [sessionLabel, setSessionLabel] = React.useState('Default');
  const [msg, setMsg] = React.useState('');

  React.useEffect(() => {
    import('./api/axios').then(({ default: api }) => {
      api.get('/subjects?isActive=true&limit=50').then(r => setSubjects(r.data.data || []));
    });
  }, []);

  const loadStudents = async (subjectId: string) => {
    const { default: api } = await import('./api/axios');
    const r = await api.get(`/subjects/${subjectId}/students?limit=100`);
    const studs = r.data.data || [];
    setStudents(studs);
    const init: Record<string, string> = {};
    studs.forEach((s: any) => { init[s._id] = 'present'; });
    setStatuses(init);
  };

  const handleSubjectChange = (id: string) => { setSelected(id); if (id) loadStudents(id); };

  const handleSubmit = async () => {
    const { default: api } = await import('./api/axios');
    try {
      const records = students.map((s: any) => ({ studentId: s._id, status: statuses[s._id] || 'absent' }));
      await api.post('/attendance', { subjectId: selected, date, sessionLabel, records });
      setMsg('✅ Attendance marked successfully!');
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.error?.message || 'Failed'));
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24, color: '#1a1a2e' }}>Mark Attendance</h2>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Subject</label>
            <select value={selected} onChange={e => handleSubjectChange(e.target.value)}
              style={{ padding: '8px 12px', border: '1.5px solid #ddd', borderRadius: 6, fontSize: 13, minWidth: 200 }}>
              <option value="">-- Select Subject --</option>
              {subjects.map((s: any) => <option key={s._id} value={s._id}>{s.code} — {s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Date</label>
            <input type="date" value={date} max={new Date().toISOString().split('T')[0]} onChange={e => setDate(e.target.value)}
              style={{ padding: '8px 12px', border: '1.5px solid #ddd', borderRadius: 6, fontSize: 13 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Session</label>
            <select value={sessionLabel} onChange={e => setSessionLabel(e.target.value)}
              style={{ padding: '8px 12px', border: '1.5px solid #ddd', borderRadius: 6, fontSize: 13 }}>
              {['Default','Morning','Afternoon','Lab'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        {students.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button onClick={() => { const n: Record<string,string> = {}; students.forEach((s: any) => n[s._id] = 'present'); setStatuses(n); }}
              style={{ background: '#27ae60', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}>All Present</button>
            <button onClick={() => { const n: Record<string,string> = {}; students.forEach((s: any) => n[s._id] = 'absent'); setStatuses(n); }}
              style={{ background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}>All Absent</button>
          </div>
        )}
      </div>
      {students.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #eee' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 13, color: '#666' }}>Roll No</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 13, color: '#666' }}>Name</th>
                <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: 13, color: '#666' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s: any) => (
                <tr key={s._id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: '#888' }}>{s.rollNumber || '—'}</td>
                  <td style={{ padding: '10px 12px', fontSize: 14, fontWeight: 500 }}>{s.name}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <button onClick={() => setStatuses(p => ({ ...p, [s._id]: p[s._id] === 'present' ? 'absent' : 'present' }))}
                      style={{ background: statuses[s._id] === 'present' ? '#27ae60' : '#e74c3c', color: '#fff', border: 'none', borderRadius: 20, padding: '4px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600, minWidth: 80 }}>
                      {statuses[s._id] === 'present' ? '✓ Present' : '✗ Absent'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {msg && <div style={{ marginTop: 12, padding: '10px 14px', background: msg.startsWith('✅') ? '#f0fff4' : '#fff0f0', borderRadius: 8, fontSize: 13 }}>{msg}</div>}
          <button onClick={handleSubmit} style={{ marginTop: 16, background: '#667eea', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 28px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
            Submit Attendance
          </button>
        </div>
      )}
    </div>
  );
}

function StudentAttendancePage() {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16, color: '#1a1a2e' }}>My Attendance History</h2>
      <p style={{ color: '#888' }}>Select a subject from the dashboard to view detailed attendance history.</p>
    </div>
  );
}
