import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dirname, '..', 'state.json');

const DEFAULT_STATE = {
  currentToken: 0,
  avgConsultTime: 8, // minutes
  lastIssuedToken: 0,
  queue: [],
};

let state = loadState();

function loadState() {
  if (existsSync(STATE_FILE)) {
    try {
      const parsed = JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
      return { ...DEFAULT_STATE, ...parsed };
    } catch (err) {
      console.error('Failed to read state.json, starting fresh:', err.message);
    }
  }
  return { ...DEFAULT_STATE };
}

function persist() {
  try {
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('Failed to persist state:', err.message);
  }
}

// Returns a deep-ish copy so callers can't mutate internal state directly.
export function getState() {
  return {
    currentToken: state.currentToken,
    avgConsultTime: state.avgConsultTime,
    queue: state.queue.map((p) => ({ ...p })),
  };
}

// Add a patient, auto-assigning the next token number.
export function addPatient(name) {
  const clean = String(name || '').trim();
  if (!clean) {
    throw new Error('Patient name is required');
  }
  state.lastIssuedToken += 1;
  state.queue.push({
    tokenNumber: state.lastIssuedToken,
    name: clean,
    status: 'waiting',
  });
  persist();
  return getState();
}

// Call the next waiting patient. Marks the previous current as done.
export function callNext() {
  const next = state.queue.find((p) => p.status === 'waiting');
  if (!next) {
    return getState(); // nothing to call; queue empty
  }
  // Mark anyone currently being served as done.
  state.queue.forEach((p) => {
    if (p.status === 'serving') p.status = 'done';
  });
  next.status = 'serving';
  state.currentToken = next.tokenNumber;
  persist();
  return getState();
}

// Set average consultation time in minutes. Clamps to a non-negative integer.
export function setAvgTime(minutes) {
  const value = Number(minutes);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('avgTime must be a non-negative number');
  }
  state.avgConsultTime = Math.round(value);
  persist();
  return getState();
}

// Reset everything (handy for demos).
export function resetState() {
  state = { ...DEFAULT_STATE, queue: [] };
  persist();
  return getState();
}
