import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import api from '../../api/axios';

export default function StudentDashboard() {
  const { user } = useSelector((s: RootState) => s.auth);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [percentages, setPercentages] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/subjects?isActive=true&limit=50')
      .then(async r => {
        const subs = r.data.data || [];
        setSubjects(subs);
        // Fetch percentage for each subject
        const pcts: Record<string, number> = {};
        await Promise.all(subs.map(async (s: any) => {
          try {
            const p = await api.get(`/attendance/student/${user?.id}/subject/${s._id}/percentage`);
            pcts[s._id] = p.data.data.percentage;
          } catch { pcts[s._id] = 0; }
        }));
        setPercentages(pcts);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user]);

  const getColor = (pct: number) => pct >= 75 ? '#27ae60' : pct >= 60 ? '#f39c12' : '#e74c3c';

  return (
    <div>
      <h2 style={styles.heading}>My Attendance</h2>
      <p style={{ color: '#666', marginBottom: 24 }}>Welcome back, {user?.name}</p>
      {loading ? <p>Loading…</p> : subjects.length === 0 ? (
        <div style={styles.empty}>You are not enrolled in any subjects yet.</div>
      ) : (
        <div style={styles.grid}>
          {subjects.map((s: any) => {
            const pct = percentages[s._id] ?? 0;
            return (
              <div key={s._id} style={styles.card}>
                <div style={styles.code}>{s.code}</div>
                <div style={styles.name}>{s.name}</div>
                <div style={styles.meta}>{s.department} · {s.semester}</div>
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: '#666' }}>Attendance</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: getColor(pct) }}>{pct.toFixed(1)}%</span>
                  </div>
                  <div style={{ background: '#eee', borderRadius: 4, height: 8 }}>
                    <div style={{ width: `${Math.min(pct, 100)}%`, background: getColor(pct), height: 8, borderRadius: 4, transition: 'width 0.5s' }} />
                  </div>
                  {pct < 75 && <div style={{ fontSize: 12, color: '#e74c3c', marginTop: 6 }}>⚠️ Below 75% threshold</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  heading: { fontSize: 24, fontWeight: 700, marginBottom: 8, color: '#1a1a2e' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 },
  card: { background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' },
  code: { fontSize: 12, fontWeight: 700, color: '#27ae60', background: '#f0fff4', padding: '2px 8px', borderRadius: 4, alignSelf: 'flex-start', display: 'inline-block', marginBottom: 6 },
  name: { fontSize: 16, fontWeight: 600, color: '#1a1a2e' },
  meta: { fontSize: 13, color: '#888' },
  empty: { background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', color: '#888', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' },
};
