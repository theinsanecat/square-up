import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  GameState, Player, PlayerColor, StampType, GameConfig, DrawnLine, GameShape
} from '../types/game';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export interface SocketState {
  socket: Socket | null;
  connected: boolean;
  gameState: GameState | null;
  myPlayerId: string | null;
  error: string | null;
  opponentLeft: boolean;
  gameEndedByHost: boolean;
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<SocketState>({
    socket: null,
    connected: false,
    gameState: null,
    myPlayerId: null,
    error: null,
    opponentLeft: false,
    gameEndedByHost: false,
  });

  const setGs = useCallback((gs: GameState) =>
    setState(s => ({ ...s, gameState: gs, error: null })), []);

  useEffect(() => {
    const socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => setState(s => ({ ...s, socket, connected: true })));
    socket.on('disconnect', () => setState(s => ({ ...s, connected: false })));
    socket.on('error', ({ message }: { message: string }) =>
      setState(s => ({ ...s, error: message })));

    socket.on('room-created', ({ playerId, gameState }: { playerId: string; gameState: GameState }) =>
      setState(s => ({ ...s, myPlayerId: playerId, gameState, error: null })));
    socket.on('room-joined', ({ playerId, gameState }: { playerId: string; gameState: GameState }) =>
      setState(s => ({ ...s, myPlayerId: playerId, gameState, error: null })));

    socket.on('player-joined',   ({ gameState }: { gameState: GameState }) => setGs(gameState));
    socket.on('config-updated',  ({ gameState }: { gameState: GameState }) => setGs(gameState));
    socket.on('setup-updated',   ({ gameState }: { gameState: GameState }) => setGs(gameState));
    socket.on('game-started',    ({ gameState }: { gameState: GameState }) => setGs(gameState));
    socket.on('line-drawn',      ({ gameState }: { line: DrawnLine; completedShapes: GameShape[]; gameState: GameState }) => setGs(gameState));
    socket.on('game-over',       ({ gameState }: { gameState: GameState; winnerId: string | null }) => setGs(gameState));
    socket.on('rematch-started', ({ gameState }: { gameState: GameState }) => setGs(gameState));
    socket.on('setup-restarted', ({ gameState }: { gameState: GameState }) => setGs(gameState));

    socket.on('opponent-left', () => setState(s => ({ ...s, opponentLeft: true })));
    socket.on('game-ended-by-host', () => setState(s => ({ ...s, gameEndedByHost: true })));

    return () => { socket.disconnect(); };
  }, [setGs]);

  // ── Actions ───────────────────────────────────────────────────────────────────

  const createRoom = useCallback((playerName: string) => {
    socketRef.current?.emit('create-room', { playerName });
    setState(s => ({ ...s, error: null }));
  }, []);

  const joinRoom = useCallback((roomCode: string, playerName: string) => {
    socketRef.current?.emit('join-room', { roomCode: roomCode.toUpperCase(), playerName });
    setState(s => ({ ...s, error: null }));
  }, []);

  const sendSetup = useCallback((color: PlayerColor, stamp: StampType, isReady: boolean) => {
    socketRef.current?.emit('player-setup', { color, stamp, isReady });
  }, []);

  const sendHostConfig = useCallback((config: GameConfig) => {
    socketRef.current?.emit('host-config', { config });
  }, []);

  const drawLine = useCallback((dot1Id: string, dot2Id: string) => {
    socketRef.current?.emit('draw-line', { dot1Id, dot2Id });
  }, []);

  const requestRematch = useCallback(() => {
    socketRef.current?.emit('request-rematch');
  }, []);

  const restartToSetup = useCallback(() => {
    socketRef.current?.emit('restart-to-setup');
  }, []);

  const endGame = useCallback(() => {
    socketRef.current?.emit('end-game');
  }, []);

  const clearError = useCallback(() =>
    setState(s => ({ ...s, error: null })), []);

  return {
    ...state,
    myPlayer: state.gameState?.players.find(p => p.id === state.myPlayerId) as Player | undefined,
    createRoom,
    joinRoom,
    sendSetup,
    sendHostConfig,
    drawLine,
    requestRematch,
    restartToSetup,
    endGame,
    clearError,
  };
}
