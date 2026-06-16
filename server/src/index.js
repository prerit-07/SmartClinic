import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import {
  getState,
  addPatient,
  callNext,
  finishCurrent,
  removePatient,
  setAvgTime,
  resetState,
} from './state.js';

const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// Health check endpoint.
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

  // Send current state immediately on connect.
  socket.emit('queue:state', getState());

  socket.on('patient:add', (data, ack) => {
    try {
      addPatient(data);
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

  // Doctor finished with current patient, no one next in queue.
  socket.on('finish:current', (ack) => {
    finishCurrent();
    broadcastState();
    ack?.({ ok: true });
  });

  socket.on('patient:remove', (tokenNumber, ack) => {
    try {
      removePatient(tokenNumber);
      broadcastState();
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
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
