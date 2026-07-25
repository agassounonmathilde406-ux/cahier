import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function AdminTransactions() {
  const { token } = useAuth();
  const [filters, setFilters] = useState({ reference: '', status: '', date: '' });
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  function load() {
    api.transactions(filters, token).then(setRows).catch((e) => setError(e.message));
  }
  useEffect(load, [token]); // eslint-disable-line

  async function refund(id) {
    if (!confirm('Confirmer le remboursement de cette transaction ?')) return;
    try { await api.refund(id, { revokeAccess: false }, token); load(); } catch (e) { setError(e.message); }
  }

  return (
    <div>
      <h1>Transactions</h1>
      {error && <p className="error-box">{error}</p>}

      <div className="form-card" style={{ marginBottom: 12 }}>
        <div className="field"><label>Référence de paiement</label><input value={filters.reference} onChange={(e) => setFilters({ ...filters, reference: e.target.value })} /></div>
        <div className="field">
          <label>Statut</label>
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">Tous</option>
            <option value="pending">En attente</option>
            <option value="success">Réussie</option>
            <option value="failed">Échouée</option>
            <option value="refunded">Remboursée</option>
          </select>
        </div>
        <button className="btn btn-primary btn-block" onClick={load}>Rechercher</button>
      </div>

      {rows === null ? <div className="skeleton" style={{ height: 160 }} /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Cahier</th><th>Utilisateur</th><th>Montant</th><th>Statut</th><th>Date</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.book_title}</td>
                  <td>{r.user_name}</td>
                  <td>{r.amount.toLocaleString('fr-FR')} F</td>
                  <td><span className={`status-tag status-${r.status}`}>{r.status}</span></td>
                  <td>{new Date(r.created_at).toLocaleDateString('fr-FR')}</td>
                  <td>{r.status === 'success' && <button className="btn btn-secondary btn-sm" onClick={() => refund(r.id)}>Rembourser</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
