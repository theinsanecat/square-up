import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import {
  GameState, Player, GameConfig, GameStatus,
  PlayerColor, StampType,
  CreateRoomPayload, JoinRoomPayload, PlayerSetupPayload,
  HostConfigPayload, DrawLinePayload, CreateSoloRoomPayload,
  DrawnLine, BotDifficulty,
} from './types';
import {
  generateBoard, lineKey, detectCompletedShapes, isBoardComplete, determineWinner
} from './gameLogic';
import { chooseBotMove } from './bot';

// ── Express + Socket.io setup ─────────────────────────────────────────────────

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST'] }
});

app.use(cors());
app.use(express.json());
app.get('/health', (_req, res) => res.json({ ok: true }));

// ── In-memory room store ──────────────────────────────────────────────────────

const rooms = new Map<string, GameState>();

function genCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function makeRoomCode(): string {
  let code = genCode();
  while (rooms.has(code)) code = genCode();
  return code;
}

function makePlayer(socketId: string, name: string, isHost: boolean): Player {
  return {
    id: socketId,
    socketId,
    name: name || (isHost ? 'Player 1' : 'Player 2'),
    color: isHost ? 'purple' : 'blue',
    stamp: isHost ? 'heart' : 'star',
    score: 0,
    isHost,
    isReady: false,
  };
}

const BOT_COLORS: PlayerColor[] = ['blue', 'green', 'pink', 'yellow', 'purple'];
const BOT_STAMPS: StampType[]   = ['star', 'diamond', 'flower', 'heart'];
const BOT_MOVE_DELAY_MS = 700;

function makeBot(roomCode: string): Player {
  const id = `bot-${roomCode}`;
  return {
    id,
    socketId: id,
    name: 'Computer',
    color: 'blue',
    stamp: 'star',
    score: 0,
    isHost: false,
    isReady: true,
    isBot: true,
  };
}

/** Keep the bot's color and stamp different from the human's */
function adjustBotLook(state: GameState) {
  const bot   = state.players.find(p => p.isBot);
  const human = state.players.find(p => !p.isBot);
  if (!bot || !human) return;
  if (bot.color === human.color) bot.color = BOT_COLORS.find(c => c !== human.color)!;
  if (bot.stamp === human.stamp) bot.stamp = BOT_STAMPS.find(s => s !== human.stamp)!;
}

function defaultConfig(): GameConfig {
  return { shapeMode: 'square', size: 'small' };
}

function emptyGameState(roomCode: string, hostPlayer: Player): GameState {
  return {
    roomCode,
    players: [hostPlayer],
    currentPlayerId: hostPlayer.id,
    dots: [],
    validEdges: [],
    shapes: [],
    drawnLines: [],
    config: defaultConfig(),
    status: 'waiting',
  };
}

// ── Socket handlers ───────────────────────────────────────────────────────────

