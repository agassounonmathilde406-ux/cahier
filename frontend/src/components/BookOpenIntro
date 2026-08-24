import React, { useEffect, useRef, useState } from 'react';

const SEEN_KEY = 'kajye_login_intro_seen';

export default function BookOpenIntro({ children }) {
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const alreadySeen = typeof window !== 'undefined' && sessionStorage.getItem(SEEN_KEY) === '1';
  const skip = reduceMotion || alreadySeen;

  const [opened, setOpened] = useState(skip);
  const [showMascot, setShowMascot] = useState(skip);
  const coverRef = useRef(null);

  useEffect(() => {
    if (skip) return;
    const el = coverRef.current;
    if (!el) return;
    const onEnd = () => {
      setOpened(true);
      sessionStorage.setItem(SEEN_KEY, '1');
      setTimeout(() => setShowMascot(true), 120);
    };
    el.addEventListener('animationend', onEnd);
    return () => el.removeEventListener('animationend', onEnd);
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
      {showMascot && (
        <div className="book-intro-mascot">
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
