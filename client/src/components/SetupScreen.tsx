import { useEffect, useState } from 'react';
import type {
  GameState, Player, PlayerColor, StampType, GameConfig,
  ShapeMode, GameSize,
} from '../types/game';
import { COLOR_MAP, STAMP_LABELS } from '../types/game';

const COLORS: PlayerColor[] = ['purple', 'pink', 'yellow', 'blue', 'green'];
const STAMPS: StampType[]   = ['heart', 'star', 'flower', 'diamond'];
const SIZES: GameSize[]     = ['small', 'medium', 'big'];
const SIZE_LABELS: Record<GameSize, string> = {
  small: 'Small', medium: 'Medium', big: 'Big'
};
const SIZE_DESC: Record<GameSize, string> = {
  small:  'Quick game (~9 shapes)',
  medium: 'Standard (~25 shapes)',
  big:    'Epic battle (~49 shapes)',
};

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const GearIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);
const SquareModeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
  </svg>
);
const TriModeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 3L21 20H3L12 3Z" strokeLinejoin="round"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

interface Props {
  gameState: GameState;
  myPlayer: Player | undefined;
  onSetup: (color: PlayerColor, stamp: StampType, isReady: boolean) => void;
  onHostConfig: (config: GameConfig) => void;
}

export default function SetupScreen({ gameState, myPlayer, onSetup, onHostConfig }: Props) {
  const isHost = myPlayer?.isHost ?? false;
  const [color, setColor]   = useState<PlayerColor>(myPlayer?.color ?? 'purple');
  const [stamp, setStamp]   = useState<StampType>(myPlayer?.stamp ?? 'heart');
  const [ready, setReady]   = useState(false);
  const [mode, setMode]     = useState<ShapeMode>(gameState.config.shapeMode);
  const [size, setSize]     = useState<GameSize>(gameState.config.size);

  // Sync when opponent's state arrives
  useEffect(() => {
    if (myPlayer) { setColor(myPlayer.color); setStamp(myPlayer.stamp); }
  }, [myPlayer?.id]);

  // Auto-emit setup whenever local choices change
  useEffect(() => {
    onSetup(color, stamp, ready);
  }, [color, stamp, ready]);

  // Host emits config changes
  useEffect(() => {
    if (isHost) onHostConfig({ shapeMode: mode, size });
  }, [mode, size]);

  const opponent = gameState.players.find(p => p.id !== myPlayer?.id);
  const waiting  = gameState.players.length < 2;

  // Pick a color that opponent hasn't taken
  const selectColor = (c: PlayerColor) => {
    if (c === opponent?.color) return; // blocked
    setColor(c); setReady(false);
  };

  const selectStamp = (s: StampType) => {
    if (s === opponent?.stamp) return;
    setStamp(s); setReady(false);
  };

  return (
    <div className="setup-screen">
      {/* Header */}
      <div className="setup-header">
        <div className="logo-title-sm">Square<span>Up</span></div>
        <div className="room-chip">Room: <strong>{gameState.roomCode}</strong></div>
      </div>

      <div className="setup-body">
        {/* ── Shared Config (host only) ─────────────────── */}
        <div className="setup-card config-card">
          <h2>Game Settings</h2>
          {!isHost && (
            <p className="config-lock" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <GearIcon /> Waiting for host to configure…
            </p>
          )}

          <div className="config-row">
            <h3>Pattern Mode</h3>
            <div className="mode-btns">
              {(['square','triangle'] as ShapeMode[]).map(m => (
                <button
                  key={m}
                  className={`mode-btn ${mode===m?'active':''} ${!isHost?'disabled':''}`}
                  onClick={() => isHost && setMode(m)}
                >
                  <span className="mode-icon">{m==='square' ? <SquareModeIcon /> : <TriModeIcon />}</span>
                  <span className="mode-label">{m==='square' ? 'Squares' : 'Triangles'}</span>
                  <span className="mode-sub">{m==='square' ? 'Grid of dots' : 'Random dots'}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="config-row">
            <h3>Board Size</h3>
            <div className="size-btns">
              {SIZES.map(s => (
                <button
                  key={s}
                  className={`size-btn ${size===s?'active':''} ${!isHost?'disabled':''}`}
                  onClick={() => isHost && setSize(s)}
                >
                  <strong>{SIZE_LABELS[s]}</strong>
                  <span>{SIZE_DESC[s]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Players side by side ──────────────────────── */}
        <div className="players-setup">
          {gameState.players.map(p => {
            const isMe = p.id === myPlayer?.id;
            const displayColor = isMe ? color : p.color;
            const displayStamp = isMe ? stamp : p.stamp;
            return (
              <div key={p.id} className={`player-setup-card ${isMe ? 'mine' : 'theirs'}`}>
                <div className="ps-header">
                  <div
                    className="ps-avatar"
                    style={{ background: COLOR_MAP[displayColor], boxShadow: `0 0 20px ${COLOR_MAP[displayColor]}66` }}
                  >
                    {STAMP_LABELS[displayStamp]}
                  </div>
                  <div>
                    <div className="ps-name">{p.name}{isMe ? ' (You)' : ''}</div>
                    <div className={`ps-status ${p.isReady ? 'ready' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {p.isReady ? <><CheckIcon /> Ready!</> : 'Setting up…'}
                    </div>
                  </div>
                </div>

                {isMe && (
                  <>
                    <div className="ps-section">
                      <h4>Your Color</h4>
                      <div className="color-palette">
                        {COLORS.map(c => (
                          <button
                            key={c}
                            className={`color-dot ${color===c?'selected':''} ${c===opponent?.color?'blocked':''}`}
                            style={{ background: COLOR_MAP[c] }}
                            onClick={() => selectColor(c)}
                            title={c}
                            aria-label={`Color ${c}${c===opponent?.color?' (taken)':''}`}
                          >
                            {c===opponent?.color && <span className="blocked-x">✕</span>}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="ps-section">
                      <h4>Your Stamp</h4>
                      <div className="stamp-palette">
                        {STAMPS.map(s => (
                          <button
                            key={s}
                            className={`stamp-btn ${stamp===s?'selected':''} ${s===opponent?.stamp?'blocked':''}`}
                            style={stamp===s ? { borderColor: COLOR_MAP[color], color: COLOR_MAP[color] } : {}}
                            onClick={() => selectStamp(s)}
                            title={s}
                            aria-label={`Stamp ${s}${s===opponent?.stamp?' (taken)':''}`}
                          >
                            {STAMP_LABELS[s]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      className={`ready-btn ${ready?'active':''}`}
                      style={ready ? { borderColor: COLOR_MAP[color], background: `${COLOR_MAP[color]}22` } : {}}
                      onClick={() => setReady(r => !r)}
                      disabled={waiting}
                    >
                      {ready ? 'Ready!' : waiting ? 'Waiting for opponent…' : 'Mark as Ready'}
                    </button>
                  </>
                )}
              </div>
            );
          })}

          {/* Empty slot */}
          {gameState.players.length < 2 && (
            <div className="player-setup-card waiting-card">
              <div className="waiting-inner">
                <div className="waiting-spinner" />
                <p>Waiting for opponent…</p>
                <div className="share-code">
                  Share code: <strong>{gameState.roomCode}</strong>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
