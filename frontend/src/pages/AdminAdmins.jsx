import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const ROLES = [
  { value: 'admin_content', label: 'Administrateur de contenu' },
  { value: 'admin_validation', label: 'Administrateur de validation' },
  { value: 'admin_users', label: 'Administrateur utilisateurs' },
];

export default function AdminAdmins() {
  const { token } = useAuth();
  const [admins, setAdmins] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: 'admin_content', canViewRevenue: false, canManagePayments: false });
  const [saving, setSaving] = useState(false);

  function load() {
    api.admins(token).then(setAdmins).catch((e) => setError(e.message));
  }
  useEffect(load, [token]);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api.createAdmin({
        name: form.name, email: form.email || undefined, phone: form.phone || undefined,
        password: form.password, role: form.role,
        permissions: { canViewRevenue: form.canViewRevenue, canManagePayments: form.canManagePayments },
      }, token);
      setForm({ name: '', email: '', phone: '', password: '', role: 'admin_content', canViewRevenue: false, canManagePayments: false });
      load();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  async function remove(id) {
    try { await api.removeAdmin(id, token); load(); } catch (e) { setError(e.message); }
  }

  return (
    <div>
      <h1>Administrateurs</h1>
      {error && <p className="error-box">{error}</p>}

      <form className="form-card" onSubmit={submit} style={{ marginBottom: 20 }}>
        <h3>Ajouter un administrateur</h3>
        <div className="field"><label>Nom</label><input value={form.name} onChange={(e) => set('name', e.target.value)} required /></div>
        <div className="field"><label>Email</label><input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
        <div className="field"><label>Téléphone</label><input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
        <div className="field"><label>Mot de passe</label><input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} required minLength={6} /></div>
        <div className="field">
          <label>Rôle</label>
          <select value={form.role} onChange={(e) => set('role', e.target.value)}>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label><input type="checkbox" checked={form.canViewRevenue} onChange={(e) => set('canViewRevenue', e.target.checked)} /> Peut consulter les revenus</label>
        </div>
        <div className="field">
          <label><input type="checkbox" checked={form.canManagePayments} onChange={(e) => set('canManagePayments', e.target.checked)} /> Peut gérer les remboursements</label>
        </div>
        <button className="btn btn-primary btn-block" disabled={saving}>{saving ? '…' : "Créer l'administrateur"}</button>
      </form>

      <h2>Administrateurs actuels</h2>
      {admins === null ? <div className="skeleton" style={{ height: 120 }} /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nom</th><th>Rôle</th><th></th></tr></thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.role}</td>
                  <td>{a.role !== 'owner' && <button className="btn btn-danger btn-sm" onClick={() => remove(a.id)}>Retirer</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
