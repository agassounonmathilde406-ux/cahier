import React, { useEffect, useRef, useState } from 'react';

const SEEN_KEY = 'kajye_login_intro_seen';

export default function BookOpenIntro({ children }) {
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const alreadySeen = typeof window !== 'undefined' && sessionStorage.getItem(SEEN_KEY) === '1';
  const skip = reduceMotion || alreadySeen;

  const [opened, setOpened] = useState(skip);
  const [mascotPhase, setMascotPhase] = useState(null);
  const coverRef = useRef(null);

  useEffect(() => {
    if (skip) return;
    const el = coverRef.current;
    if (!el) return;
    const onEnd = () => {
      setOpened(true);
      sessionStorage.setItem(SEEN_KEY, '1');

      const t1 = setTimeout(() => setMascotPhase('in'), 150);
      const t2 = setTimeout(() => setMascotPhase('write'), 650);
      const t3 = setTimeout(() => setMascotPhase('out'), 2200);
      const t4 = setTimeout(() => setMascotPhase(null), 2700);
      el._timers = [t1, t2, t3, t4];
    };
    el.addEventListener('animationend', onEnd);
    return () => {
      el.removeEventListener('animationend', onEnd);
      (el._timers || []).forEach(clearTimeout);
    };
  }, [skip]);

  return (
    <div className="book-intro-wrap">
      {!opened && (
        <div className="book-intro-perspective">
          <div className="book-cover-panel" ref={coverRef}>
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
