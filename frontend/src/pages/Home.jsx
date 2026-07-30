import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import BookCard from '../components/BookCard.jsx';
import Mascot from '../components/Mascot.jsx';

const LEVELS = ['6eme', '5eme', '4eme', '3eme', 'Seconde', 'Premiere', 'Terminale'];

export default function Home() {
  const [q, setQ] = useState('');
  const [level, setLevel] = useState('');
  const [books, setBooks] = useState(null);
  const [popular, setPopular] = useState(null);
  const [free, setFree] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.books({ sort: 'popular' }).then((r) => setPopular(r.slice(0, 6))).catch(() => {});
    api.books({ free: 'true' }).then((r) => setFree(r.slice(0, 6))).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      api.books({ q, level })
        .then(setBooks)
        .catch((e) => setError(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [q, level]);

  const firstLoad = !q && !level && free === null && popular === null && books === null;

  return (
    <div>
      <div className="hero">
        <h1>Tes cahiers de cours,<br />dans ta poche.</h1>
        <p>Des cahiers numériques clairs, du collège à la terminale, conçus pour les élèves du Bénin — consultables sur ton téléphone, où que tu sois.</p>
      </div>

      <div className="search-bar">
        <input
          placeholder="Ex : Mathématiques Terminale D"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button aria-label="Rechercher">🔎</button>
      </div>

      <div className="chip-row" style={{ marginTop: 12 }}>
        <button className={`chip ${level === '' ? 'active' : ''}`} onClick={() => setLevel('')}>Tous</button>
        {LEVELS.map((l) => (
          <button key={l} className={`chip ${level === l ? 'active' : ''}`} onClick={() => setLevel(l)}>
            {l.replace('eme', 'ème')}
          </button>
        ))}
      </div>

      {error && <p className="error-box">{error}</p>}

      {firstLoad ? (
        <Mascot label="Chargement des cahiers" />
      ) : (q || level) ? (
        <>
          <h2>Résultats</h2>
          {books === null ? <Mascot label="Recherche en cours" /> : books.length === 0 ? (
            <div className="empty-state"><span className="ic">📭</span>Aucun cahier ne correspond à ta recherche.</div>
          ) : (
            <div className="book-grid">{books.map((b) => <BookCard key={b.id} book={b} />)}</div>
          )}
        </>
      ) : (
        <>
          {free && free.length > 0 && (
            <>
              <h2>Cahiers gratuits</h2>
              <div className="book-grid">{free.map((b) => <BookCard key={b.id} book={b} />)}</div>
            </>
          )}
          {popular && popular.length > 0 && (
            <>
              <h2>Les plus consultés</h2>
              <div className="book-grid">{popular.map((b) => <BookCard key={b.id} book={b} />)}</div>
            </>
          )}
          {books && (
            <>
              <h2>Tous les cahiers</h2>
              <div className="book-grid">{books.map((b) => <BookCard key={b.id} book={b} />)}</div>
            </>
          )}
        </>
      )}
    </div>
  );
              }
