import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Mascot from '../components/Mascot.jsx';
import Confetti from '../components/Confetti.jsx';

export default function BookDetail() {
  const { id } = useParams();
  const { token, user, refreshMe } = useAuth();
  const navigate = useNavigate();

  const [book, setBook] = useState(null);
  const [error, setError] = useState('');
  const [buying, setBuying] = useState(false);
  const [owned, setOwned] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  const [reviews, setReviews] = useState(null);
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(5);
  const [postingReview, setPostingReview] = useState(false);

  useEffect(() => {
    api.book(id, token).then(setBook).catch((e) => setError(e.message));
    api.reviews(id).then(setReviews).catch(() => setReviews([]));
  }, [id, token]);

  useEffect(() => {
    if (!token) return;
    api.library(token).then((lib) => setOwned(lib.some((b) => b.bookId === id))).catch(() => {});
  }, [id, token]);

  if (error) return <p className="error-box">{error}</p>;
  if (!book) return <Mascot label="Chargement du cahier" />;

  const balance = user?.balance || 0;
  const canAfford = balance >= book.price;

  async function buyNow() {
    if (!token) return navigate('/connexion');
    setError('');
    setBuying(true);
    try {
      await api.buy(book.id, token);
      setOwned(true);
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 4000);
      await refreshMe();
    } catch (e) {
      setError(e.message);
    } finally {
      setBuying(false);
    }
  }

  async function download() {
    try {
      const { url } = await api.downloadLink(book.id, token);
      window.location.href = url;
      if (book.isFree) { setCelebrate(true); setTimeout(() => setCelebrate(false), 4000); }
    } catch (e) {
      setError(e.message);
    }
  }

  async function submitReview(e) {
    e.preventDefault();
    if (!token) return navigate('/connexion');
    if (!comment.trim()) return;
    setPostingReview(true);
    try {
      const newReview = await api.addReview(book.id, { comment, rating }, token);
      setReviews((r) => [{ ...newReview, user_name: user.name, created_at: newReview.createdAt }, ...(r || [])]);
      setComment('');
    } catch (e) {
      setError(e.message);
    } finally {
      setPostingReview(false);
    }
  }

  return (
    <div>
      <Confetti fire={celebrate} />
      <div className="detail-cover">
        {book.coverUrl && <img src={book.coverUrl} alt="" />}
        <h1 style={{ color: 'white', position: 'relative', margin: 0 }}>{book.title}</h1>
      </div>

      <div style={{ marginTop: 14 }}>
        <span className="pill">{book.level}{book.series ? ` ${book.series}` : ''}</span>
        {book.author && <span className="pill">{book.author}</span>}
        <span className="pill">{book.totalPages ? `${book.totalPages} pages` : 'Format PDF'}</span>
      </div>

      <p style={{ marginTop: 14, color: 'var(--ink-soft)' }}>{book.description}</p>

      <hr className="divider" />

      {error && <p className="error-box">{error}</p>}

      {book.isFree ? (
        <>
          <p className="notice-box">Ce cahier est gratuit — télécharge-le directement.</p>
          {token ? (
            <button className="btn btn-primary btn-block" onClick={download}>⬇️ Télécharger gratuitement</button>
          ) : (
            <Link to="/connexion" className="btn btn-primary btn-block">Se connecter pour télécharger</Link>
          )}
        </>
      ) : owned ? (
        <>
          <p className="notice-box">Tu possèdes déjà ce cahier — bonne lecture !</p>
          <button className="btn btn-primary btn-block" onClick={download}>⬇️ Télécharger le PDF complet</button>
        </>
      ) : (
        <>
          <p className="eyebrow" style={{ marginBottom: 6 }}>Aperçu gratuit — {book.previewPages} pages</p>
          <a href={`/api/books/${book.id}/preview`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-block" style={{ marginBottom: 18 }}>
            👀 Voir l'aperçu
          </a>

          <div className="form-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <span className="price-tag">{book.price.toLocaleString('fr-FR')} FCFA</span>
              {token && <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Solde : {balance.toLocaleString('fr-FR')} F</span>}
            </div>

            {!token ? (
              <Link to="/connexion" className="btn btn-primary btn-block">Se connecter pour acheter</Link>
            ) : canAfford ? (
              <button className="btn btn-primary btn-block" onClick={buyNow} disabled={buying}>
                {buying ? 'Achat en cours…' : 'Acheter maintenant'}
              </button>
            ) : (
              <>
                <p style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 8 }}>
                  Solde insuffisant — il te manque {(book.price - balance).toLocaleString('fr-FR')} FCFA.
                </p>
                <Link to="/recharge" className="btn btn-gold btn-block">Recharger mon solde</Link>
              </>
            )}
          </div>
        </>
      )}

      <hr className="divider" />
      <h2>Avis des élèves</h2>

      {token && (
        <form className="form-card" onSubmit={submitReview} style={{ marginBottom: 14 }}>
          <div className="field">
            <label>Ta note</label>
            <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{'⭐'.repeat(n)}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Ton commentaire</label>
            <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Qu'as-tu pensé de ce cahier ?" />
          </div>
          <button className="btn btn-secondary btn-block" disabled={postingReview}>
            {postingReview ? '…' : 'Publier mon avis'}
          </button>
        </form>
      )}

      {reviews === null ? (
        <Mascot label="Chargement des avis" />
      ) : reviews.length === 0 ? (
        <div className="empty-state"><span className="ic">💬</span>Aucun avis pour l'instant — sois le premier !</div>
      ) : (
        reviews.map((r) => (
          <div key={r.id} className="library-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <strong style={{ fontSize: 14 }}>{r.user_name}</strong>
              {r.rating && <span>{'⭐'.repeat(r.rating)}</span>}
            </div>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-soft)' }}>{r.comment}</p>
          </div>
        ))
      )}
    </div>
  );
      }
