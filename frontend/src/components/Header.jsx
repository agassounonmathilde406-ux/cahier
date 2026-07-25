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
            <span className="role-badge" title={user.role}>{user.name.split(' ')[0]}</span>
            <button className="icon-btn" title="Déconnexion" onClick={logout}>⏻</button>
          </>
        ) : (
          <Link to="/connexion" className="btn btn-secondary btn-sm">Connexion</Link>
        )}
      </div>
    </div>
  );
}
