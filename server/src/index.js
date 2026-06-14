import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import {
  getState,
  addPatient,
  callNext,
  setAvgTime,
  resetState,
} from './state.js';

const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// Health check endpoint (useful for Render/Railway uptime checks).
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', state: getState() });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGIN, methods: ['GET', 'POST'] },
});

// Broadcast the full state to every connected client.
function broadcastState() {
  io.emit('queue:state', getState());
}

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Send current state immediately on connect so new screens render right away.
  socket.emit('queue:state', getState());

  socket.on('patient:add', (name, ack) => {
    try {
      addPatient(name);
      broadcastState();
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  socket.on('call:next', (ack) => {
    callNext();
    broadcastState();
    ack?.({ ok: true });
  });

  socket.on('avgTime:set', (minutes, ack) => {
    try {
      setAvgTime(minutes);
      broadcastState();
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  socket.on('queue:reset', (ack) => {
    resetState();
    broadcastState();
    ack?.({ ok: true });
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`SmartClinic server listening on port ${PORT}`);
});
