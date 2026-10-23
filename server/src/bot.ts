import { Edge, GameShape, DrawnLine, BotDifficulty } from './types';

// ── Computer opponent ─────────────────────────────────────────────────────────
//
// Classic dots-and-boxes heuristics, generalised to any shape:
//   1. Close a shape whenever possible.
//   2. Otherwise play a "safe" edge that leaves no shape one edge from closing.
//   3. Otherwise sacrifice the edge that hands the opponent the fewest shapes.
// Easy skips steps 2–3 and sometimes misses a closable shape.

function missingCount(shape: GameShape, drawn: Set<string>): number {
  let n = 0;
  for (const e of shape.edgeIds) if (!drawn.has(e)) n++;
  return n;
}

function shapesByEdge(shapes: GameShape[]): Map<string, GameShape[]> {
  const map = new Map<string, GameShape[]>();
  for (const s of shapes)
    for (const e of s.edgeIds) {
      if (!map.has(e)) map.set(e, []);
      map.get(e)!.push(s);
    }
  return map;
}

/** Number of shapes the given edge would close right now */
function closesCount(edgeId: string, byEdge: Map<string, GameShape[]>, drawn: Set<string>): number {
  return (byEdge.get(edgeId) ?? []).filter(s => !s.winnerId && missingCount(s, drawn) === 1).length;
}

/** Drawing this edge leaves some open shape with exactly one missing edge */
function givesAway(edgeId: string, byEdge: Map<string, GameShape[]>, drawn: Set<string>): boolean {
  return (byEdge.get(edgeId) ?? []).some(s => !s.winnerId && missingCount(s, drawn) === 2);
}

/** How many shapes the opponent could grab in a row after we draw edgeId */
function sacrificeSize(edgeId: string, shapes: GameShape[], byEdge: Map<string, GameShape[]>, drawn: Set<string>): number {
  const sim = new Set(drawn);
  sim.add(edgeId);
  const won = new Set(shapes.filter(s => s.winnerId || missingCount(s, sim) === 0).map(s => s.id));
  let taken = 0;
  for (;;) {
    const ready = shapes.find(s => !won.has(s.id) && missingCount(s, sim) === 1);
    if (!ready) return taken;
    const last = ready.edgeIds.find(e => !sim.has(e))!;
    sim.add(last);
    for (const s of byEdge.get(last) ?? [])
      if (!won.has(s.id) && missingCount(s, sim) === 0) { won.add(s.id); taken++; }
  }
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function chooseBotMove(
  validEdges: Edge[],
  shapes: GameShape[],
  drawnLines: DrawnLine[],
  difficulty: BotDifficulty,
): Edge | null {
  const drawn  = new Set(drawnLines.map(l => l.id));
  const open   = validEdges.filter(e => !drawn.has(e.id));
  if (open.length === 0) return null;
  const byEdge = shapesByEdge(shapes);

  const closing = open.filter(e => closesCount(e.id, byEdge, drawn) > 0);

  if (difficulty === 'easy') {
    if (closing.length > 0 && Math.random() < 0.6) return pick(closing);
    return pick(open);
  }

  if (closing.length > 0) return pick(closing);

  const safe = open.filter(e => !givesAway(e.id, byEdge, drawn));
  if (safe.length > 0) return pick(safe);

  if (difficulty === 'medium') return pick(open);

  // Hard: give away as little as possible
  let best: Edge[] = [];
  let bestCost = Infinity;
  for (const e of open) {
    const cost = sacrificeSize(e.id, shapes, byEdge, drawn);
    if (cost < bestCost) { bestCost = cost; best = [e]; }
    else if (cost === bestCost) best.push(e);
  }
  return pick(best);
}
