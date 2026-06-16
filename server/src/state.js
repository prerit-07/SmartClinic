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
export function addPatient(patient) {
  const clean = String(
    typeof patient === 'object' && patient !== null ? patient.name : patient
  ).trim();
  if (!clean) {
    throw new Error('Patient name is required');
  }

  const rawFee =
    typeof patient === 'object' && patient !== null ? patient.consultFee : 0;
  const consultFee = Number(rawFee || 0);
  if (!Number.isFinite(consultFee) || consultFee < 0) {
    throw new Error('Consultation fee must be a non-negative number');
  }

  // Optional age — if provided must be 1–120
  const rawAge = typeof patient === 'object' && patient !== null ? patient.age : '';
  const ageStr = String(rawAge || '').trim();
  if (ageStr !== '') {
    const ageNum = Number(ageStr);
    if (!Number.isInteger(ageNum) || ageNum < 1 || ageNum > 120) {
      throw new Error('Age must be a whole number between 1 and 120');
    }
  }

  const rawContact =
    typeof patient === 'object' && patient !== null ? (patient.contact || '') : '';
  const contact = String(rawContact).trim();
  if (!contact) {
    throw new Error('Contact number is required');
  }
  if (!/^[0-9]{10}$/.test(contact)) {
    throw new Error('Contact number must be exactly 10 digits');
  }
  if (/^(\d)\1{9}$/.test(contact)) {
    throw new Error('Contact number cannot be all identical digits (e.g. 0000000000)');
  }

  state.lastIssuedToken += 1;
  state.queue.push({
    tokenNumber: state.lastIssuedToken,
    name: clean,
    age:     typeof patient === 'object' && patient !== null ? (patient.age     || '') : '',
    sex:     typeof patient === 'object' && patient !== null ? (patient.sex     || '') : '',
    place:   typeof patient === 'object' && patient !== null ? (patient.place   || '') : '',
    contact,
    consultFee: Math.round(consultFee),
    receiptNumber: `RCPT-${String(state.lastIssuedToken).padStart(4, '0')}`,
    paidAt: new Date().toISOString(),
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

// Mark the currently-serving patient as done (doctor finished, no one next).
export function finishCurrent() {
  state.queue.forEach((p) => {
    if (p.status === 'serving') p.status = 'done';
  });
  // Keep currentToken as-is so patient screen can distinguish "room was used"
  // but clear any active serving indicator via queue status only.
  persist();
  return getState();
}

// Remove a waiting patient who cancelled or left before consultation.
export function removePatient(tokenNumber) {
  const token = Number(tokenNumber);
  if (!Number.isInteger(token) || token <= 0) {
    throw new Error('Valid token number is required');
  }

  const patient = state.queue.find((p) => p.tokenNumber === token);
  if (!patient) {
    throw new Error('Patient not found');
  }
  if (patient.status !== 'waiting') {
    throw new Error('Only waiting patients can be removed');
  }

  state.queue = state.queue.filter((p) => p.tokenNumber !== token);
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
