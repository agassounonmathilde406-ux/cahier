import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Mascot from '../components/Mascot.jsx';
import Confetti from '../components/Confetti.jsx';

const PRESETS = [500, 1000, 2000, 5000, 10000];

export default function Recharge() {
  const { token, user, refreshMe } = useAuth();
  const navigate = useNavigate();
  const [methods, setMethods] = useState(null);
  const [amount, setAmount] = useState(1000);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState(null);
  const [checking, setChecking] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    api.walletPaymentMethods().then(setMethods).catch(() => {});
  }, []);

  const isManual = !!(methods && methods.length === 1 && methods[0].kind === 'manual');

  async function startRecharge() {
    setError('');
    if (!isManual && !phone) {
      setError('Indique le numéro Mobile Money qui recevra la demande de paiement.');
      return;
    }
    setSending(true);
    try {
      const res = await api.recharge({ amount: Number(amount), phone }, token);
      setPending(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  async function confirm() {
    setChecking(true);
    try {
      const res = await api.confirmRecharge(pending.rechargeId, token);
      if (res.status === 'success') {
        setPending(null);
        setCelebrate(true);
        setTimeout(() => setCelebrate(false), 4000);
        await refreshMe();
      } else if (res.status === 'failed') {
        setError('Le paiement a échoué. Réessaie.');
        setPending(null);
      } else {
        setError("Pas encore reçu. Si tu as payé, réessaie dans quelques instants, ou attends la validation de l'équipe.");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div>
      <Confetti fire={celebrate} />
      <h1>Recharger mon solde</h1>
      <p className="notice-box">Solde actuel : <strong>{(user?.balance || 0).toLocaleString('fr-FR')} FCFA</strong></p>

      {error && <p className="error-box">{error}</p>}

      {!pending ? (
        <div className="form-card">
          <div className="field">
            <label>Montant à recharger (FCFA)</label>
            <input type="number" min={100} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="chip-row" style={{ marginBottom: 14 }}>
            {PRESETS.map((p) => (
              <button key={p} type="button" className={`chip ${Number(amount) === p ? 'active' : ''}`} onClick={() => setAmount(p)}>
                {p.toLocaleString('fr-FR')} F
              </button>
            ))}
          </div>

          {!isManual && (
            <div className="field">
              <label>Numéro Mobile Money</label>
              <input placeholder="+229 00 00 00 00" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          )}

          <button className="btn btn-primary btn-block" onClick={startRecharge} disabled={sending || !amount || amount < 100}>
            {sending ? 'Envoi en cours…' : `Recharger ${Number(amount || 0).toLocaleString('fr-FR')} FCFA`}
          </button>
        </div>
      ) : (
        <div className="form-card">
          <h3>Finalise ta recharge</h3>
          <p style={{ fontSize: 14, color: 'var(--ink-soft)' }}>{pending.message}</p>

          {pending.whatsappPhone && (
            <a
              className="btn btn-gold btn-block"
              style={{ marginBottom: 10 }}
              href={`https://wa.me/${pending.whatsappPhone}?text=${encodeURIComponent(pending.whatsappText || '')}`}
              target="_blank"
              rel="noreferrer"
            >
              💬 Ouvrir WhatsApp — {pending.whatsappPhone.replace('229', '+229 ')}
            </a>
          )}

          <button className="btn btn-primary btn-block" onClick={confirm} disabled={checking}>
            {checking ? 'Vérification…' : "J'ai envoyé le paiement"}
          </button>
          {checking && <Mascot label="Vérification du paiement" />}
        </div>
      )}

      <button className="btn-link" style={{ marginTop: 16 }} onClick={() => navigate(-1)}>← Retour</button>
    </div>
  );
    }
