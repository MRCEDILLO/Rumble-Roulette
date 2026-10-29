import { useEffect, useState } from 'react';
import { HostApp } from './host/HostApp';
import { useLocal } from './net/backend';
import { cleanRoomCode } from './net/roomCode';
import { PlayerApp } from './player/PlayerApp';
import { Character } from './characters/Character';
import { Logo } from './ui/Logo';

function useHash() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

export function App() {
  const hash = useHash();
  const parts = hash.replace(/^#\/?/, '').split('/');
  if (parts[0] === 'host') return <HostApp />;
  if (parts[0] === 'play') return <PlayerApp code={parts[1] ? cleanRoomCode(parts[1]) : null} />;
  return <Landing />;
}

function Landing() {
  return (
    <div className="screen center landing">
      <div className="landing-cast" aria-hidden>
        <Character color="red" accessory="party" size={90} />
        <Character color="cyan" accessory="crown" size={110} />
        <Character color="yellow" accessory="headphones" size={90} flip />
      </div>
      <Logo size="big" />
      <p className="lead">1v1 minigame duels. Everyone else bets coins on who wins.</p>
      <div className="landing-buttons">
        <a className="btn btn-primary btn-huge" href="#/play">
          📱 Join a game
        </a>
        <a className="btn btn-huge" href="#/host">
          🖥️ Host on this screen
        </a>
      </div>
      {useLocal && <p className="muted small-print">Offline demo mode (Firebase not set up yet).</p>}
    </div>
  );
}
