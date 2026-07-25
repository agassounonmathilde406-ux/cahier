import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const ROLE_LABELS = {
  owner: 'Propriétaire',
  admin_content: 'Administrateur de contenu',
  admin_validation: 'Administrateur de validation',
  admin_users: 'Administrateur utilisateurs',
  user: 'Élève',
};

export default function Profile() {
  const { user, token, logout } = useAuth();
  const [history, setHistory] = useState(null);

  useEffect(() => {
    api.history(token).then(setHistory).catch(() => {});
  }, [token]);

  if (!user) return null;

  return (
    <div>
      <h1>Mon profil</h1>
      <div className="form-card">
        <h3>{user.name}</h3>
        <p className="book-meta">{user.email || user.phone}</p>
        <span className="role-badge">{ROLE_LABELS[user.role] || user.role}</span>
      </div>

      <h2>Historique de paiement</h2>
      {history === null ? (
        <div className="skeleton" style={{ height: 100 }} />
      ) : history.length === 0 ? (
        <p className="empty-state">Aucune transaction pour le moment.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Cahier</th><th>Montant</th><th>Statut</th><th>Date</th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{h.title}</td>
                  <td>{h.amount.toLocaleString('fr-FR')} FCFA</td>
                  <td><span className={`status-tag status-${h.status}`}>{h.status}</span></td>
                  <td>{new Date(h.created_at).toLocaleDateString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button className="btn btn-secondary btn-block" style={{ marginTop: 20 }} onClick={logout}>Se déconnecter</button>
    </div>
  );
}
