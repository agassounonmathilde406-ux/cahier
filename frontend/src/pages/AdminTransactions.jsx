import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function AdminTransactions() {
  const { token } = useAuth();
  const [filters, setFilters] = useState({ id: '', reference: '', status: '', date: '' });
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [paymentMode, setPaymentMode] = useState(null);
  const [switching, setSwitching] = useState(false);

  function load() {
    api.transactions(filters, token).then(setRows).catch((e) => setError(e.message));
  }
  useEffect(load, [token]); // eslint-disable-line

  useEffect(() => {
    api.settings(token).then((s) => setPaymentMode(s.paymentMode)).catch(() => {});
  }, [token]);

  async function togglePaymentMode() {
    const next = paymentMode === 'manual' ? 'fedapay' : 'manual';
    setSwitching(true);
    try {
      const res = await api.setPaymentMode(next, token);
      setPaymentMode(res.paymentMode);
    } catch (e) {
      setError(e.message);
    } finally {
      setSwitching(false);
    }
  }

  async function refund(id) {
    if (!confirm('Confirmer le remboursement de cette transaction ?')) return;
    try { await api.refund(id, { revokeAccess: false }, token); load(); } catch (e) { setError(e.message); }
  }

  async function confirmManual(id) {
    if (!confirm("Confirmer que le paiement a bien été reçu et débloquer le cahier ?")) return;
    try { await api.confirmManual(id, token); load(); } catch (e) { setError(e.message); }
  }

  return (
    <div>
      <h1>Transactions</h1>
      {error && <p className="error-box">{error}</p>}

      <div className="form-card" style={{ marginBottom: 12 }}>
        <h3 style={{ marginBottom: 6 }}>Moyen de paiement actif sur le site</h3>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 10 }}>
          {paymentMode === 'manual'
            ? "Les acheteurs voient : envoyer l'argent directement au numéro + reçu WhatsApp. Tu confirmes toi-même chaque achat ci-dessous."
            : 'Les acheteurs paient automatiquement via FedaPay (MTN/Moov Money).'}
        </p>
        <button
          className={`btn ${paymentMode === 'manual' ? 'btn-gold' : 'btn-primary'} btn-block`}
          onClick={togglePaymentMode}
          disabled={paymentMode === null || switching}
        >
          {switching ? '…' : paymentMode === 'manual'
            ? 'Basculer sur FedaPay'
            : 'Basculer sur paiement manuel (numéro + WhatsApp)'}
        </button>
      </div>

      <div className="form-card" style={{ marginBottom: 12 }}>
        <div className="field"><label>ID de la transaction</label><input value={filters.id} onChange={(e) => setFilters({ ...filters, id: e.target.value })} placeholder="ex: 45793b50-..." /></div>
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
            <thead><tr><th>ID</th><th>Cahier</th><th>Utilisateur</th><th>Montant</th><th>Moyen</th><th>Statut</th><th>Date</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{r.id.slice(0, 8)}</td>
                  <td>{r.book_title}</td>
                  <td>{r.user_name}</td>
                  <td>{r.amount.toLocaleString('fr-FR')} F</td>
                  <td style={{ fontSize: 12 }}>{r.payment_method}</td>
                  <td><span className={`status-tag status-${r.status}`}>{r.status}</span></td>
                  <td>{new Date(r.created_at).toLocaleDateString('fr-FR')}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    {r.status === 'pending' && (
                      <button className="btn btn-gold btn-sm" onClick={() => confirmManual(r.id)}>Confirmer</button>
                    )}
                    {r.status === 'success' && (
                      <button className="btn btn-secondary btn-sm" onClick={() => refund(r.id)}>Rembourser</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
      }
