// ── Shared Types ──────────────────────────────────────────────────────────────

export type PlayerColor = 'purple' | 'pink' | 'yellow' | 'blue' | 'green';
export type StampType   = 'heart'  | 'star' | 'flower' | 'diamond';
export type ShapeMode   = 'square' | 'triangle';
export type GameSize    = 'small'  | 'medium' | 'big';
export type GameStatus  = 'waiting' | 'setup' | 'playing' | 'finished';
export type BotDifficulty = 'easy' | 'medium' | 'hard';

// A dot node on the board (coordinates normalised 0-1)
export interface Dot {
  id: string;
  x: number;
  y: number;
}

// A valid connection edge between two dots
export interface Edge {
  id: string;       // lineKey(dot1Id, dot2Id)
  dot1Id: string;
  dot2Id: string;
}

// A line that has been drawn by a player
export interface DrawnLine extends Edge {
  playerId: string;
  playerColor: PlayerColor;
}

// A potential shape (square = 4 dotIds, triangle = 3 dotIds)
export interface GameShape {
  id: string;
  dotIds: string[];
  edgeIds: string[];          // all edges that must be drawn to complete it
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
  isBot?: boolean;
}

export interface GameConfig {
  shapeMode: ShapeMode;
  size: GameSize;
  botDifficulty?: BotDifficulty;   // solo games only
}

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

// ── Socket Event Payloads ─────────────────────────────────────────────────────

export interface CreateRoomPayload  { playerName: string; }
export interface CreateSoloRoomPayload { playerName: string; difficulty?: BotDifficulty; }
export interface JoinRoomPayload    { roomCode: string; playerName: string; }
export interface PlayerSetupPayload { color: PlayerColor; stamp: StampType; isReady: boolean; }
export interface HostConfigPayload  { config: GameConfig; }
export interface DrawLinePayload    { dot1Id: string; dot2Id: string; }

export interface RoomCreatedPayload { roomCode: string; playerId: string; gameState: GameState; }
export interface RoomJoinedPayload  { playerId: string; gameState: GameState; }
export interface LineDrawnPayload   {
  line: DrawnLine;
  completedShapes: GameShape[];
  gameState: GameState;
}
export interface GameOverPayload    { gameState: GameState; winnerId: string | null; }
export interface ErrorPayload       { message: string; }
