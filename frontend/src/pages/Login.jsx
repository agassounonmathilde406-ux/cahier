import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import GoogleButton from '../components/GoogleButton.jsx';
import BookOpenIntro from '../components/BookOpenIntro.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(identifier.trim(), password);
      navigate('/');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <BookOpenIntro>
      <h1>Connexion</h1>
      {error && <p className="error-box">{error}</p>}

      <GoogleButton />
      <p style={{ textAlign: 'center', color: 'var(--ink-soft)', fontSize: 12, margin: '10px 0' }}>ou avec ton email/téléphone</p>

      <form className="form-card" onSubmit={submit}>
        <div className="field">
          <label>Email ou téléphone</label>
          <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
        </div>
        <div className="field">
          <label>Mot de passe</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button className="btn btn-primary btn-block" disabled={loading}>{loading ? '…' : 'Se connecter'}</button>
      </form>
      <p style={{ marginTop: 14, fontSize: 14 }}>
        Pas encore de compte ? <Link to="/inscription" className="btn-link">Créer un compte</Link>
      </p>
    </BookOpenIntro>
  );
}
