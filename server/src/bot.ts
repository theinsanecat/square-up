import { Dot, Edge, GameShape, DrawnLine, ShapeMode, BotDifficulty } from './types';
import { lineKey, cross, segmentsCross, isLegalTriangleLine } from './gameLogic';

// ── Computer opponent ─────────────────────────────────────────────────────────
//
// Classic dots-and-boxes heuristics, generalised to any shape:
//   1. Close a shape whenever possible.
//   2. Otherwise play a "safe" edge that leaves no shape one edge from closing.
//   3. Otherwise sacrifice the edge that hands the opponent the fewest shapes.
// Easy skips steps 2–3 and sometimes misses a closable shape.
//
// In square mode the shapes and edges are fixed. In triangle mode any empty
// triangle can be made, and which lines are legal changes after every move, so
// lookahead tracks legal lines move by move with the server's own rules.

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
  lines: DrawnLine[];
}

class Model {
  readonly candidates: Candidate[];
  readonly byEdge = new Map<string, Candidate[]>();
  private readonly dotById: Map<string, Dot>;

  constructor(private readonly board: BotBoard, readonly start: Sim) {
    this.dotById = new Map(board.dots.map(d => [d.id, d]));
    this.candidates = board.shapeMode === 'triangle'
      ? this.emptyTriangles()
      : board.shapes.filter(s => !s.winnerId);
    for (const c of this.candidates)
      for (const e of c.edgeIds) {
        if (!this.byEdge.has(e)) this.byEdge.set(e, []);
        this.byEdge.get(e)!.push(c);
      }
  }

  /** Every unclosed triangle with no dot inside. Long sides may only become
   *  legal later, so sides aren't filtered here; closable() checks legality. */
  private emptyTriangles(): Candidate[] {
    const { dots } = this.board;
    const { drawn } = this.start;
    const out: Candidate[] = [];
    for (let i = 0; i < dots.length; i++)
      for (let j = i + 1; j < dots.length; j++) {
        const a = dots[i], b = dots[j];
        for (let k = j + 1; k < dots.length; k++) {
          const c = dots[k];
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

  play(sim: Sim, edgeId: string) {
    sim.drawn.add(edgeId);
    sim.open.delete(edgeId);
    if (this.board.shapeMode !== 'triangle') return;

    const [d1, d2] = edgeId.split('|');
    const p = this.dotById.get(d1)!, q = this.dotById.get(d2)!;
    sim.lines = [...sim.lines, { id: edgeId, dot1Id: d1, dot2Id: d2, playerId: '', playerColor: 'blue' }];
    // Lines crossing the new one are no longer legal
    for (const id of [...sim.open]) {
      const [e1, e2] = id.split('|');
      if (segmentsCross(p, q, this.dotById.get(e1)!, this.dotById.get(e2)!)) sim.open.delete(id);
    }
    // A long line can only become legal by closing a triangle this line just started
    for (const c of this.byEdge.get(edgeId) ?? []) {
      if (this.missing(c, sim) !== 1) continue;
      const last = c.edgeIds.find(e => !sim.drawn.has(e))!;
      if (sim.open.has(last)) continue;
      const [l1, l2] = last.split('|');
      if (isLegalTriangleLine(this.board.dots, sim.lines, this.dotById.get(l1)!, this.dotById.get(l2)!)) sim.open.add(last);
    }
  }

  fork(sim: Sim): Sim {
    return { drawn: new Set(sim.drawn), open: new Set(sim.open), lines: sim.lines };
  }

  /** Undrawn sides of c */
  missing(c: Candidate, sim: Sim): number {
    let n = 0;
    for (const e of c.edgeIds) if (!sim.drawn.has(e)) n++;
    return n;
  }

  /** c has one side left and that side is a legal move right now */
  closable(c: Candidate, sim: Sim): boolean {
    if (this.missing(c, sim) !== 1) return false;
    return sim.open.has(c.edgeIds.find(e => !sim.drawn.has(e))!);
  }

  closes(edgeId: string, sim: Sim): boolean {
    return (this.byEdge.get(edgeId) ?? []).some(c => this.closable(c, sim));
  }

  /** Drawing this edge leaves a shape the opponent can close */
  givesAway(edgeId: string, sim: Sim): boolean {
    const touched = (this.byEdge.get(edgeId) ?? []).filter(c => this.missing(c, sim) === 2);
    if (touched.length === 0) return false;
    const next = this.fork(sim);
    this.play(next, edgeId);
    return touched.some(c => this.closable(c, next));
  }

  /** How many shapes the opponent could grab in a row after we draw edgeId */
  sacrificeSize(edgeId: string): number {
    const sim = this.fork(this.start);
    this.play(sim, edgeId);
    let taken = 0;
    for (;;) {
      const ready = this.candidates.find(c => this.closable(c, sim));
      if (!ready) return taken;
      const last = ready.edgeIds.find(e => !sim.drawn.has(e))!;
      const before = (this.byEdge.get(last) ?? []).filter(c => this.closable(c, sim)).length;
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

  const model = new Model(board, { drawn, open: new Set(open.map(e => e.id)), lines: board.drawnLines });
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
