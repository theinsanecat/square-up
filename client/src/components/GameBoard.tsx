import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { GameState, StampType, Dot } from '../types/game';
import { COLOR_MAP, COLOR_GLOW, STAMP_LABELS } from '../types/game';

interface Props {
  gameState: GameState;
  myPlayerId: string | null;
  onDrawLine: (dot1Id: string, dot2Id: string) => void;
}

const DOT_RADIUS = 10;
const HIT_RADIUS = 22;

// ── Stamp drawing on canvas ───────────────────────────────────────────────────

function drawStamp(
  ctx: CanvasRenderingContext2D,
  stamp: StampType,
  cx: number, cy: number,
  size: number,
  color: string,
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  ctx.font = `bold ${size}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur  = 8;
  const glyph = STAMP_LABELS[stamp];
  ctx.fillText(glyph, cx, cy + 1);
  ctx.restore();
}

// ── Shape fill polygon ────────────────────────────────────────────────────────

function fillShape(
  ctx: CanvasRenderingContext2D,
  dotIds: string[],
  dotMap: Map<string, { px: number; py: number }>,
  color: string,
  alpha: number,
) {
  const pts = dotIds.map(id => dotMap.get(id)!).filter(Boolean);
  if (pts.length < 3) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle   = color;
  ctx.beginPath();
  ctx.moveTo(pts[0].px, pts[0].py);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].px, pts[i].py);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GameBoard({ gameState, myPlayerId, onDrawLine }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef   = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered]   = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 600, h: 600 });

  const isMyTurn = gameState.currentPlayerId === myPlayerId && gameState.status === 'playing';

  // ── Resize observer ───────────────────────────────────────────────────────
  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      for (const e of entries) {
        const { width, height } = e.contentRect;
        const side = Math.min(width, height, 700);
        setCanvasSize({ w: side, h: side });
      }
    });
    if (wrapRef.current) obs.observe(wrapRef.current);
    return () => obs.disconnect();
  }, []);


  // ── Build dot pixel coords ────────────────────────────────────────────────
  const { w, h } = canvasSize;
  const dotMap = new Map<string, { px: number; py: number }>();
  for (const d of gameState.dots) {
    dotMap.set(d.id, { px: d.x * w, py: d.y * h });
  }

  // ── Valid edges FROM selected dot ─────────────────────────────────────────
  const drawnIds = new Set(gameState.drawnLines.map(l => l.id));
  const validFromSelected: Set<string> = new Set();
  if (selected) {
    for (const e of gameState.validEdges) {
      if (!drawnIds.has(e.id) && (e.dot1Id === selected || e.dot2Id === selected)) {
        const otherId = e.dot1Id === selected ? e.dot2Id : e.dot1Id;
        validFromSelected.add(otherId);
      }
    }
  }

  // ── Draw ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, w, h);

    // ── Filled shapes ───────────────────────────────────────────────────────
    for (const shape of gameState.shapes) {
      if (!shape.winnerId) continue;
      const col = COLOR_MAP[shape.winnerColor!];
      fillShape(ctx, shape.dotIds, dotMap, col, 0.22);
    }

    // ── Drawn lines ─────────────────────────────────────────────────────────
    for (const line of gameState.drawnLines) {
      const a = dotMap.get(line.dot1Id), b = dotMap.get(line.dot2Id);
      if (!a || !b) continue;
      ctx.save();
      ctx.strokeStyle = COLOR_MAP[line.playerColor];
      ctx.lineWidth   = 5.5;
      ctx.lineCap     = 'round';
      ctx.shadowColor = COLOR_GLOW[line.playerColor];
      ctx.shadowBlur  = 14;
      ctx.beginPath();
      ctx.moveTo(a.px, a.py);
      ctx.lineTo(b.px, b.py);
      ctx.stroke();
      ctx.restore();
    }

    // ── Hover line preview ──────────────────────────────────────────────────
    if (selected && hovered && validFromSelected.has(hovered)) {
      const a = dotMap.get(selected), b = dotMap.get(hovered);
      if (a && b) {
        const me = gameState.players.find(p => p.id === myPlayerId);
        ctx.save();
        ctx.strokeStyle = me ? COLOR_MAP[me.color] : '#fff';
        ctx.lineWidth   = 2.5;
        ctx.lineCap     = 'round';
        ctx.setLineDash([6, 4]);
        ctx.globalAlpha = 0.65;
        ctx.beginPath();
        ctx.moveTo(a.px, a.py);
        ctx.lineTo(b.px, b.py);
        ctx.stroke();
        ctx.restore();
      }
    }

    // ── Dots ────────────────────────────────────────────────────────────────
    for (const dot of gameState.dots) {
      const pos = dotMap.get(dot.id);
      if (!pos) continue;
      const { px, py } = pos;
      const isSel  = dot.id === selected;
      const isHov  = dot.id === hovered;
      const isVFSel = validFromSelected.has(dot.id);
      const me = gameState.players.find(p => p.id === myPlayerId);
      const myColor = me ? COLOR_MAP[me.color] : '#a855f7';
      const myGlow  = me ? COLOR_GLOW[me.color] : 'rgba(168,85,247,0.4)';

      ctx.save();

      // Outer glow for selected / hoverable
      if (isSel) {
        ctx.shadowColor = myColor;
        ctx.shadowBlur  = 24;
        ctx.fillStyle   = myColor;
        ctx.beginPath();
        ctx.arc(px, py, DOT_RADIUS + 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (isVFSel && isMyTurn) {
        ctx.shadowColor = myGlow;
        ctx.shadowBlur  = 14;
        ctx.fillStyle   = myColor;
        ctx.globalAlpha = isHov ? 0.9 : 0.55;
        ctx.beginPath();
        ctx.arc(px, py, DOT_RADIUS + 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Core dot
      ctx.shadowBlur  = isSel ? 18 : (isHov ? 12 : 6);
      ctx.shadowColor = isSel ? myColor : 'rgba(200,200,255,0.3)';
      ctx.fillStyle   = isSel ? myColor : isHov && isVFSel && isMyTurn ? myColor : '#e2e8f0';
      ctx.beginPath();
      ctx.arc(px, py, DOT_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // Inner shine
      const grad = ctx.createRadialGradient(px-2, py-2, 1, px, py, DOT_RADIUS);
      grad.addColorStop(0, 'rgba(255,255,255,0.5)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, DOT_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // ── Stamps inside won shapes ────────────────────────────────────────────
    for (const shape of gameState.shapes) {
      if (!shape.winnerId || !shape.winnerStamp) continue;
      const pts = shape.dotIds.map(id => dotMap.get(id)!).filter(Boolean);
      if (!pts.length) continue;
      const cx = pts.reduce((s,p)=>s+p.px,0)/pts.length;
      const cy = pts.reduce((s,p)=>s+p.py,0)/pts.length;
      const fontSize = gameState.config.shapeMode === 'square'
        ? Math.max(14, Math.min(28, (w / (gameState.config.size === 'small' ? 3.5 : gameState.config.size === 'medium' ? 5.5 : 7.5))))
        : Math.max(12, Math.min(22, w / 18));
      drawStamp(ctx, shape.winnerStamp, cx, cy, fontSize, COLOR_MAP[shape.winnerColor!]);
    }

  }, [gameState, selected, hovered, w, h, myPlayerId, isMyTurn]);

  // ── Hit testing ───────────────────────────────────────────────────────────
  const getDotAt = useCallback((cx: number, cy: number): Dot | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = w / rect.width;
    const scaleY = h / rect.height;
    const mx = (cx - rect.left) * scaleX;
    const my = (cy - rect.top)  * scaleY;
    let closest: Dot | null = null, minD = Infinity;
    for (const dot of gameState.dots) {
      const pos = dotMap.get(dot.id);
      if (!pos) continue;
      const d = Math.hypot(pos.px - mx, pos.py - my);
      if (d < HIT_RADIUS && d < minD) { minD = d; closest = dot; }
    }
    return closest;
  }, [gameState.dots, dotMap, w, h]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const dot = getDotAt(e.clientX, e.clientY);
    setHovered(dot?.id ?? null);
  }, [getDotAt]);

  const handleMouseLeave = () => setHovered(null);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!isMyTurn) return;
    const dot = getDotAt(e.clientX, e.clientY);
    if (!dot) { setSelected(null); return; }

    if (!selected) {
      setSelected(dot.id); return;
    }
    if (dot.id === selected) {
      setSelected(null); return;
    }

    // Check if valid edge
    const [a, b] = [selected, dot.id].sort();
    const eid = `${a}|${b}`;
    const isValid = gameState.validEdges.some(e => e.id === eid);
    const isDrawn = drawnIds.has(eid);

    if (isValid && !isDrawn) {
      onDrawLine(selected, dot.id);
      setSelected(null);
    } else if (isValid) {
      setSelected(dot.id); // pivot to new dot
    } else {
      setSelected(dot.id);
    }
  }, [isMyTurn, selected, getDotAt, gameState.validEdges, drawnIds, onDrawLine]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMyTurn) return;
    const t = e.touches[0];
    handleClick({ clientX: t.clientX, clientY: t.clientY } as React.MouseEvent);
  }, [handleClick, isMyTurn]);

  const me = gameState.players.find(p => p.id === myPlayerId);

  return (
    <div className="gameboard-wrap" ref={wrapRef}>
      {/* Turn banner */}
      <div className={`turn-banner ${isMyTurn ? 'my-turn' : 'their-turn'}`}
        style={isMyTurn ? { borderColor: me ? COLOR_MAP[me.color] : '#a855f7', boxShadow: `0 0 20px ${me ? COLOR_GLOW[me.color] : 'rgba(168,85,247,0.3)'}` } : {}}>
        {isMyTurn ? (
          <span className="turn-inner">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="7" cy="7" r="5.5"/><circle cx="7" cy="7" r="2" fill="currentColor"/><line x1="7" y1="1" x2="7" y2="3"/><line x1="7" y1="11" x2="7" y2="13"/><line x1="1" y1="7" x2="3" y2="7"/><line x1="11" y1="7" x2="13" y2="7"/></svg>
            <strong>Your turn!</strong> Click a dot to start
          </span>
        ) : (
          <span className="turn-inner">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 1v3.5M7 13v-3.5M1 7h3.5M13 7h-3.5" strokeLinecap="round"/><path d="M3.5 3.5l2.1 2.1M8.4 8.4l2.1 2.1M10.5 3.5L8.4 5.6M5.6 8.4L3.5 10.5" strokeLinecap="round"/></svg>
            <strong>{gameState.players.find(p => p.id === gameState.currentPlayerId)?.name}</strong>'s turn…
          </span>
        )}
      </div>

      <canvas
        ref={canvasRef}
        width={w}
        height={h}
        className="game-canvas"
        style={{ cursor: isMyTurn ? 'pointer' : 'default', width: '100%', height: 'auto', maxWidth: w }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
      />

      {/* Selected dot hint */}
      {selected && isMyTurn && (
        <div className="selection-hint">
          Dot selected — click an adjacent dot to draw a line &nbsp;
          <button className="desel-btn" onClick={() => setSelected(null)}>Cancel</button>
        </div>
      )}
    </div>
  );
}
