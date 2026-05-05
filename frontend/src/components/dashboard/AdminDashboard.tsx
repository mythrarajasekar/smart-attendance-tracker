import React, { useEffect, useState } from 'react';
import api from '../../api/axios';

interface Stats { users: number; subjects: number; }

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({ users: 0, subjects: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/users?limit=1').catch(() => ({ data: { meta: { total: 0 } } })),
      api.get('/subjects?limit=1').catch(() => ({ data: { meta: { total: 0 } } })),
    ]).then(([u, s]) => {
      setStats({ users: u.data.meta?.total ?? 0, subjects: s.data.meta?.total ?? 0 });
      setLoading(false);
    });
  }, []);

  const cards = [
    { label: 'Total Users', value: stats.users, icon: '👥', color: '#3498db' },
    { label: 'Total Subjects', value: stats.subjects, icon: '📚', color: '#9b59b6' },
    { label: 'System Status', value: 'Online', icon: '✅', color: '#27ae60' },
  ];

  return (
    <div>
      <h2 style={styles.heading}>Admin Dashboard</h2>
      {loading ? <p>Loading…</p> : (
        <div style={styles.grid}>
          {cards.map(c => (
            <div key={c.label} style={{ ...styles.card, borderTop: `4px solid ${c.color}` }}>
              <div style={{ fontSize: 32 }}>{c.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: c.color }}>{c.value}</div>
              <div style={{ fontSize: 14, color: '#666' }}>{c.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Quick Actions</h3>
        <div style={styles.actions}>
          {[
            { label: '+ Create User', href: '/admin/users' },
            { label: '+ Create Subject', href: '/admin/subjects' },
          ].map(a => (
            <a key={a.label} href={a.href} style={styles.actionBtn}>{a.label}</a>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  heading: { fontSize: 24, fontWeight: 700, marginBottom: 24, color: '#1a1a2e' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 20, marginBottom: 32 },
  card: { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 },
  section: { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' },
  sectionTitle: { fontSize: 16, fontWeight: 600, marginBottom: 16, color: '#333' },
  actions: { display: 'flex', gap: 12 },
  actionBtn: { background: '#667eea', color: '#fff', padding: '10px 20px', borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 600 },
};
