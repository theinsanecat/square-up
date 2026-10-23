import { useSocket } from './hooks/useSocket';
import LandingPage from './components/LandingPage';
import SetupScreen from './components/SetupScreen';
import GameBoard from './components/GameBoard';
import PlayerPanel from './components/PlayerPanel';
import WinModal from './components/WinModal';

// ── SVG icon helpers ──────────────────────────────────────────────────────────
const GearIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.6">
    <circle cx="7.5" cy="7.5" r="2.2"/>
    <path d="M7.5 1v2M7.5 12v2M1 7.5h2M12 7.5h2" strokeLinecap="round"/>
    <path d="M3.2 3.2l1.4 1.4M10.4 10.4l1.4 1.4M10.4 3.2l-1.4 1.4M4.6 8.9l-1.4 1.4" strokeLinecap="round"/>
  </svg>
);
const ExitIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M9 1H2a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h7" strokeLinecap="round"/>
    <path d="M11 10l3-2.5L11 5M6 7.5h8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const SquareModeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="1" y="1" width="12" height="12" rx="1.5"/>
  </svg>
);
const TriModeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M7 1.5L13 12.5H1L7 1.5Z" strokeLinejoin="round"/>
  </svg>
);

export default function App() {
  const {
    connected, gameState, myPlayerId, myPlayer, error, opponentLeft, gameEndedByHost,
    createRoom, createSoloRoom, joinRoom, sendSetup, sendHostConfig, drawLine,
    requestRematch, restartToSetup, endGame, clearError,
  } = useSocket();

  const handleNewRoom = () => window.location.reload();

  // Redirect home if host ended the game
  if (gameEndedByHost) {
    return (
      <div className="landing" style={{ justifyContent: 'center', alignItems: 'center', display: 'flex', height: '100vh' }}>
        <div className="landing-card" style={{ maxWidth: 380, textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="#a855f7" strokeWidth="2">
              <circle cx="24" cy="24" r="20"/>
              <path d="M24 14v12M24 32v2" strokeLinecap="round"/>
            </svg>
          </div>
          <h2>Game Ended</h2>
          <p className="card-sub" style={{ marginBottom: 20 }}>The host ended the game session.</p>
          <button className="btn btn-primary full" onClick={handleNewRoom}>Back to Home</button>
        </div>
      </div>
    );
  }

  // ── Landing / Waiting ──────────────────────────────────────────────────────
  if (!gameState || gameState.status === 'waiting') {
    return (
      <>
        <LandingPage onCreateRoom={createRoom} onCreateSoloRoom={createSoloRoom} onJoinRoom={joinRoom} error={error} connected={connected} />

        {gameState?.status === 'waiting' && gameState.players.length === 1 && (
          <div className="waiting-overlay">
            <div className="waiting-card-big">
              <div className="waiting-spinner large" />
              <h2>Waiting for opponent…</h2>
              <p>Share this code with your friend:</p>
              <div className="big-code">{gameState.roomCode}</div>
              <button className="btn btn-outline mt" onClick={handleNewRoom}>Cancel</button>
            </div>
          </div>
        )}
      </>
    );
  }

  // ── Setup ──────────────────────────────────────────────────────────────────
  if (gameState.status === 'setup') {
    return (
      <SetupScreen
        gameState={gameState}
        myPlayer={myPlayer}
        onSetup={sendSetup}
        onHostConfig={sendHostConfig}
      />
    );
  }

  // ── Playing / Finished ─────────────────────────────────────────────────────
  if (gameState.status === 'playing' || gameState.status === 'finished') {
    const isHost = myPlayer?.isHost ?? false;
    const isSolo = gameState.players.some(p => p.isBot);

    return (
      <div className="game-screen">
        {/* Top bar */}
        <div className="game-topbar">
          <div className="logo-title-sm">Square<span>Up</span></div>

          <div className="topbar-center">
            {isSolo
              ? <div className="room-chip">vs <strong>Computer</strong></div>
              : <div className="room-chip">Room: <strong>{gameState.roomCode}</strong></div>}
            <div className="topbar-mode">
              {gameState.config.shapeMode === 'square' ? <SquareModeIcon /> : <TriModeIcon />}
              {gameState.config.shapeMode === 'square' ? 'Squares' : 'Triangles'}
              &nbsp;·&nbsp;
              {gameState.config.size.charAt(0).toUpperCase() + gameState.config.size.slice(1)}
            </div>
          </div>

          <div className="topbar-actions">
            {/* Edit preferences — host only */}
            {isHost && gameState.status === 'playing' && (
              <button
                className="topbar-btn"
                title="Edit game preferences (restarts game)"
                onClick={restartToSetup}
              >
                <GearIcon />
                <span>Edit</span>
              </button>
            )}
            {/* End game — host only */}
            {isHost && (
              <button
                className="topbar-btn topbar-btn-danger"
                title="End game and return to home"
                onClick={endGame}
              >
                <ExitIcon />
                <span>End Game</span>
              </button>
            )}
          </div>
        </div>

        {/* Main layout */}
        <div className="game-layout">
          {/* Left sidebar: player panels */}
          <aside className="game-sidebar">
            <PlayerPanel gameState={gameState} myPlayerId={myPlayerId} />
          </aside>

          {/* Centre: board */}
          <main className="game-main">
            <GameBoard gameState={gameState} myPlayerId={myPlayerId} onDrawLine={drawLine} />
          </main>
        </div>

        {/* Opponent left */}
        {opponentLeft && (
          <div className="modal-overlay visible">
            <div className="win-modal modal-in">
              <div style={{ fontSize: '2.5rem', margin: '0 auto 12px' }}>
                <svg width="56" height="56" viewBox="0 0 56 56" fill="none" stroke="#94a3b8" strokeWidth="2">
                  <circle cx="28" cy="22" r="10"/>
                  <path d="M8 50c0-11 9-18 20-18s20 7 20 18" strokeLinecap="round"/>
                  <path d="M38 14l8-8M46 14l-8-8" strokeLinecap="round"/>
                </svg>
              </div>
              <h1 className="modal-title">Opponent Left</h1>
              <p className="modal-sub">Your opponent disconnected from the game.</p>
              <div className="modal-actions">
                <button className="btn btn-primary" onClick={handleNewRoom}>Back to Home</button>
              </div>
            </div>
          </div>
        )}

        {/* Win modal */}
        {gameState.status === 'finished' && !opponentLeft && (
          <WinModal
            gameState={gameState}
            myPlayerId={myPlayerId}
            onNewGame={requestRematch}
            onEndGame={isHost ? endGame : handleNewRoom}
          />
        )}

        {/* Error toast */}
        {error && (
          <div className="error-toast" onClick={clearError}>{error} ✕</div>
        )}
      </div>
    );
  }

  return null;
}
