import type { GameState } from '../types/game';
import { COLOR_MAP, COLOR_GLOW, STAMP_LABELS } from '../types/game';

interface Props {
  gameState: GameState;
  myPlayerId: string | null;
}

export default function PlayerPanel({ gameState, myPlayerId }: Props) {
  const { players, currentPlayerId, shapes } = gameState;

  return (
    <div className="player-panels">
      {players.map(p => {
        const isMe   = p.id === myPlayerId;
        const isTurn = p.id === currentPlayerId && gameState.status === 'playing';
        const col    = COLOR_MAP[p.color];
        const glow   = COLOR_GLOW[p.color];
        const wonShapes = shapes.filter(s => s.winnerId === p.id);

        return (
          <div
            key={p.id}
            className={`panel-card ${isTurn ? 'panel-active' : ''}`}
            style={{
              borderColor: isTurn ? col : 'rgba(255,255,255,0.08)',
              boxShadow:   isTurn ? `0 0 28px ${glow}, 0 0 0 1px ${col}33` : 'none',
            }}
          >
            {/* Turn / waiting dot — top right */}
            <div className={`panel-turn-dot ${isTurn ? 'dot-active' : 'dot-waiting'}`} title={isTurn ? 'Active turn' : 'Waiting'} />

            {/* Stamp avatar */}
            <div className="panel-avatar" style={{ background: col, boxShadow: `0 0 18px ${glow}` }}>
              {STAMP_LABELS[p.stamp]}
            </div>

            {/* Name | Score side by side */}
            <div className="panel-name-score">
              <span className="panel-name">
                {p.name}
                {isMe && <span className="you-badge">You</span>}
              </span>
              <span className="panel-divider" />
              <span className="score-num" style={{ color: col }}>{p.score}</span>
            </div>

            {/* Mini stamps for won shapes */}
            {wonShapes.length > 0 && (
              <div className="panel-stamps">
                {wonShapes.slice(0, 10).map(s => (
                  <span key={s.id} className="mini-stamp" style={{ color: col }}>
                    {STAMP_LABELS[p.stamp]}
                  </span>
                ))}
                {wonShapes.length > 10 && (
                  <span className="mini-stamp-more" style={{ color: col }}>+{wonShapes.length - 10}</span>
                )}
              </div>
            )}

            {/* Color bar */}
            <div className="panel-color-bar" style={{ background: col }} />
          </div>
        );
      })}
    </div>
  );
}
