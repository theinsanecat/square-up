import {
  Dot, Edge, GameShape, GameConfig, GameSize, ShapeMode, DrawnLine
} from './types';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Canonical edge key – always sorts the two dot IDs */
export function lineKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

// ── Board Generation ──────────────────────────────────────────────────────────

export function generateBoard(config: GameConfig): {
  dots: Dot[];
  validEdges: Edge[];
  shapes: GameShape[];
} {
  return config.shapeMode === 'square'
    ? generateSquareBoard(config.size)
    : generateTriangleBoard(config.size);
}

// ── Square (Dots-and-Boxes) board ─────────────────────────────────────────────

function squareGridDims(size: GameSize): { cols: number; rows: number } {
  return { small: { cols: 4, rows: 4 }, medium: { cols: 6, rows: 6 }, big: { cols: 8, rows: 8 } }[size];
}

function generateSquareBoard(size: GameSize) {
  const { cols, rows } = squareGridDims(size);
  const pad = 0.1;
  const cw  = (1 - 2 * pad) / (cols - 1);
  const ch  = (1 - 2 * pad) / (rows - 1);

  const dots: Dot[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      dots.push({ id: `d${r}_${c}`, x: pad + c * cw, y: pad + r * ch });

  const did = (r: number, c: number) => `d${r}_${c}`;
  const validEdges: Edge[] = [];
  const edgeSet = new Set<string>();
  const addEdge = (a: string, b: string) => {
    const id = lineKey(a, b);
    if (!edgeSet.has(id)) { edgeSet.add(id); validEdges.push({ id, dot1Id: a, dot2Id: b }); }
  };

  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols - 1; c++) addEdge(did(r, c), did(r, c + 1));
  for (let r = 0; r < rows - 1; r++)
    for (let c = 0; c < cols; c++) addEdge(did(r, c), did(r + 1, c));

  const shapes: GameShape[] = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const tl = did(r, c), tr = did(r, c + 1), bl = did(r + 1, c), br = did(r + 1, c + 1);
      shapes.push({
        id: `sq${r}_${c}`,
        dotIds: [tl, tr, br, bl],
        edgeIds: [lineKey(tl, tr), lineKey(tr, br), lineKey(br, bl), lineKey(bl, tl)],
      });
    }
  }

  return { dots, validEdges, shapes };
}

// ── Triangle (Random dots, free-form) board ───────────────────────────────────
//
// Any two dots can be joined as long as the line doesn't pass through another
// dot or cross a line already on the board. Any three joined dots with no dot
// inside form a triangle. Valid edges are recomputed after every move.

function triDotCount(size: GameSize): number {
  return { small: 10, medium: 18, big: 28 }[size];
}
function triMinDist(size: GameSize): number {
  return { small: 0.24, medium: 0.18, big: 0.14 }[size];
}

/** How close (normalised units) a line may pass to a third dot */
const DOT_CLEARANCE = 0.006;

type Pt = { x: number; y: number };

