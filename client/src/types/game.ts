// ── Shared Game Types (mirrors server/src/types.ts) ───────────────────────────

export type PlayerColor = 'purple' | 'pink' | 'yellow' | 'blue' | 'green';
export type StampType   = 'heart'  | 'star' | 'flower' | 'diamond';
export type ShapeMode   = 'square' | 'triangle';
export type GameSize    = 'small'  | 'medium' | 'big';
export type GameStatus  = 'waiting' | 'setup' | 'playing' | 'finished';

export interface Dot      { id: string; x: number; y: number; }
export interface Edge     { id: string; dot1Id: string; dot2Id: string; }
export interface DrawnLine extends Edge { playerId: string; playerColor: PlayerColor; }

export interface GameShape {
  id: string;
  dotIds: string[];
  edgeIds: string[];
  winnerId?: string;
  winnerColor?: PlayerColor;
  winnerStamp?: StampType;
}

export interface Player {
  id: string;
  socketId: string;
  name: string;
  color: PlayerColor;
  stamp: StampType;
  score: number;
  isHost: boolean;
  isReady: boolean;
}

export interface GameConfig  { shapeMode: ShapeMode; size: GameSize; }

export interface GameState {
  roomCode: string;
  players: Player[];
  currentPlayerId: string;
  dots: Dot[];
  validEdges: Edge[];
  shapes: GameShape[];
  drawnLines: DrawnLine[];
  config: GameConfig;
  status: GameStatus;
  winnerId?: string;
}

// ── Color & Stamp helpers ─────────────────────────────────────────────────────

export const COLOR_MAP: Record<PlayerColor, string> = {
  purple: '#a855f7',
  pink:   '#ec4899',
  yellow: '#eab308',
  blue:   '#3b82f6',
  green:  '#22c55e',
};

export const COLOR_GLOW: Record<PlayerColor, string> = {
  purple: 'rgba(168,85,247,0.45)',
  pink:   'rgba(236,72,153,0.45)',
  yellow: 'rgba(234,179,8,0.45)',
  blue:   'rgba(59,130,246,0.45)',
  green:  'rgba(34,197,94,0.45)',
};

export const STAMP_LABELS: Record<StampType, string> = {
  heart: '♥', star: '★', flower: '✿', diamond: '◆'
};