io.on('connection', (socket: Socket) => {
  console.log(`[+] connected ${socket.id}`);

  // ── Create room ─────────────────────────────────────────────────────────────
  socket.on('create-room', ({ playerName }: CreateRoomPayload) => {
    const code   = makeRoomCode();
    const player = makePlayer(socket.id, playerName, true);
    const state  = emptyGameState(code, player);
    rooms.set(code, state);
    socket.join(code);
    socket.emit('room-created', { roomCode: code, playerId: socket.id, gameState: state });
    console.log(`[room] created ${code} by ${socket.id}`);
  });

  // ── Create solo room (vs computer) ─────────────────────────────────────────
  socket.on('create-solo-room', ({ playerName, difficulty }: CreateSoloRoomPayload) => {
    const code   = makeRoomCode();
    const player = makePlayer(socket.id, playerName, true);
    const state  = emptyGameState(code, player);
    state.players.push(makeBot(code));
    state.config.botDifficulty = difficulty ?? 'medium';
    state.status = 'setup';
    rooms.set(code, state);
    socket.join(code);
    socket.emit('room-created', { roomCode: code, playerId: socket.id, gameState: state });
    console.log(`[room] solo ${code} created by ${socket.id}`);
  });

  // ── Join room ───────────────────────────────────────────────────────────────
  socket.on('join-room', ({ roomCode, playerName }: JoinRoomPayload) => {
    const state = rooms.get(roomCode);
    if (!state) {
      socket.emit('error', { message: 'Room not found.' }); return;
    }
    if (state.players.length >= 2 || state.players.some(p => p.isBot)) {
      socket.emit('error', { message: 'Room is full.' }); return;
    }
    if (state.status !== 'waiting') {
      socket.emit('error', { message: 'Game already in progress.' }); return;
    }

    const player = makePlayer(socket.id, playerName, false);
    state.players.push(player);
    state.status = 'setup';
    socket.join(roomCode);

    socket.emit('room-joined', { playerId: socket.id, gameState: state });
    socket.to(roomCode).emit('player-joined', { player, gameState: state });
    console.log(`[room] ${socket.id} joined ${roomCode}`);
  });

  // ── Host updates shared config ──────────────────────────────────────────────
  socket.on('host-config', ({ config }: HostConfigPayload) => {
    const state = findRoomBySocket(socket.id);
    if (!state) return;
    const host = state.players.find(p => p.isHost);
    if (!host || host.socketId !== socket.id) return;
    state.config = { ...state.config, ...config };
    io.to(state.roomCode).emit('config-updated', { gameState: state });
  });

  // ── Player updates their own setup (color / stamp / ready) ─────────────────
  socket.on('player-setup', ({ color, stamp, isReady }: PlayerSetupPayload) => {
    const state = findRoomBySocket(socket.id);
    if (!state) return;
    const player = state.players.find(p => p.socketId === socket.id);
    if (!player) return;
    player.color   = color;
    player.stamp   = stamp;
    player.isReady = isReady;
    adjustBotLook(state);

    io.to(state.roomCode).emit('setup-updated', { gameState: state });

    // Start game when both players ready
    if (state.players.length === 2 && state.players.every(p => p.isReady)) {
      startGame(state);
    }
  });

  // ── Draw a line ─────────────────────────────────────────────────────────────
  socket.on('draw-line', ({ dot1Id, dot2Id }: DrawLinePayload) => {
    const state = findRoomBySocket(socket.id);
    if (!state || state.status !== 'playing') return;
    if (state.currentPlayerId !== socket.id) {
      socket.emit('error', { message: "It's not your turn." }); return;
    }
    const err = applyMove(state, socket.id, dot1Id, dot2Id);
    if (err) socket.emit('error', { message: err });
  });

  // ── Rematch ─────────────────────────────────────────────────────────────────
  socket.on('request-rematch', () => {
    const state = findRoomBySocket(socket.id);
    if (!state) return;
    // Reset to setup phase
    for (const p of state.players) {
      p.score   = 0;
      p.isReady = !!p.isBot;
    }
    state.dots        = [];
    state.validEdges  = [];
    state.shapes      = [];
    state.drawnLines  = [];
    state.status      = 'setup';
    state.winnerId    = undefined;
    state.currentPlayerId = state.players[0].socketId;
    io.to(state.roomCode).emit('rematch-started', { gameState: state });
  });

  // ── Host restarts to setup (edit preferences) ────────────────────────────────
  socket.on('restart-to-setup', () => {
    const state = findRoomBySocket(socket.id);
    if (!state) return;
    const player = state.players.find(p => p.socketId === socket.id);
    if (!player?.isHost) return;
    for (const p of state.players) { p.score = 0; p.isReady = !!p.isBot; }
    state.dots = []; state.validEdges = []; state.shapes = [];
    state.drawnLines = []; state.status = 'setup'; state.winnerId = undefined;
    state.currentPlayerId = state.players[0].socketId;
    io.to(state.roomCode).emit('setup-restarted', { gameState: state });
    console.log(`[room] ${state.roomCode} restarted to setup`);
  });

  // ── Host ends the game for both players ──────────────────────────────────────
  socket.on('end-game', () => {
    const state = findRoomBySocket(socket.id);
    if (!state) return;
    const player = state.players.find(p => p.socketId === socket.id);
    if (!player?.isHost) return;
    io.to(state.roomCode).emit('game-ended-by-host');
    rooms.delete(state.roomCode);
    console.log(`[room] ${state.roomCode} ended by host`);
  });

  // ── Disconnect ──────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[-] disconnected ${socket.id}`);
    const state = findRoomBySocket(socket.id);
    if (!state) return;
    // Notify other player
    socket.to(state.roomCode).emit('opponent-left', { message: 'Opponent disconnected.' });
    // Clean up room if host leaves or only one player
    state.players = state.players.filter(p => p.socketId !== socket.id);
    if (state.players.every(p => p.isBot)) {
      rooms.delete(state.roomCode);
    } else {
      // Remaining player becomes host
      state.players[0].isHost = true;
      state.status = 'waiting';
    }
  });
});

