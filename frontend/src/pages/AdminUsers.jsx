import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function AdminUsers() {
  const { token } = useAuth();
  const [q, setQ] = useState('');
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');

  function load() {
    api.users(q, token).then(setUsers).catch((e) => setError(e.message));
  }
  useEffect(load, [token]); // eslint-disable-line

  async function toggle(u) {
    try {
      if (u.status === 'active') await api.suspendUser(u.id, token);
      else await api.reactivateUser(u.id, token);
      load();
    } catch (e) { setError(e.message); }
  }

  return (
    <div>
      <h1>Utilisateurs</h1>
      {error && <p className="error-box">{error}</p>}
      <div className="search-bar" style={{ marginBottom: 12 }}>
        <input placeholder="Rechercher un utilisateur" value={q} onChange={(e) => setQ(e.target.value)} />
        <button onClick={load}>🔎</button>
      </div>
      {users === null ? <div className="skeleton" style={{ height: 160 }} /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nom</th><th>Contact</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email || u.phone}</td>
                  <td><span className={`status-tag ${u.status === 'active' ? 'status-success' : 'status-failed'}`}>{u.status}</span></td>
                  <td><button className="btn btn-secondary btn-sm" onClick={() => toggle(u)}>{u.status === 'active' ? 'Suspendre' : 'Réactiver'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
