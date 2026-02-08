# WhoFirst (Real-time Buzzer System)

**WhoFirst** is a web application designed to determine who pressed the buzzer "first". It is suitable for quizzes, game shows, or auctions that require precision and fairness, utilizing WebSocket technology for fast (Low-Latency) communication.

## 🌟 Features

- **Real-time Buzzer**: Accurately determines the fastest buzzer press.
- **Room System**:
  - **Create Room**: Create a new room and become the Host to control the game.
  - **Join Room**: Join a room using a Room Code.
- **Host Controls**:
  - Start a new round (Reset).
  - Set Countdown timer.
  - View the order of players who pressed the buzzer.
- **Player Customization**: Set and change player names.
- **Responsive Design**: Supports both mobile and desktop usage.

## 🛠️ Tech Stack

### Frontend
- **React** (Vite)
- **Tailwind CSS** (Styling)
- **Socket.io-client** (Real-time communication)

### Backend
- **Node.js** & **Express**
- **Socket.io** (WebSocket server)
- **TypeScript** (Both Client & Server)

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the project
   ```bash
   git clone <repository-url>
   cd who-is-first
   ```

2. Install Dependencies
   ```bash
   npm install
   ```
   *(This command will install dependencies for the root, client, and server)*

### Running Locally (Development)

Run both Frontend and Backend concurrently in Development mode:

```bash
npm run dev
```
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3001

### Other Scripts

- `npm run dev:server` - Run only the Server
- `npm run dev:client` - Run only the Client
- `npm run build` - Build both Client and Server
- `npm run build:prod` - Build and run Server (Production mode)
- `npm run lint` - Check Code standards
- `npm run format` - Format Code

## ⚙️ Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` if needed (default port is 3001).

## 🐳 Deployment (Docker)

You can easily run the application using Docker.

### Using Docker Compose (Recommended)

```bash
docker-compose up --build -d
```
The app will be available at http://localhost:3001

### Using Docker Build Manually

1. Build the image:
   ```bash
   docker build -t whofirst .
   ```
2. Run the container:
   ```bash
   docker run -p 3001:3001 whofirst
   ```

## 🚀 Deployment (Frontend Only - Vercel)

Since the Frontend is a standard Vite React app, you can deploy it to **Vercel** easily.

1. Push your code to GitHub/GitLab/Bitbucket.
2. Import the project in Vercel.
3. **IMPORTANT**: Change the **Root Directory** setting to `client`.
   - Vercel will automatically detect Vite settings.
4. Add Environment Variable:
   - `VITE_SERVER_URL`: The URL of your deployed Backend (e.g., `https://your-backend-api.onrender.com`).

> **Note**: Vercel (Serverless) does **NOT** support persistent WebSockets effectively. You need to deploy the **Backend** (Server) to a platform that supports long-running Node.js processes.

### Recommended Backend Hosting

- **Railway** (Best fit for this repo)
- **Render** (Web Service)
- **Fly.io**
- **DigitalOcean App Platform** (Worker/Service)

## 🚆 Full Stack Deployment (Railway - Recommended)

This project already builds the client and serves `client/dist` from the Node server, so Railway can run **both** frontend + backend in a single service.

### ⚡ Quick Start (Easiest)

1. Push the repo to GitHub/GitLab.
2. Go to [Railway Dashboard](https://railway.app)
3. Click **New Project** → **Deploy from GitHub Repo**
4. Select this repository
5. Railway will auto-detect `railway.json` and handle everything → **Deploy**

That's it! Your app is live at `https://<your-railway-app>.up.railway.app` ✅

### What's Configured

- `railway.json` sets **Build Command**: `npm run build`
- `railway.json` sets **Start Command**: `node server/dist/index.js`
- WebSocket (Socket.IO) fully supported on Railway
- Frontend automatically served at `/` from the backend

### Manual Setup (If Not Using railway.json)

If you need to configure manually in Railway UI:

1. Create a new **Web Service**
2. Set these values:
   - **Build Command**: `npm run build`
   - **Start Command**: `node server/dist/index.js`
3. Deploy

Railway automatically provides a `PORT` environment variable, which the server already uses.

## 🚀 Alternative: Full Stack with Render (Docker)

You can also use **Render** with Docker for full-stack deployment:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

1. Fork this repository.
2. Click the button above (or create a new **Web Service** on Render).
3. Connect your repository.
4. Render will automatically detect the `docker` environment from `render.yaml`.

## 🎯 Split Deployment: Backend on Railway + Frontend on Vercel

If you prefer **Vercel** for the frontend and **Railway** for the backend:

1. **Deploy Backend on Railway** (follow the Quick Start section above)
2. **Deploy Frontend on Vercel**:
   - Set **Root Directory** to `client`
   - Add environment variable: `VITE_SERVER_URL=https://<your-railway-app>.up.railway.app`
   - Deploy



## 📂 Project Structure

- `/client` - Frontend Source code (React)
- `/server` - Backend Source code (Node.js/Express)
