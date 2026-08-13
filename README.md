# Square-Up

A real-time, two-player online web game where players compete to connect dots, complete enclosed shapes (squares or triangles), and claim the board with their personal stamp.

### Play Online
**Live App:** [https://square-up-kohl.vercel.app](https://square-up-kohl.vercel.app)

---

## About the Game

Square-Up is a modern, real-time multiplayer twist on classic dot-connection games. Two players join the same room using a generated 6-letter room code and customize their player marker from a color palette (purple, pink, yellow, blue, green) and stamp icon (heart, star, flower, diamond).

Players take turns connecting adjacent dot nodes. Completing a shape claims it with the player's stamp and awards a bonus turn, allowing continuous play as long as shapes keep closing. The game ends when no further connections can be made, and the player with the most claimed shapes wins.

---

## Game Modes & Features

- **Square Mode:** A structured grid of dots where players complete four-sided squares.
- **Triangle Mode:** A dynamic pattern of randomly positioned dots connected via Delaunay triangulation where players complete three-sided triangles.
- **Board Sizes:** Small, Medium, and Big options affecting the total dot count and board density.
- **Bonus Turns:** Closing a shape rewards the player with an immediate extra turn. Closing multiple shapes sequentially keeps the turn active until a line is drawn that does not complete a shape.
- **Real-Time Multiplayer:** Built with WebSockets for instant turn synchronization and move previews.
- **Host Controls:** The room creator can re-configure game settings or end the game session for both players.

---

## How to Play

1. Open the live app link and click **Create Room**.
2. Share the 6-letter room code with a friend to join via **Join Room**.
3. Select your marker color and stamp avatar, then click **Mark as Ready**.
4. On your turn, click a dot node to select it, then click an adjacent dot node to draw a line.
5. Completing the final side of any shape fills it with your color and stamp.
6. Completing a shape gives you a bonus turn.
7. When all possible connections are completed, the player with the highest score wins the match.

---

## Tech Stack

- **Frontend:** React 18, Vite, TypeScript, Canvas API, Vanilla CSS
- **Backend:** Node.js, Express, Socket.io
- **Hosting:** Vercel (Frontend), Render (Backend)

---

## Local Setup

To run the project locally on your machine:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/theinsanecat/square-up.git
   cd square-up
   ```

2. **Start the backend server:**
   ```bash
   cd server
   npm install
   npm run dev
   ```

3. **Start the frontend application (in a new terminal):**
   ```bash
   cd client
   npm install
   npm run dev
   ```

Open `http://localhost:5173` in two browser tabs or windows to test two-player matches locally.
