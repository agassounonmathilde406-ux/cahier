import React, { useEffect, useRef, useState } from 'react';

const TIPS = [
  "Astuce : l'aperçu gratuit te montre déjà plusieurs pages avant d'acheter !",
  'Pense à recharger ton solde avant de choisir ton cahier 😉',
  'Un souci ? Laisse un avis sur le cahier, ça aide les autres élèves.',
  'Courage pour tes révisions ! 📚',
  'Les cahiers gratuits sont signalés en doré, repère-les vite.',
  "N'oublie pas de vérifier ta bibliothèque après un achat !",
];

export default function FloatingMascot() {
  const [bigJump, setBigJump] = useState(false);
  const [bubble, setBubble] = useState(null);
  const bubbleTimeout = useRef(null);

  useEffect(() => {
    let timer;
    function scheduleJump() {
      const delay = 6000 + Math.random() * 9000;
      timer = setTimeout(() => {
        setBigJump(true);
        setTimeout(() => setBigJump(false), 700);
        scheduleJump();
      }, delay);
    }
    scheduleJump();
    return () => clearTimeout(timer);
  }, []);

  function handleTap() {
    setBigJump(true);
    setTimeout(() => setBigJump(false), 700);
    const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
    setBubble(tip);
    clearTimeout(bubbleTimeout.current);
    bubbleTimeout.current = setTimeout(() => setBubble(null), 3600);
  }

  return (
    <div className="floating-mascot-wrap">
      {bubble && <div className="floating-mascot-bubble">{bubble}</div>}
      <button
        type="button"
        className={`floating-mascot ${bigJump ? 'floating-mascot-jump' : ''}`}
        onClick={handleTap}
        aria-label="Compagnon Kajye"
      >
        <div className="mascot-body">
          <div className="mascot-eyes"><span /><span /></div>
        </div>
        <div className="mascot-legs"><span /><span /></div>
        <div className="mascot-pencil" />
      </button>
    </div>
  );
}
