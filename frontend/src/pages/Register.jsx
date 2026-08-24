import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import GoogleButton from '../components/GoogleButton.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+229 ');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handlePhoneChange(e) {
    let v = e.target.value;
    if (!v.startsWith('+229')) v = '+229 ';
    setPhone(v);
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cleanPhone = phone.replace(/\s+/g, '');
      await register({
        name,
        phone: cleanPhone === '+229' ? undefined : cleanPhone,
        email: email || undefined,
        password,
      });
      navigate('/');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>Créer un compte</h1>
      {error && <p className="error-box">{error}</p>}

      <GoogleButton />
      <p style={{ textAlign: 'center', color: 'var(--ink-soft)', fontSize: 12, margin: '10px 0' }}>ou avec ton email/téléphone</p>

      <form className="form-card" onSubmit={submit}>
        <div className="field">
          <label>Nom complet</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label>Téléphone</label>
          <input value={phone} onChange={handlePhoneChange} inputMode="tel" />
        </div>
        <div className="field">
          <label>Email (optionnel)</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label>Mot de passe</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </div>
        <button className="btn btn-primary btn-block" disabled={loading}>{loading ? '…' : 'Créer mon compte'}</button>
      </form>
      <p style={{ marginTop: 14, fontSize: 14 }}>
        Déjà inscrit ? <Link to="/connexion" className="btn-link">Se connecter</Link>
      </p>
    </div>
  );
}
