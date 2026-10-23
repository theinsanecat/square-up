import { Dot, Edge, GameShape, DrawnLine, ShapeMode, BotDifficulty } from './types';
import { lineKey, cross, segmentsCross } from './gameLogic';

// ── Computer opponent ─────────────────────────────────────────────────────────
//
// Classic dots-and-boxes heuristics, generalised to any shape:
//   1. Close a shape whenever possible.
//   2. Otherwise play a "safe" edge that leaves no shape one edge from closing.
//   3. Otherwise sacrifice the edge that hands the opponent the fewest shapes.
// Easy skips steps 2–3 and sometimes misses a closable shape.
//
// In square mode the shapes and edges are fixed. In triangle mode any empty
// triangle can still be made, and drawing a line removes every open line that
// crosses it, so both are worked out from the dots here.

export interface BotBoard {
  shapeMode: ShapeMode;
  dots: Dot[];
  validEdges: Edge[];
  shapes: GameShape[];
  drawnLines: DrawnLine[];
}

interface Candidate { id: string; edgeIds: string[]; }

interface Sim {
  drawn: Set<string>;
  open: Set<string>;
}

class Model {
  readonly candidates: Candidate[];
  readonly byEdge = new Map<string, Candidate[]>();
  private readonly edgeById: Map<string, Edge>;
  private readonly dotById: Map<string, Dot>;
  private readonly crossMemo = new Map<string, string[]>();

  constructor(private readonly board: BotBoard, readonly start: Sim) {
    this.edgeById = new Map(board.validEdges.map(e => [e.id, e]));
    this.dotById  = new Map(board.dots.map(d => [d.id, d]));
    this.candidates = board.shapeMode === 'triangle'
      ? this.emptyTriangles()
      : board.shapes.filter(s => !s.winnerId);
    for (const c of this.candidates)
      for (const e of c.edgeIds) {
        if (!this.byEdge.has(e)) this.byEdge.set(e, []);
        this.byEdge.get(e)!.push(c);
      }
  }

  /** Every triangle with no dot inside whose sides are drawn or still drawable */
  private emptyTriangles(): Candidate[] {
    const { dots } = this.board;
    const { drawn, open } = this.start;
    const usable = (a: Dot, b: Dot) => { const k = lineKey(a.id, b.id); return drawn.has(k) || open.has(k); };
    const out: Candidate[] = [];
    for (let i = 0; i < dots.length; i++)
      for (let j = i + 1; j < dots.length; j++) {
        const a = dots[i], b = dots[j];
        if (!usable(a, b)) continue;
        for (let k = j + 1; k < dots.length; k++) {
          const c = dots[k];
          if (!usable(b, c) || !usable(a, c)) continue;
          const edgeIds = [lineKey(a.id, b.id), lineKey(b.id, c.id), lineKey(a.id, c.id)];
          if (edgeIds.every(e => drawn.has(e))) continue; // already closed
          const s = Math.sign(cross(a, b, c));
          const empty = dots.every(p => p === a || p === b || p === c ||
            !(Math.sign(cross(a, b, p)) === s && Math.sign(cross(b, c, p)) === s && Math.sign(cross(c, a, p)) === s));
          if (empty) out.push({ id: edgeIds.join('/'), edgeIds });
        }
      }
    return out;
  }

  /** Open edges that become illegal once edgeId is drawn */
  private crossers(edgeId: string): string[] {
    if (this.board.shapeMode !== 'triangle') return [];
    let hit = this.crossMemo.get(edgeId);
    if (hit) return hit;
    const e = this.edgeById.get(edgeId)!;
    const a = this.dotById.get(e.dot1Id)!, b = this.dotById.get(e.dot2Id)!;
    hit = [];
    for (const id of this.start.open) {
      const o = this.edgeById.get(id)!;
      if (segmentsCross(a, b, this.dotById.get(o.dot1Id)!, this.dotById.get(o.dot2Id)!)) hit.push(id);
    }
    this.crossMemo.set(edgeId, hit);
    return hit;
  }

  play(sim: Sim, edgeId: string) {
    sim.drawn.add(edgeId);
    sim.open.delete(edgeId);
    for (const x of this.crossers(edgeId)) sim.open.delete(x);
  }

  /** Undrawn sides of c, or -1 if c can no longer be made */
  missing(c: Candidate, sim: Sim): number {
    let n = 0;
    for (const e of c.edgeIds) {
      if (sim.drawn.has(e)) continue;
      if (!sim.open.has(e)) return -1;
      n++;
    }
    return n;
  }

  closes(edgeId: string, sim: Sim): boolean {
    return (this.byEdge.get(edgeId) ?? []).some(c => this.missing(c, sim) === 1);
  }

  /** Drawing this edge leaves a shape one edge from closing */
  givesAway(edgeId: string, sim: Sim): boolean {
    return (this.byEdge.get(edgeId) ?? []).some(c => this.missing(c, sim) === 2);
  }

  /** How many shapes the opponent could grab in a row after we draw edgeId */
  sacrificeSize(edgeId: string): number {
    const sim: Sim = { drawn: new Set(this.start.drawn), open: new Set(this.start.open) };
    this.play(sim, edgeId);
    let taken = 0;
    for (;;) {
      const ready = this.candidates.find(c => this.missing(c, sim) === 1);
      if (!ready) return taken;
      const last = ready.edgeIds.find(e => !sim.drawn.has(e))!;
      const before = (this.byEdge.get(last) ?? []).filter(c => this.missing(c, sim) === 1).length;
      this.play(sim, last);
      taken += before;
    }
  }
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function chooseBotMove(board: BotBoard, difficulty: BotDifficulty): Edge | null {
  const drawn = new Set(board.drawnLines.map(l => l.id));
  const open  = board.validEdges.filter(e => !drawn.has(e.id));
  if (open.length === 0) return null;

  const model = new Model(board, { drawn, open: new Set(open.map(e => e.id)) });
  const start = model.start;

  const closing = open.filter(e => model.closes(e.id, start));

  if (difficulty === 'easy') {
    if (closing.length > 0 && Math.random() < 0.6) return pick(closing);
    return pick(open);
  }

  if (closing.length > 0) return pick(closing);

  const safe = open.filter(e => !model.givesAway(e.id, start));
  if (safe.length > 0) return pick(safe);

  if (difficulty === 'medium') return pick(open);

  // Hard: give away as little as possible
  let best: Edge[] = [];
  let bestCost = Infinity;
  for (const e of open) {
    const cost = model.sacrificeSize(e.id);
    if (cost < bestCost) { bestCost = cost; best = [e]; }
    else if (cost === bestCost) best.push(e);
  }
  return pick(best);
}
