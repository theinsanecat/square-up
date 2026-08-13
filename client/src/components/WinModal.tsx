import React, { useEffect, useState } from 'react';
import type { GameState } from '../types/game';
import { COLOR_MAP, COLOR_GLOW, STAMP_LABELS } from '../types/game';

interface Props {
  gameState: GameState;
  myPlayerId: string | null;
  onNewGame: () => void;
  onEndGame: () => void;
}

// ── Small Glowing Golden Crown SVG ─────────────────────────────────────────────
function GoldenCrownSvg({ size = 32 }: { size?: number }) {
  const h = Math.round(size * 0.7);
  return (
    <svg width={size} height={h} viewBox="0 0 40 28" fill="none">
      <defs>
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <filter id="goldGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d="M3 25 L3 12 L11 18 L20 4 L29 18 L37 12 L37 25 Z"
        fill="url(#goldGrad)"
        stroke="#fff7ed"
        strokeWidth="1.2"
        strokeLinejoin="round"
        filter="url(#goldGlow)"
      />
      <rect x="3" y="24" width="34" height="3" rx="1.5" fill="#fbbf24" opacity="0.95" />
      <circle cx="20" cy="4" r="2" fill="#fff" />
      <circle cx="3" cy="12" r="1.5" fill="#fff" />
      <circle cx="37" cy="12" r="1.5" fill="#fff" />
    </svg>
  );
}

// ── Gamepad Icon for New Game ──────────────────────────────────────────────────
const GamepadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="4" />
    <path d="M6 12h4M8 10v4" />
    <circle cx="15" cy="10" r="1" fill="currentColor" />
    <circle cx="18" cy="12" r="1" fill="currentColor" />
  </svg>
);

// ── Confetti particles ────────────────────────────────────────────────────────
const CONFETTI_COLORS = ['#a855f7', '#ec4899', '#eab308', '#3b82f6', '#22c55e', '#f59e0b'];

function Confetti() {
  return (
    <div className="confetti-wrap" aria-hidden="true">
      {Array.from({ length: 30 }).map((_, i) => (
        <div
          key={i}
          className="confetti-piece"
          style={{
            '--c': CONFETTI_COLORS[i % 6],
            '--x': `${(i * 17 + 5) % 95}%`,
            '--delay': `${(i * 0.13) % 2}s`,
            '--dur': `${2.5 + (i % 4) * 0.4}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function WinModal({ gameState, myPlayerId, onNewGame, onEndGame }: Props) {
  const { players, winnerId } = gameState;
  const winner  = players.find(p => p.id === winnerId);
  const isMyWin = winnerId === myPlayerId;
  const isTie   = !winnerId;
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`modal-overlay ${show ? 'visible' : ''}`}>
      {!isTie && <Confetti />}

      <div className={`win-modal ${show ? 'modal-in' : ''}`}>
        {/* Avatars with Crown on Winner */}
        <div className="modal-avatars">
          {players.map(p => {
            const isWinner = p.id === winnerId;
            const col  = COLOR_MAP[p.color];
            const glow = COLOR_GLOW[p.color];
            return (
              <div key={p.id} className={`modal-player-slot ${isWinner ? 'winner-slot' : ''}`}>
                {isWinner && (
                  <div className="avatar-crown">
                    <GoldenCrownSvg size={34} />
                  </div>
                )}
                <div
                  className="modal-avatar"
                  style={{
                    background: col,
                    boxShadow: isWinner ? `0 0 32px ${glow}, 0 0 64px ${glow}` : `0 0 12px ${glow}40`,
                    transform: isWinner ? 'scale(1.2)' : 'scale(0.85)',
                  }}
                >
                  {STAMP_LABELS[p.stamp]}
                </div>
                <div className="modal-player-name" style={{ color: isWinner ? col : 'var(--text-2)' }}>
                  {p.name}
                  {p.id === myPlayerId && <span className="you-badge">You</span>}
                </div>
                <div className="modal-player-score" style={{ color: col }}>
                  {p.score} <span>shapes</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Headline */}
        <div className="modal-headline">
          {isTie ? (
            <>
              <h1 className="modal-title tie-title">It's a Tie!</h1>
              <p className="modal-sub">Both players claimed the same number of shapes.</p>
            </>
          ) : isMyWin ? (
            <>
              <h1 className="modal-title win-title" style={{ color: COLOR_MAP[winner!.color] }}>
                You Win!
              </h1>
              <p className="modal-sub">Congratulations — you dominated the board!</p>
            </>
          ) : (
            <>
              <h1 className="modal-title">
                <span style={{ color: COLOR_MAP[winner!.color] }}>{winner?.name}</span> Wins!
              </h1>
              <p className="modal-sub">Better luck next time!</p>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onNewGame}>
            <GamepadIcon />
            New Game
          </button>
          <button className="btn btn-outline" onClick={onEndGame}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 8h10M8 3v10" strokeLinecap="round" transform="rotate(45 8 8)"/>
            </svg>
            End & Exit
          </button>
        </div>
      </div>
    </div>
  );
}
