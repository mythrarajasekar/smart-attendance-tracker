import React, { useEffect, useState } from 'react';
import api from '../../api/axios';

export default function FacultyDashboard() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/subjects?isActive=true&limit=50')
      .then(r => { setSubjects(r.data.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2 style={styles.heading}>Faculty Dashboard</h2>
      <p style={{ color: '#666', marginBottom: 24 }}>Your assigned subjects</p>
      {loading ? <p>Loading…</p> : subjects.length === 0 ? (
        <div style={styles.empty}>No subjects assigned yet. Contact admin.</div>
      ) : (
        <div style={styles.grid}>
          {subjects.map((s: any) => (
            <div key={s._id} style={styles.card}>
              <div style={styles.code}>{s.code}</div>
              <div style={styles.name}>{s.name}</div>
              <div style={styles.meta}>{s.department} · {s.semester}</div>
              <div style={styles.meta}>Students: {s.studentIds?.length ?? 0}{s.capacity ? ` / ${s.capacity}` : ''}</div>
              <a href={`/faculty/attendance?subject=${s._id}`} style={styles.btn}>Mark Attendance</a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  heading: { fontSize: 24, fontWeight: 700, marginBottom: 8, color: '#1a1a2e' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 },
  card: { background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: 8 },
  code: { fontSize: 12, fontWeight: 700, color: '#667eea', background: '#f0f0ff', padding: '2px 8px', borderRadius: 4, alignSelf: 'flex-start' },
  name: { fontSize: 16, fontWeight: 600, color: '#1a1a2e' },
  meta: { fontSize: 13, color: '#888' },
  btn: { marginTop: 8, background: '#667eea', color: '#fff', padding: '8px 16px', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600, textAlign: 'center' },
  empty: { background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', color: '#888', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' },
};
