import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, API_ORIGIN } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Mascot from '../components/Mascot.jsx';
import Confetti from '../components/Confetti.jsx';

export default function BookDetail() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [book, setBook] = useState(null);
  const [error, setError] = useState('');
  const [buying, setBuying] = useState(false);
  const [phone, setPhone] = useState('');
  const [pending, setPending] = useState(null); // { purchaseId, message }
  const [checking, setChecking] = useState(false);
  const [owned, setOwned] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    api.book(id, token).then(setBook).catch((e) => setError(e.message));
  }, [id, token]);

  useEffect(() => {
    if (!token) return;
    api.library(token).then((lib) => setOwned(lib.some((b) => b.bookId === id))).catch(() => {});
  }, [id, token]);

  if (error) return <p className="error-box">{error}</p>;
  if (!book) return <Mascot label="Chargement du cahier" />;

  function fireConfetti() {
    setCelebrate(true);
    setTimeout(() => setCelebrate(false), 4000);
  }

  async function startPurchase() {
    if (!token) return navigate('/connexion');
    if (!phone) return setError('Indique le numéro Moov Money qui recevra la demande de paiement.');
    setError('');
    setBuying(true);
    try {
      const res = await api.buy({ bookId: book.id, paymentMethod: 'moov_money', phone }, token);
      setPending(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setBuying(false);
    }
  }

  async function confirmPurchase() {
    setChecking(true);
    try {
      const res = await api.confirmPurchase(pending.purchaseId, token);
      if (res.status === 'success') {
        setOwned(true);
        setPending(null);
        fireConfetti();
      } else if (res.status === 'failed') {
        setError('Le paiement a échoué. Réessaie.');
        setPending(null);
      } else {
        setError('Paiement encore en attente. Confirme la demande reçue sur ton téléphone puis réessaie.');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setChecking(false);
    }
  }

  async function download() {
    try {
      const { url } = await api.downloadLink(book.id, token);
      window.location.href = url;
      fireConfetti();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <Confetti fire={celebrate} />
      <div className="detail-cover">
        {book.coverUrl && <img src={`${API_ORIGIN}${book.coverUrl}`} alt="" />}
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

          {!pending ? (
            <div className="form-card">
              <h3 style={{ marginBottom: 10 }}>Acheter ce cahier</h3>
              <div className="field">
                <label>Numéro Moov Money</label>
                <input placeholder="+229 00 00 00 00" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <button className="btn btn-primary btn-block" onClick={startPurchase} disabled={buying}>
                {buying ? 'Envoi en cours…' : `Acheter — ${book.price.toLocaleString('fr-FR')} FCFA`}
              </button>
            </div>
          ) : (
            <div className="form-card">
              <h3>Confirme le paiement</h3>
              <p style={{ fontSize: 14, color: 'var(--ink-soft)' }}>{pending.message}</p>
              <button className="btn btn-gold btn-block" onClick={confirmPurchase} disabled={checking}>
                {checking ? 'Vérification…' : "J'ai confirmé le paiement sur mon téléphone"}
              </button>
              {checking && <Mascot label="Vérification du paiement" />}
            </div>
          )}
        </>
      )}
    </div>
  );
}
