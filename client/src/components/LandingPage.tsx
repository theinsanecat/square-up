import { useEffect, useState } from 'react';
import type { BotDifficulty } from '../types/game';

const DIFFICULTIES: BotDifficulty[] = ['easy', 'medium', 'hard'];
const DIFFICULTY_LABELS: Record<BotDifficulty, string> = {
  easy: 'Easy', medium: 'Medium', hard: 'Hard',
};
const DIFFICULTY_DESC: Record<BotDifficulty, string> = {
  easy:   'Makes mistakes',
  medium: 'Plays it safe',
  hard:   'Thinks ahead',
};

interface Props {
  onCreateRoom: (name: string) => void;
  onCreateSoloRoom: (name: string, difficulty: BotDifficulty) => void;
  onJoinRoom: (code: string, name: string) => void;
  error: string | null;
  connected: boolean;
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────

const HeartSvg = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151 1.018 5.719 4.955 1.59-3.938 4.464-4.955 5.726-4.955 2.54 0 5.274 1.621 5.274 5.191 0 4.106-5.395 8.85-11 14.402z"/>
  </svg>
);
const StarSvg = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
);
const DiamondSvg = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L22 12 12 22 2 12z"/>
  </svg>
);
const FlowerSvg = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="5" r="3"/><circle cx="12" cy="19" r="3"/>
    <circle cx="5" cy="12" r="3"/><circle cx="19" cy="12" r="3"/>
    <circle cx="7.2" cy="7.2" r="2.5"/><circle cx="16.8" cy="7.2" r="2.5"/>
    <circle cx="7.2" cy="16.8" r="2.5"/><circle cx="16.8" cy="16.8" r="2.5"/>
    <circle cx="12" cy="12" r="3.5"/>
  </svg>
);
const SquareSvg = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
  </svg>
);
const TriangleSvg = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 3L21 20H3L12 3Z" strokeLinejoin="round"/>
  </svg>
);

// ── Floating background shapes ────────────────────────────────────────────────

const BG_SHAPES = [
  { C: HeartSvg,    s: 28, x: 6,  y: 12, col: '#a855f7', op: 0.24, delay: 0,   dur: 7,  rot: 15  },
  { C: StarSvg,     s: 22, x: 88, y: 8,  col: '#3b82f6', op: 0.22, delay: 1.2, dur: 9,  rot: -20 },
  { C: DiamondSvg,  s: 18, x: 15, y: 80, col: '#ec4899', op: 0.25, delay: 2.5, dur: 6,  rot: 30  },
  { C: SquareSvg,   s: 32, x: 78, y: 70, col: '#22c55e', op: 0.20, delay: 0.5, dur: 8,  rot: 12  },
  { C: TriangleSvg, s: 24, x: 50, y: 5,  col: '#eab308', op: 0.22, delay: 1.8, dur: 10, rot: -8  },
  { C: FlowerSvg,   s: 20, x: 92, y: 45, col: '#a855f7', op: 0.20, delay: 3.1, dur: 7,  rot: 45  },
  { C: HeartSvg,    s: 14, x: 30, y: 92, col: '#ec4899', op: 0.26, delay: 0.8, dur: 9,  rot: -25 },
  { C: StarSvg,     s: 30, x: 70, y: 88, col: '#a855f7', op: 0.22, delay: 2.0, dur: 8,  rot: 10  },
  { C: DiamondSvg,  s: 22, x: 4,  y: 55, col: '#3b82f6', op: 0.22, delay: 4.0, dur: 6,  rot: -15 },
  { C: SquareSvg,   s: 18, x: 40, y: 78, col: '#ec4899', op: 0.20, delay: 1.5, dur: 11, rot: 20  },
  { C: TriangleSvg, s: 26, x: 60, y: 92, col: '#22c55e', op: 0.20, delay: 3.5, dur: 7,  rot: 5   },
  { C: FlowerSvg,   s: 16, x: 22, y: 30, col: '#eab308', op: 0.24, delay: 0.3, dur: 9,  rot: 35  },
  { C: HeartSvg,    s: 20, x: 85, y: 28, col: '#22c55e', op: 0.22, delay: 2.8, dur: 8,  rot: -40 },
  { C: StarSvg,     s: 16, x: 55, y: 60, col: '#ec4899', op: 0.18, delay: 1.0, dur: 12, rot: 55  },
  { C: DiamondSvg,  s: 14, x: 10, y: 38, col: '#eab308', op: 0.22, delay: 3.8, dur: 7,  rot: 0   },
  { C: SquareSvg,   s: 24, x: 96, y: 85, col: '#3b82f6', op: 0.20, delay: 2.2, dur: 10, rot: -30 },
  { C: TriangleSvg, s: 18, x: 35, y: 48, col: '#a855f7', op: 0.18, delay: 4.5, dur: 8,  rot: 25  },
  { C: FlowerSvg,   s: 28, x: 72, y: 20, col: '#ec4899', op: 0.22, delay: 1.6, dur: 9,  rot: -10 },
];

