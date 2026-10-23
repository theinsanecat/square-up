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

// ── Triangle (Random + Delaunay) board ────────────────────────────────────────

function triDotCount(size: GameSize): number {
  return { small: 10, medium: 18, big: 28 }[size];
}
function triMinDist(size: GameSize): number {
  return { small: 0.24, medium: 0.18, big: 0.14 }[size];
}

/** Simple Bowyer-Watson Delaunay triangulation */
interface BWPt { id: string; x: number; y: number; }
interface BWTri { a: BWPt; b: BWPt; c: BWPt; }

function circumcircle(t: BWTri): { cx: number; cy: number; r2: number } {
  const ax = t.b.x - t.a.x, ay = t.b.y - t.a.y;
  const bx = t.c.x - t.a.x, by = t.c.y - t.a.y;
  const D  = 2 * (ax * by - ay * bx);
  if (Math.abs(D) < 1e-12) return { cx: Infinity, cy: Infinity, r2: Infinity };
  const ux = (by * (ax * ax + ay * ay) - ay * (bx * bx + by * by)) / D;
  const uy = (ax * (bx * bx + by * by) - bx * (ax * ax + ay * ay)) / D;
  return { cx: t.a.x + ux, cy: t.a.y + uy, r2: ux * ux + uy * uy };
}

function sharedEdge(t: BWTri, ea: BWPt, eb: BWPt): boolean {
  const edges: [BWPt, BWPt][] = [[t.a,t.b],[t.b,t.c],[t.c,t.a]];
  return edges.some(([p,q]) => (p===ea&&q===eb)||(p===eb&&q===ea));
}

function bowyerWatson(pts: BWPt[]): BWTri[] {
  const S = 50;
  const sa: BWPt = { id:'__sa', x:-S, y:-S };
  const sb: BWPt = { id:'__sb', x: S, y:-S };
  const sc: BWPt = { id:'__sc', x: 0, y: S };
  let tris: BWTri[] = [{ a:sa, b:sb, c:sc }];
  const superIds = new Set(['__sa','__sb','__sc']);

  for (const p of pts) {
    const bad = tris.filter(t => {
      const { cx, cy, r2 } = circumcircle(t);
      return (p.x-cx)**2 + (p.y-cy)**2 < r2 - 1e-10;
    });
    const boundary: [BWPt,BWPt][] = [];
    for (const t of bad) {
      for (const [ea,eb] of [[t.a,t.b],[t.b,t.c],[t.c,t.a]] as [BWPt,BWPt][]) {
        if (!bad.some(o => o!==t && sharedEdge(o,ea,eb))) boundary.push([ea,eb]);
      }
    }
    tris = tris.filter(t => !bad.includes(t));
    for (const [ea,eb] of boundary) tris.push({ a:ea, b:eb, c:p });
  }

  return tris.filter(t => ![t.a,t.b,t.c].some(v => superIds.has(v.id)));
}

function cross(o: BWPt, a: BWPt, b: BWPt): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/**
 * Bowyer-Watson with a finite super-triangle can drop triangles along the
 * convex hull, leaving notches where two edges meet but the closing third
 * edge is missing. Fill those notches with ear triangles until the outer
 * boundary is convex.
 */
function fillHullGaps(pts: BWPt[], tris: BWTri[]): BWTri[] {
  // Orient every triangle counter-clockwise (positive cross)
  const out = tris.map(t => cross(t.a, t.b, t.c) < 0 ? { a: t.a, b: t.c, c: t.b } : t);

  for (let guard = 0; guard < pts.length * 4; guard++) {
    // Directed boundary edges: present in one triangle, reverse absent
    const directed = new Set<string>();
    for (const t of out)
      for (const [p, q] of [[t.a,t.b],[t.b,t.c],[t.c,t.a]]) directed.add(`${p.id}>${q.id}`);
    const next = new Map<string, BWPt>();
    const byId = new Map(pts.map(p => [p.id, p]));
    for (const t of out)
      for (const [p, q] of [[t.a,t.b],[t.b,t.c],[t.c,t.a]])
        if (!directed.has(`${q.id}>${p.id}`)) next.set(p.id, q);

    let added = false;
    for (const [aId, b] of next) {
      const a = byId.get(aId)!;
      const c = next.get(b.id);
      if (!c || c === a) continue;
      // Reflex boundary vertex (right turn on a CCW boundary) → notch
      if (cross(a, b, c) >= -1e-12) continue;
      const empty = pts.every(p => p === a || p === b || p === c ||
        !(cross(a, c, p) > 0 && cross(c, b, p) > 0 && cross(b, a, p) > 0));
      if (!empty) continue;
      out.push({ a, b: c, c: b });
      added = true;
      break;
    }
    if (!added) break;
  }
  return out;
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
    if (dots.every(d => Math.hypot(d.x-x, d.y-y) >= minDist))
      dots.push({ id:`d${dots.length}`, x, y });
  }

  const pts       = dots.map(d => ({ id: d.id, x: d.x, y: d.y }));
  const triangles = fillHullGaps(pts, bowyerWatson(pts));

  const edgeSet = new Set<string>();
  const validEdges: Edge[] = [];
  const shapes: GameShape[] = [];

  for (let i = 0; i < triangles.length; i++) {
    const { a, b, c } = triangles[i];
    const e = [lineKey(a.id,b.id), lineKey(b.id,c.id), lineKey(a.id,c.id)];
    for (const [idx,pair] of [[0,[a,b]],[1,[b,c]],[2,[a,c]]] as [number,[BWPt,BWPt]][]) {
      if (!edgeSet.has(e[idx])) {
        edgeSet.add(e[idx]);
        validEdges.push({ id:e[idx], dot1Id:pair[0].id, dot2Id:pair[1].id });
      }
    }
    shapes.push({ id:`tri${i}`, dotIds:[a.id,b.id,c.id], edgeIds:e });
  }

  return { dots, validEdges, shapes };
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
