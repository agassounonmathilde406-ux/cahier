import React from 'react';
import { Link } from 'react-router-dom';
import GoogleButton from '../components/GoogleButton.jsx';

// L'inscription se fait desormais UNIQUEMENT via Google (evite les faux
// comptes a coordonnees fictives, sans le cout d'un SMS de verification).
export default function Register() {
  return (
    <div>
      <h1>Créer un compte</h1>
      <p style={{ color: 'var(--ink-soft)', marginBottom: 18 }}>
        Pour garantir des comptes fiables, l'inscription se fait uniquement avec Google — rapide et sans mot de passe à retenir.
      </p>

      <GoogleButton />

      <p style={{ marginTop: 24, fontSize: 14 }}>
        Déjà un compte (admin/propriétaire) ? <Link to="/connexion" className="btn-link">Se connecter</Link>
      </p>
    </div>
  );
}
