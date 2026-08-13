# Square-Up 🎮

> Real-time two-player dot connection game — form squares and triangles to claim them!

## Project Structure

```
square-up/
├── client/   ← React + Vite + TypeScript frontend
└── server/   ← Node.js + Express + Socket.io backend
```

---

## Running Locally

### 1. Start the server
```bash
cd server
npm install
npm run dev          # ts-node-dev on port 3001
```

### 2. Start the client (new terminal)
```bash
cd client
npm install          # already done if you scaffolded
npm run dev          # Vite dev server on port 5173
```

Open **http://localhost:5173** in two browser windows. One creates a room, the other joins with the 6-letter code.

---

## Deploying for Remote Play

You need to host **two services**:
1. **Server** (Node.js) — handles real-time game logic
2. **Client** (static site) — the React frontend

### Deploying the Server to Railway

1. Go to [railway.app](https://railway.app) and sign in.
2. Click **New Project → Deploy from GitHub repo**.
3. Point it at the `server/` folder (set root directory to `server`).
4. Railway will detect the `railway.json` and build automatically.
5. **Add an environment variable**: `PORT=3001` (Railway sets this automatically).
6. Once deployed, copy your **Railway public URL** (e.g. `https://square-up-server-production.up.railway.app`).

### Deploying the Client to Vercel / Netlify

#### Option A — Vercel (recommended)
```bash
cd client
# Edit .env.production → set VITE_SERVER_URL=https://your-railway-url
npm run build
npx vercel dist/    # follow prompts
```

#### Option B — Netlify
```bash
cd client
# Edit .env.production → set VITE_SERVER_URL=https://your-railway-url
npm run build
# Drag-and-drop the dist/ folder at app.netlify.com
```

### Step-by-step checklist
- [ ] Deploy server to Railway → copy the public URL
- [ ] Edit `client/.env.production`: set `VITE_SERVER_URL=https://your-railway-url`
- [ ] Run `npm run build` in `client/`
- [ ] Deploy `client/dist/` to Vercel or Netlify
- [ ] Share the Vercel/Netlify URL with your friend 🎉

---

## Game Rules

| Rule | Detail |
|---|---|
| **Modes** | **Squares**: grid of dots, complete 4-sided squares. **Triangles**: random dots, complete 3-sided triangles. |
| **Sizes** | Small / Medium / Big — determines number of dots |
| **Setup** | Each player picks a color (purple/pink/yellow/blue/green) and stamp (♥/★/✿/◆) |
| **Turns** | Alternating — one line connection per turn |
| **Claiming** | The player who draws the *last edge* of a shape claims it with their stamp |
| **Winning** | Game ends when all valid edges are drawn. Most shapes wins! |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Styling | Vanilla CSS (glassmorphism dark theme) |
| Real-time | Socket.io 4 |
| Backend | Node.js + Express + Socket.io |
| Game Logic | Bowyer-Watson Delaunay triangulation (triangles mode) |
| Hosting | Railway (server) + Vercel/Netlify (client) |
