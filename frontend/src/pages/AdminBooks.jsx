import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const LEVELS = ['6eme', '5eme', '4eme', '3eme', 'Seconde', 'Premiere', 'Terminale'];
const SERIES = ['A', 'B', 'C', 'D'];

export default function AdminBooks() {
  const { token, user } = useAuth();
  const [books, setBooks] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: '', description: '', level: '6eme', series: '', subjectId: '', author: '',
    isFree: 'false', price: '1000', previewPages: '5', cover: null, pdf: null,
  });

  function load() {
    api.allBooksAdmin(token).then(setBooks).catch((e) => setError(e.message));
    api.subjects().then(setSubjects).catch(() => {});
  }
  useEffect(load, [token]);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    setError(''); setNotice(''); setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v !== null && v !== '') fd.append(k, v); });
      const created = await api.createBook(fd, token);
      if (user.role === 'admin_content') {
        await api.submitBook(created.id, token);
        setNotice('Cahier créé et envoyé pour validation.');
      } else {
        setNotice('Cahier publié.');
      }
      setShowForm(false);
      setForm({ title: '', description: '', level: '6eme', series: '', subjectId: '', author: '', isFree: 'false', price: '1000', previewPages: '5', cover: null, pdf: null });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function archive(id) {
    try { await api.archiveBook(id, token); load(); } catch (e) { setError(e.message); }
  }

  return (
    <div>
      <h1>Gestion des cahiers</h1>
      {error && <p className="error-box">{error}</p>}
      {notice && <p className="notice-box">{notice}</p>}

      <button className="btn btn-primary btn-block" onClick={() => setShowForm((s) => !s)}>
        {showForm ? 'Annuler' : '+ Ajouter un cahier'}
      </button>

      {showForm && (
        <form className="form-card" style={{ marginTop: 12 }} onSubmit={submit}>
          <div className="field"><label>Titre</label><input value={form.title} onChange={(e) => set('title', e.target.value)} required /></div>
          <div className="field"><label>Description</label><textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} /></div>
          <div className="field">
            <label>Niveau</label>
            <select value={form.level} onChange={(e) => set('level', e.target.value)}>
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          {['Seconde', 'Premiere', 'Terminale'].includes(form.level) && (
            <div className="field">
              <label>Série</label>
              <select value={form.series} onChange={(e) => set('series', e.target.value)}>
                <option value="">—</option>
                {SERIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          <div className="field">
            <label>Matière</label>
            <select value={form.subjectId} onChange={(e) => set('subjectId', e.target.value)}>
              <option value="">—</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="field"><label>Auteur</label><input value={form.author} onChange={(e) => set('author', e.target.value)} /></div>
          <div className="field">
            <label>Statut</label>
            <select value={form.isFree} onChange={(e) => set('isFree', e.target.value)}>
              <option value="false">Payant</option>
              <option value="true">Gratuit</option>
            </select>
          </div>
          {form.isFree === 'false' && (
            <div className="field"><label>Prix (FCFA)</label><input type="number" value={form.price} onChange={(e) => set('price', e.target.value)} /></div>
          )}
          <div className="field"><label>Pages visibles en aperçu</label><input type="number" value={form.previewPages} onChange={(e) => set('previewPages', e.target.value)} /></div>
          <div className="field"><label>Couverture (image)</label><input type="file" accept="image/*" onChange={(e) => set('cover', e.target.files[0])} /></div>
          <div className="field"><label>Fichier PDF complet</label><input type="file" accept="application/pdf" onChange={(e) => set('pdf', e.target.files[0])} required /></div>
          <button className="btn btn-primary btn-block" disabled={saving}>{saving ? 'Envoi…' : 'Enregistrer le cahier'}</button>
        </form>
      )}

      <h2>Tous les cahiers</h2>
      {books === null ? <div className="skeleton" style={{ height: 160 }} /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Titre</th><th>Niveau</th><th>Statut</th><th>Prix</th><th></th></tr></thead>
            <tbody>
              {books.map((b) => (
                <tr key={b.id}>
                  <td>{b.title}</td>
                  <td>{b.level}{b.series ? ` ${b.series}` : ''}</td>
                  <td><span className={`status-tag status-${b.status === 'published' ? 'success' : b.status === 'pending' ? 'pending' : 'failed'}`}>{b.status}</span></td>
                  <td>{b.isFree ? 'Gratuit' : `${b.price} F`}</td>
                  <td>{b.status !== 'archived' && <button className="btn btn-secondary btn-sm" onClick={() => archive(b.id)}>Archiver</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
