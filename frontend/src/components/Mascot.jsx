import React from 'react';

// Petit personnage-cahier anime : cligne des yeux, marche, agite son crayon.
// Utilise a la place des ecrans de chargement/attente un peu ternes.
export default function Mascot({ label = 'Chargement' }) {
  return (
    <div className="mascot-wrap">
      <div className="mascot">
        <div className="mascot-body">
          <div className="mascot-eyes"><span /><span /></div>
        </div>
        <div className="mascot-legs"><span /><span /></div>
        <div className="mascot-pencil" />
      </div>
      {label && (
        <div className="mascot-label">
          {label}
          <span className="mascot-dots"><span>.</span><span>.</span><span>.</span></span>
        </div>
      )}
    </div>
  );
}