function cross(o: Pt, a: Pt, b: Pt): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t  = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Proper crossing of segments ab and cd (touching at a shared dot doesn't count) */
function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const d1 = cross(c, d, a), d2 = cross(c, d, b);
  const d3 = cross(a, b, c), d4 = cross(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

function generateTriangleBoard(size: GameSize) {
  const n       = triDotCount(size);
  const minDist = triMinDist(size);
  const pad     = 0.12;

  const dots: Dot[] = [];
  let attempts = 0;
  while (dots.length < n && attempts < 20000) {
    attempts++;
    const x = pad + Math.random() * (1 - 2 * pad);
    const y = pad + Math.random() * (1 - 2 * pad);
    const p = { x, y };
    if (dots.some(d => Math.hypot(d.x-x, d.y-y) < minDist)) continue;
    // Reject near-collinear triples so no line ever has to skim past a third
    // dot, which would leave a sliver that can never be closed
    if (dots.some((a, i) => dots.some((b, j) => j > i && (
      distToSegment(p, a, b) < DOT_CLEARANCE ||
      distToSegment(a, p, b) < DOT_CLEARANCE ||
      distToSegment(b, p, a) < DOT_CLEARANCE)))) continue;
    dots.push({ id:`d${dots.length}`, ...p });
  }

  return { dots, validEdges: computeTriangleEdges(dots, []), shapes: [] as GameShape[] };
}

/** Drawn lines plus every undrawn pair that is still a legal move */
export function computeTriangleEdges(dots: Dot[], drawnLines: DrawnLine[]): Edge[] {
  const byId  = new Map(dots.map(d => [d.id, d]));
  const drawn = new Set(drawnLines.map(l => l.id));
  const edges: Edge[] = drawnLines.map(l => ({ id: l.id, dot1Id: l.dot1Id, dot2Id: l.dot2Id }));

  for (let i = 0; i < dots.length; i++) {
    for (let j = i + 1; j < dots.length; j++) {
      const a = dots[i], b = dots[j];
      const id = lineKey(a.id, b.id);
      if (drawn.has(id)) continue;
      if (dots.some(p => p !== a && p !== b && distToSegment(p, a, b) < DOT_CLEARANCE)) continue;
      if (drawnLines.some(l => segmentsCross(a, b, byId.get(l.dot1Id)!, byId.get(l.dot2Id)!))) continue;
      edges.push({ id, dot1Id: a.id, dot2Id: b.id });
    }
  }
  return edges;
}

/** Triangles closed by the new line: both other sides drawn, no dot inside */
export function detectNewTriangles(dots: Dot[], drawnLines: DrawnLine[], newLine: Edge): GameShape[] {
  const byId  = new Map(dots.map(d => [d.id, d]));
  const drawn = new Set(drawnLines.map(l => l.id));
  const a = byId.get(newLine.dot1Id)!, b = byId.get(newLine.dot2Id)!;
  const found: GameShape[] = [];

  for (const c of dots) {
    if (c === a || c === b) continue;
    if (!drawn.has(lineKey(a.id, c.id)) || !drawn.has(lineKey(b.id, c.id))) continue;
    const s = Math.sign(cross(a, b, c));
    const empty = dots.every(p => p === a || p === b || p === c ||
      !(Math.sign(cross(a, b, p)) === s && Math.sign(cross(b, c, p)) === s && Math.sign(cross(c, a, p)) === s));
    if (!empty) continue;
    const ids = [a.id, b.id, c.id].sort();
    found.push({
      id: `tri_${ids.join('_')}`,
      dotIds: [a.id, b.id, c.id],
      edgeIds: [lineKey(a.id, b.id), lineKey(b.id, c.id), lineKey(a.id, c.id)],
    });
  }
  return found;
}

// ── Shape Completion Detection ────────────────────────────────────────────────

/**
 * After a new line is drawn, return all shapes that are now fully closed
 * and haven't been won yet.
 */
export function detectCompletedShapes(
  shapes: GameShape[],
  drawnLines: DrawnLine[],
  newEdgeId: string,
): GameShape[] {
  const drawn = new Set(drawnLines.map(l => l.id));
  drawn.add(newEdgeId);
  return shapes.filter(s => !s.winnerId && s.edgeIds.includes(newEdgeId) && s.edgeIds.every(e => drawn.has(e)));
}

/** True when all valid edges have been drawn */
export function isBoardComplete(validEdges: Edge[], drawnLines: DrawnLine[]): boolean {
  const drawn = new Set(drawnLines.map(l => l.id));
  return validEdges.every(e => drawn.has(e.id));
}

/** Winner = most shapes; null if tied */
export function determineWinner(players: { id: string }[], shapes: GameShape[]): string | null {
  const scores: Record<string, number> = {};
  for (const p of players) scores[p.id] = 0;
  for (const s of shapes) if (s.winnerId) scores[s.winnerId] = (scores[s.winnerId] ?? 0) + 1;
  const sorted = Object.entries(scores).sort((a,b) => b[1]-a[1]);
  if (sorted.length > 1 && sorted[0][1] === sorted[1][1]) return null;
  return sorted[0]?.[0] ?? null;
}
