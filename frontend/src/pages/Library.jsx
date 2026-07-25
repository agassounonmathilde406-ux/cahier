import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Library() {
  const { token } = useAuth();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.library(token).then(setItems).catch((e) => setError(e.message));
  }, [token]);

  async function download(bookId) {
    try {
      const { url } = await api.downloadLink(bookId, token);
      window.location.href = url;
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <h1>Ma bibliothèque</h1>
      {error && <p className="error-box">{error}</p>}
      {items === null ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : items.length === 0 ? (
        <div className="empty-state">
          <span className="ic">📚</span>
          Ta bibliothèque est vide pour l'instant.
          <div style={{ marginTop: 12 }}><Link to="/" className="btn btn-primary">Découvrir les cahiers</Link></div>
        </div>
      ) : (
        items.map((it) => (
          <div key={it.purchaseId} className="library-item">
            <div className="cover-thumb">{it.coverUrl && <img src={it.coverUrl} alt="" />}</div>
            <div style={{ flex: 1 }}>
              <h3>{it.title}</h3>
              <span className="book-meta">{it.level}{it.series ? ` ${it.series}` : ''} · acheté le {new Date(it.purchasedAt).toLocaleDateString('fr-FR')}</span>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => download(it.bookId)}>⬇️</button>
          </div>
        ))
      )}
    </div>
  );
}