function FloatingBg() {
  return (
    <div className="floating-bg" aria-hidden="true">
      {BG_SHAPES.map((item, i) => {
        const { C, s, x, y, col, op, delay, dur, rot } = item;
        return (
          <div
            key={i}
            className="float-shape"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              color: col,
              opacity: op,
              transform: `rotate(${rot}deg)`,
              animationDelay: `${delay}s`,
              animationDuration: `${dur}s`,
            }}
          >
            <C size={s} />
          </div>
        );
      })}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LandingPage({ onCreateRoom, onCreateSoloRoom, onJoinRoom, error, connected }: Props) {
  const [view, setView]       = useState<'home' | 'create' | 'join' | 'solo'>('home');
  const [difficulty, setDifficulty] = useState<BotDifficulty>('medium');
  const [name, setName]       = useState('');
  const [code, setCode]       = useState('');
  const [loading, setLoading] = useState(false);

  // Re-enable the buttons if the server reports a problem
  useEffect(() => {
    if (error) setLoading(false);
  }, [error]);

  const handleCreate = () => {
    if (!name.trim()) return;
    setLoading(true);
    onCreateRoom(name.trim());
  };

  const handleSolo = () => {
    if (!name.trim()) return;
    setLoading(true);
    onCreateSoloRoom(name.trim(), difficulty);
  };

  const handleJoin = () => {
    if (!name.trim() || code.length < 6) return;
    setLoading(true);
    onJoinRoom(code, name.trim());
  };

  return (
    <div className="landing">
      <FloatingBg />

      <div className="landing-content">
        {/* Logo */}
        <div className="logo-wrap">
          <div className="logo-icon" aria-hidden="true">
            <svg viewBox="0 0 80 80" fill="none">
              <circle cx="15" cy="15" r="7" fill="#a855f7" />
              <circle cx="65" cy="15" r="7" fill="#ec4899" />
              <circle cx="15" cy="65" r="7" fill="#3b82f6" />
              <circle cx="65" cy="65" r="7" fill="#22c55e" />
              <circle cx="40" cy="40" r="7" fill="#eab308" />
              <line x1="15" y1="15" x2="65" y2="15" stroke="#a855f7" strokeWidth="2.5" strokeDasharray="4 3"/>
              <line x1="65" y1="15" x2="65" y2="65" stroke="#ec4899" strokeWidth="2.5" strokeDasharray="4 3"/>
              <line x1="65" y1="65" x2="15" y2="65" stroke="#22c55e" strokeWidth="2.5" strokeDasharray="4 3"/>
              <line x1="15" y1="65" x2="15" y2="15" stroke="#3b82f6" strokeWidth="2.5" strokeDasharray="4 3"/>
            </svg>
          </div>
          <h1 className="logo-title">Square<span>Up</span></h1>
          <p className="logo-sub">Real-time dot connection battle — with a friend or the computer</p>
        </div>

        {/* Connection badge */}
        <div className={`conn-badge ${connected ? 'conn-ok' : 'conn-no'}`}>
          <span className="conn-dot" />
          {connected ? 'Server Connected' : 'Connecting…'}
        </div>

        {/* Main card */}
        <div className="landing-card">
          {view === 'home' && (
            <>
              <h2>Ready to play?</h2>
              <p className="card-sub">Create a room and share the code, join a friend's game, or play solo against the computer.</p>
              <div className="btn-group">
                <button className="btn btn-primary" onClick={() => setView('create')}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="1" width="14" height="14" rx="2"/><line x1="8" y1="4" x2="8" y2="12"/><line x1="4" y1="8" x2="12" y2="8"/></svg>
                  Create Room
                </button>
                <button className="btn btn-outline" onClick={() => setView('join')}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="8" r="6.5"/><line x1="8" y1="4" x2="8" y2="12"/><line x1="4" y1="8" x2="12" y2="8"/></svg>
                  Join Room
                </button>
              </div>
              <button className="btn btn-outline full solo-btn" onClick={() => setView('solo')}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="12" height="9" rx="2"/><line x1="8" y1="1.5" x2="8" y2="4"/><circle cx="5.5" cy="8.5" r="1" fill="currentColor"/><circle cx="10.5" cy="8.5" r="1" fill="currentColor"/></svg>
                Play vs Computer
              </button>

              <div className="how-to">
                <h3>How to play</h3>
                <ul className="how-to-list">
                  <li>
                    <span className="bullet-icon"><svg width="10" height="10" viewBox="0 0 10 10" fill="#a855f7"><circle cx="5" cy="5" r="4.5"/></svg></span>
                    Take turns connecting two dot nodes with a line
                  </li>
                  <li>
                    <span className="bullet-icon"><svg width="10" height="10" viewBox="0 0 10 10" fill="#a855f7"><circle cx="5" cy="5" r="4.5"/></svg></span>
                    Complete a shape — square or triangle — to claim it with your stamp
                  </li>
                  <li>
                    <span className="bullet-icon"><svg width="10" height="10" viewBox="0 0 10 10" fill="#a855f7"><circle cx="5" cy="5" r="4.5"/></svg></span>
                    The player who draws the last edge of a shape wins it
                  </li>
                  <li>
                    <span className="bullet-icon"><svg width="10" height="10" viewBox="0 0 10 10" fill="#a855f7"><circle cx="5" cy="5" r="4.5"/></svg></span>
                    Most shapes at the end wins the game
                  </li>
                </ul>
              </div>
            </>
          )}

          {view === 'create' && (
            <>
              <button className="back-btn" onClick={() => { setView('home'); setLoading(false); }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 2L4 7l5 5"/></svg>
                Back
              </button>
              <h2>Create a Room</h2>
              <p className="card-sub">Enter your name — share the room code with a friend.</p>
              <div className="form-group">
                <label htmlFor="create-name">Your Name</label>
                <input id="create-name" className="input" placeholder="e.g. Alex" value={name}
                  maxLength={20} onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()} autoFocus />
              </div>
              {error && <p className="error-msg">{error}</p>}
              <button className="btn btn-primary full" onClick={handleCreate}
                disabled={!name.trim() || loading || !connected}>
                {loading ? 'Creating…' : 'Create Room'}
              </button>
            </>
          )}

          {view === 'solo' && (
            <>
              <button className="back-btn" onClick={() => { setView('home'); setLoading(false); }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 2L4 7l5 5"/></svg>
                Back
              </button>
              <h2>Play vs Computer</h2>
              <p className="card-sub">Practice on your own against a computer opponent.</p>
              <div className="form-group">
                <label htmlFor="solo-name">Your Name</label>
                <input id="solo-name" className="input" placeholder="e.g. Alex" value={name}
                  maxLength={20} onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSolo()} autoFocus />
              </div>
              <div className="form-group">
                <label>Difficulty</label>
                <div className="size-btns">
                  {DIFFICULTIES.map(d => (
                    <button
                      key={d}
                      className={`size-btn ${difficulty===d?'active':''}`}
                      onClick={() => setDifficulty(d)}
                    >
                      <strong>{DIFFICULTY_LABELS[d]}</strong>
                      <span>{DIFFICULTY_DESC[d]}</span>
                    </button>
                  ))}
                </div>
              </div>
              {error && <p className="error-msg">{error}</p>}
              <button className="btn btn-primary full" onClick={handleSolo}
                disabled={!name.trim() || loading || !connected}>
                {loading ? 'Starting…' : 'Start Solo Game'}
              </button>
            </>
          )}

          {view === 'join' && (
            <>
              <button className="back-btn" onClick={() => { setView('home'); setLoading(false); }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 2L4 7l5 5"/></svg>
                Back
              </button>
              <h2>Join a Room</h2>
              <p className="card-sub">Enter the 6-letter code your friend shared.</p>
              <div className="form-group">
                <label htmlFor="join-name">Your Name</label>
                <input id="join-name" className="input" placeholder="e.g. Jordan" value={name}
                  maxLength={20} onChange={e => setName(e.target.value)} autoFocus />
              </div>
              <div className="form-group">
                <label htmlFor="join-code">Room Code</label>
                <input id="join-code" className="input input-code" placeholder="ABC123" value={code}
                  maxLength={6} onChange={e => setCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handleJoin()} />
              </div>
              {error && <p className="error-msg">{error}</p>}
              <button className="btn btn-primary full" onClick={handleJoin}
                disabled={!name.trim() || code.length < 6 || loading || !connected}>
                {loading ? 'Joining…' : 'Join Room'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
