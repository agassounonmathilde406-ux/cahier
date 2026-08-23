import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Header() {
  const { user, logout } = useAuth();
  return (
    <div className="topbar">
      <Link to="/" style={{ display: 'block' }}>
        <span className="brand">Kajye<span className="dot">.</span></span>
        <span className="brand-tagline">Cahiers de cours — Bénin</span>
      </Link>
      <div className="topbar-actions">
        {user ? (
          <>
            <Link to="/recharge" className="balance-pill" title="Recharger mon solde">
              <span>{(user.balance || 0).toLocaleString('fr-FR')} F</span>
              <span className="balance-plus">+</span>
            </Link>
            <span className="role-badge" title={user.role}>{user.name.split(' ')[0]}</span>
            <button className="icon-btn" title="Déconnexion" onClick={logout}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </>
        ) : (
          <Link to="/connexion" className="btn btn-secondary btn-sm">Connexion</Link>
        )}
      </div>
    </div>
  );
}
