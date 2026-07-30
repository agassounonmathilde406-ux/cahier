
import React, { useEffect, useState } from 'react';

const COLORS = ['#1E7A4C', '#E3A83B', '#B23A2E', '#232A3B', '#5B6478'];

// Petite pluie de confettis CSS (sans canvas, sans librairie) declenchee
// quand la prop "fire" passe a true (ex: achat confirme, telechargement gratuit).
export default function Confetti({ fire, count = 70 }) {
  const [pieces, setPieces] = useState([]);

  useEffect(() => {
    if (!fire) return;
    const newPieces = Array.from({ length: count }, (_, i) => ({
      id: `${Date.now()}-${i}`,
      left: Math.random() * 100,
      delay: Math.random() * 0.4,
      duration: 2.2 + Math.random() * 1.2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotate: Math.random() * 360,
    }));
    setPieces(newPieces);
    const timer = setTimeout(() => setPieces([]), 3800);
    return () => clearTimeout(timer);
  }, [fire, count]);

  if (pieces.length === 0) return null;

  return (
    <>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </>
  );
}
