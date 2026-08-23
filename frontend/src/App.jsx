import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';

import Header from './components/Header.jsx';
import BottomNav from './components/BottomNav.jsx';

import Home from './pages/Home.jsx';
import BookDetail from './pages/BookDetail.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Library from './pages/Library.jsx';
import Profile from './pages/Profile.jsx';
import Recharge from './pages/Recharge.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import AdminBooks from './pages/AdminBooks.jsx';
import AdminValidation from './pages/AdminValidation.jsx';
import AdminUsers from './pages/AdminUsers.jsx';
import AdminAdmins from './pages/AdminAdmins.jsx';
import AdminTransactions from './pages/AdminTransactions.jsx';

function RequireAuth({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/connexion" replace />;
  return children;
}

function RequireRole({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/connexion" replace />;
  if (user.role !== 'owner' && !roles.includes(user.role)) {
    return <div className="page"><p className="error-box">Accès réservé aux administrateurs concernés.</p></div>;
  }
  return children;
}

export default function App() {
  return (
    <div className="page">
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/cahier/:id" element={<BookDetail />} />
        <Route path="/connexion" element={<Login />} />
        <Route path="/inscription" element={<Register />} />
        <Route path="/bibliotheque" element={<RequireAuth><Library /></RequireAuth>} />
        <Route path="/profil" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/recharge" element={<RequireAuth><Recharge /></RequireAuth>} />

        <Route path="/admin" element={<RequireRole roles={['admin_content','admin_validation','admin_users']}><AdminDashboard /></RequireRole>} />
        <Route path="/admin/cahiers" element={<RequireRole roles={['admin_content']}><AdminBooks /></RequireRole>} />
        <Route path="/admin/validation" element={<RequireRole roles={['admin_validation']}><AdminValidation /></RequireRole>} />
        <Route path="/admin/utilisateurs" element={<RequireRole roles={['admin_users']}><AdminUsers /></RequireRole>} />
        <Route path="/admin/administrateurs" element={<RequireRole roles={[]}><AdminAdmins /></RequireRole>} />
        <Route path="/admin/transactions" element={<RequireRole roles={[]}><AdminTransactions /></RequireRole>} />

        <Route path="*" element={<div className="empty-state"><span className="ic">🔎</span>Page introuvable.</div>} />
      </Routes>
      <BottomNav />
    </div>
  );
}