// ── Moves ─────────────────────────────────────────────────────────────────────

/** Apply a move for playerId. Returns an error message if the move is rejected. */
function applyMove(state: GameState, playerId: string, dot1Id: string, dot2Id: string): string | null {
  const edgeId = lineKey(dot1Id, dot2Id);
  const valid  = state.validEdges.find(e => e.id === edgeId);
  if (!valid) return 'Invalid move.';
  if (state.drawnLines.find(l => l.id === edgeId)) return 'Line already drawn.';

  const currentPlayer = state.players.find(p => p.id === playerId)!;
  const newLine: DrawnLine = {
    id: edgeId,
    dot1Id, dot2Id,
    playerId,
    playerColor: currentPlayer.color,
  };
  state.drawnLines.push(newLine);

  // Detect completed shapes
  const completed = detectCompletedShapes(state.shapes, state.drawnLines, edgeId);
  for (const s of completed) {
    s.winnerId   = playerId;
    s.winnerColor = currentPlayer.color;
    s.winnerStamp = currentPlayer.stamp;
    currentPlayer.score++;
  }

  // Check board complete
  const done = isBoardComplete(state.validEdges, state.drawnLines);

  // Bonus turn: If player completed 1 or more shapes, they keep their turn!
  // Otherwise, switch turn to opponent.
  if (completed.length === 0) {
    const other = state.players.find(p => p.id !== playerId);
    state.currentPlayerId = other?.id ?? playerId;
  }

  if (done) {
    state.status  = 'finished';
    const winnerId = determineWinner(state.players, state.shapes);
    state.winnerId = winnerId ?? undefined;
    io.to(state.roomCode).emit('game-over', { gameState: state, winnerId });
    console.log(`[game] ${state.roomCode} over. winner=${winnerId}`);
  } else {
    io.to(state.roomCode).emit('line-drawn', {
      line: newLine,
      completedShapes: completed,
      gameState: state,
    });
    scheduleBotTurn(state);
  }
  return null;
}

/** If it's the computer's turn, play after a short pause so the human can follow along */
function scheduleBotTurn(state: GameState) {
  const bot = state.players.find(p => p.isBot);
  if (!bot || state.currentPlayerId !== bot.id || state.status !== 'playing') return;
  const lineCount = state.drawnLines.length;
  setTimeout(() => {
    // Bail if the game was reset, ended, or moved on meanwhile
    if (rooms.get(state.roomCode) !== state) return;
    if (state.status !== 'playing' || state.currentPlayerId !== bot.id) return;
    if (state.drawnLines.length !== lineCount) return;
    const difficulty: BotDifficulty = state.config.botDifficulty ?? 'medium';
    const edge = chooseBotMove({
      shapeMode:  state.config.shapeMode,
      dots:       state.dots,
      validEdges: state.validEdges,
      shapes:     state.shapes,
      drawnLines: state.drawnLines,
    }, difficulty);
    if (edge) applyMove(state, bot.id, edge.dot1Id, edge.dot2Id);
  }, BOT_MOVE_DELAY_MS);
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function findRoomBySocket(socketId: string): GameState | undefined {
  for (const state of rooms.values()) {
    if (state.players.some(p => p.socketId === socketId)) return state;
  }
  return undefined;
}

function startGame(state: GameState) {
  const board = generateBoard(state.config);
  state.dots       = board.dots;
  state.validEdges = board.validEdges;
  state.shapes     = board.shapes;
  state.drawnLines = [];
  state.status     = 'playing';
  // Host goes first
  state.currentPlayerId = state.players.find(p => p.isHost)?.socketId ?? state.players[0].socketId;
  io.to(state.roomCode).emit('game-started', { gameState: state });
  scheduleBotTurn(state);
  console.log(`[game] started ${state.roomCode} mode=${state.config.shapeMode} size=${state.config.size}`);
}

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT) || 3001;
server.listen(PORT, () => console.log(`🚀 Square-Up server on port ${PORT}`));
