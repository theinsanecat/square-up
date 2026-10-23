import { Dot, Edge, GameShape, DrawnLine, ShapeMode, BotDifficulty } from './types';

// ── Computer opponent ─────────────────────────────────────────────────────────
//
// Classic dots-and-boxes heuristics, generalised to any shape:
//   1. Close a shape whenever possible.
//   2. Otherwise play a "safe" edge that leaves no shape one edge from closing.
//   3. Otherwise sacrifice the edge that hands the opponent the fewest shapes.
// Easy skips steps 2–3 and sometimes misses a closable shape.
//
// Shapes and edges are fixed when the board is generated, in both modes.

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

  constructor(private readonly board: BotBoard, readonly start: Sim) {
    this.candidates = board.shapes.filter(s => !s.winnerId);
    for (const c of this.candidates)
      for (const e of c.edgeIds) {
        if (!this.byEdge.has(e)) this.byEdge.set(e, []);
        this.byEdge.get(e)!.push(c);
      }
  }

  play(sim: Sim, edgeId: string) {
    sim.drawn.add(edgeId);
    sim.open.delete(edgeId);
  }

  fork(sim: Sim): Sim {
    return { drawn: new Set(sim.drawn), open: new Set(sim.open) };
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
