import React, { useEffect, useState } from 'react';

const SEEN_KEY = 'kajye_login_intro_seen';

export default function BookOpenIntro({ children }) {
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const alreadySeen = typeof window !== 'undefined' && sessionStorage.getItem(SEEN_KEY) === '1';
  const skip = reduceMotion || alreadySeen;

  const [opened, setOpened] = useState(skip);
  const [mascotPhase, setMascotPhase] = useState(null);

  useEffect(() => {
    if (skip) return;
    sessionStorage.setItem(SEEN_KEY, '1');

    const timers = [
      setTimeout(() => setOpened(true), 1300),
      setTimeout(() => setMascotPhase('in'), 1450),
      setTimeout(() => setMascotPhase('write'), 1950),
      setTimeout(() => setMascotPhase('out'), 3500),
      setTimeout(() => setMascotPhase(null), 4000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [skip]);

  return (
    <div className="book-intro-wrap">
      {!opened && (
        <div className="book-intro-perspective">
          <div className="book-cover-panel">
            <span className="book-cover-title">Kajye<span className="dot">.</span></span>
            <span className="book-cover-tagline">Cahiers de cours — Bénin</span>
          </div>
        </div>
      )}
      {mascotPhase && (
        <div className={`login-mascot login-mascot-${mascotPhase}`}>
          <div className="mascot-body"><div className="mascot-eyes"><span /><span /></div></div>
          <div className="mascot-legs"><span /><span /></div>
          <div className="mascot-pencil" />
        </div>
      )}
      <div className={`book-intro-content ${opened ? 'book-intro-content-visible' : ''}`}>
        {children}
      </div>
    </div>
  );
}
