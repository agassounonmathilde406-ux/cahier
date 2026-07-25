import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function AdminDashboard() {
  const { token, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.dashboard(token).then(setStats).catch((e) => setError(e.message));
  }, [token]);

  return (
    <div>
      <h1>Tableau de bord</h1>
      <div className="chip-row">
        {(user.role === 'owner' || user.role === 'admin_content') && <Link to="/admin/cahiers" className="chip">📘 Cahiers</Link>}
        {(user.role === 'owner' || user.role === 'admin_validation') && <Link to="/admin/validation" className="chip">✅ Validation</Link>}
        {(user.role === 'owner' || user.role === 'admin_users') && <Link to="/admin/utilisateurs" className="chip">👥 Utilisateurs</Link>}
        {user.role === 'owner' && <Link to="/admin/administrateurs" className="chip">🛡️ Administrateurs</Link>}
        {user.role === 'owner' && <Link to="/admin/transactions" className="chip">💳 Transactions</Link>}
      </div>

      {error && <p className="error-box">{error}</p>}

      {!stats ? <div className="skeleton" style={{ height: 160 }} /> : (
        <>
          <div className="stat-grid">
            <Stat label="Revenus totaux" value={`${stats.totalRevenue.toLocaleString('fr-FR')} FCFA`} />
            <Stat label="Revenus du jour" value={`${stats.todayRevenue.toLocaleString('fr-FR')} FCFA`} />
            <Stat label="Revenus du mois" value={`${stats.monthRevenue.toLocaleString('fr-FR')} FCFA`} />
            <Stat label="Ventes totales" value={stats.totalSales} />
            <Stat label="Utilisateurs" value={stats.totalUsers} />
            <Stat label="Cahiers publiés" value={stats.totalBooks} />
            <Stat label="Transactions échouées" value={stats.failedTransactions} />
            <Stat label="Remboursements" value={stats.refundedTransactions} />
          </div>

          <h2>Cahiers les plus vendus</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Cahier</th><th>Ventes</th><th>Revenus</th></tr></thead>
              <tbody>
                {stats.topSelling.map((b) => (
                  <tr key={b.id}><td>{b.title}</td><td>{b.sales}</td><td>{b.revenue.toLocaleString('fr-FR')} FCFA</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2>Cahiers les plus consultés</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Cahier</th><th>Vues</th></tr></thead>
              <tbody>
                {stats.mostViewed.map((b) => (
                  <tr key={b.id}><td>{b.title}</td><td>{b.view_count}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat-card">
      <div className="val">{value}</div>
      <div className="lbl">{label}</div>
    </div>
  );
}
