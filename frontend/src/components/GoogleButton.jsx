import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Bouton "Se connecter avec Google". Ne s'affiche que si VITE_GOOGLE_CLIENT_ID
// est configuré au build du frontend (sinon, ce composant ne rend rien).
export default function GoogleButton() {
  const ref = useRef(null);
  const navigate = useNavigate();
  const { loginWithGoogle } = useAuth();

  useEffect(() => {
    if (!CLIENT_ID) return;

    function render() {
      if (!window.google?.accounts?.id || !ref.current) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: async (response) => {
          try {
            await loginWithGoogle(response.credential);
            navigate('/');
          } catch (e) {
            alert(e.message || 'Connexion Google impossible.');
          }
        },
      });
      window.google.accounts.id.renderButton(ref.current, {
        theme: 'outline', size: 'large', width: 280, locale: 'fr', text: 'continue_with',
      });
    }

    if (window.google?.accounts?.id) {
      render();
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          render();
        }
      }, 300);
      return () => clearInterval(interval);
    }
  }, [loginWithGoogle, navigate]);

  if (!CLIENT_ID) return null;

  return (
    <div style={{ margin: '14px 0', display: 'flex', justifyContent: 'center' }}>
      <div ref={ref} />
    </div>
  );
}
