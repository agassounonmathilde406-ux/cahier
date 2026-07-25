import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function BottomNav() {
  const { user } = useAuth();
  const isAdmin = user && user.role !== 'user';
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
        <span className="ic">🏠</span>Accueil
      </NavLink>
      <NavLink to="/bibliotheque" className={({ isActive }) => isActive ? 'active' : ''}>
        <span className="ic">📚</span>Ma bibliothèque
      </NavLink>
      {isAdmin && (
        <NavLink to="/admin" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="ic">📊</span>Admin
        </NavLink>
      )}
      <NavLink to="/profil" className={({ isActive }) => isActive ? 'active' : ''}>
        <span className="ic">👤</span>Profil
      </NavLink>
    </nav>
  );
}
