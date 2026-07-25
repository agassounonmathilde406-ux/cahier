import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function AdminValidation() {
  const { token } = useAuth();
  const [pending, setPending] = useState(null);
  const [error, setError] = useState('');

  function load() {
    api.pendingBooks(token).then(setPending).catch((e) => setError(e.message));
  }
  useEffect(load, [token]);

  async function decide(id, decision) {
    try { await api.validateBook(id, decision, token); load(); } catch (e) { setError(e.message); }
  }

  return (
    <div>
      <h1>Validation des cahiers</h1>
      {error && <p className="error-box">{error}</p>}
      {pending === null ? <div className="skeleton" style={{ height: 160 }} /> : pending.length === 0 ? (
        <div className="empty-state"><span className="ic">✅</span>Aucun cahier en attente de validation.</div>
      ) : (
        pending.map((b) => (
          <div key={b.id} className="form-card" style={{ marginBottom: 12 }}>
            <h3>{b.title}</h3>
            <p className="book-meta">{b.level}{b.series ? ` ${b.series}` : ''} · {b.isFree ? 'Gratuit' : `${b.price} FCFA`}</p>
            <p style={{ fontSize: 14 }}>{b.description}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn btn-primary" onClick={() => decide(b.id, 'accept')}>Accepter</button>
              <button className="btn btn-danger" onClick={() => decide(b.id, 'refuse')}>Refuser</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
