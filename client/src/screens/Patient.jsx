import { useEffect, useRef, useState } from 'react';
import { useQueue } from '../useQueue.js';

// ─────────────────────────────────────────────────────────────────────────────
// Web-Audio chime — no audio files needed.
// ─────────────────────────────────────────────────────────────────────────────
function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const frequencies = [880, 1320, 1760];
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.55, ctx.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8);
    masterGain.connect(ctx.destination);

    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(i === 0 ? 0.6 : 0.25, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.4);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime  + 1.8);
    });
    setTimeout(() => ctx.close(), 2200);
  } catch {
    // AudioContext blocked — silently skip
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Idle-state taxonomy (deliberately documented):
//
//   serving exists            → show token number
//   !serving + waiting > 0   → "Please Wait" (patients registered, doctor between calls)
//   !serving + currentToken > 0 + waiting === 0
//                             → "Room Free"  (last patient done, doctor finished)
//   !serving + currentToken === 0 + waiting > 0
//                             → "Please Wait" (new patients, clinic just opening)
//   !serving + currentToken === 0 + waiting === 0
//                             → "Standby"    (nothing ever happened today)
//
// Chime fires only on genuine NEW token calls, never on first page load.
// ─────────────────────────────────────────────────────────────────────────────
export default function Patient() {
  const { state, connected, hasSynced } = useQueue();
  const [flash, setFlash]   = useState(false);
  const prevTokenRef        = useRef(null);   // null = not yet initialised

  // Detect "Now Serving" change → chime + flash.
  // We use hasSynced so the very first state sync never triggers it.
  useEffect(() => {
    if (!hasSynced) return;

    const token = state.currentToken;
    if (prevTokenRef.current === null) {
      // First snapshot received from server, record but do not chime
      prevTokenRef.current = token;
      return;
    }

    if (
      token > 0 &&
      prevTokenRef.current !== token
    ) {
      playChime();
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 2200);
      return () => clearTimeout(t);
    }
    prevTokenRef.current = token;
  }, [state.currentToken, hasSynced]);

  const waiting     = state.queue.filter((p) => p.status === 'waiting');
  const serving     = state.queue.find((p)  => p.status === 'serving');
  const servingWait = serving ? state.avgConsultTime : 0;

  // Determine the idle label precisely.
  function idleLabel() {
    if (waiting.length > 0) return 'Please Wait';   // patients registered, doctor between calls
    if (state.currentToken > 0) return 'Room Free'; // all done, room cleared
    return 'Standby';                               // clinic hasn't started
  }

  // Determine the empty-queue sub-message precisely.
  function emptyTitle()   {
    if (state.currentToken > 0)  return 'Queue Cleared';
    return 'No Queue Active';
  }
  function emptySub() {
    if (state.currentToken > 0)
      return 'The waiting room is empty. Walk-ins may register at the desk.';
    return 'No patients registered yet. Registrations open at the reception.';
  }

  return (
    <div className="page patient">
      {!connected && (
        <div className="connection-banner" role="alert">
          ⚠️ Connection lost. Trying to reconnect to clinic...
        </div>
      )}

      {/* Connection indicator */}
      <span
        className={connected ? 'status status--ok dot' : 'status status--off dot'}
        title={connected ? 'Live' : 'Reconnecting…'}
      />

      {/* ── Now Serving ─────────────────────────────────────────────── */}
      <section
        className={[
          'now-serving now-serving--big',
          flash    ? 'now-serving--flash' : '',
          !serving ? 'now-serving--idle'  : '',
        ].join(' ').trim()}
      >
        <span className="label">Now Serving</span>

        {serving ? (
          <span className="token token--xl">#{serving.tokenNumber}</span>
        ) : (
          <span className="idle-token">
            <span className="idle-dots">
              <span /><span /><span />
            </span>
            <span className="idle-text">{idleLabel()}</span>
          </span>
        )}

        {flash && (
          <span className="alert-badge">🔔 Number updated!</span>
        )}
      </section>

      <p className="waiting-count">
        {waiting.length === 0
          ? 'No patients waiting'
          : `${waiting.length} waiting · ~${state.avgConsultTime} min each`}
      </p>

      {/* ── Live waiting list ─────────────────────────────────────────── */}
      <section className="patient-list card">
        <h2>Patients currently waiting</h2>
        {waiting.length === 0 ? (
          <div className="queue-empty-state" role="status" aria-live="polite">
            <svg
              className="queue-empty-state__svg"
              viewBox="0 0 64 64"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <circle cx="32" cy="32" r="29" stroke="#d1fae5" strokeWidth="2" />
              <circle
                cx="32" cy="32" r="29"
                stroke="#10b981" strokeWidth="2"
                strokeDasharray="182" strokeDashoffset="0"
                strokeLinecap="round"
                className="queue-empty-state__ring"
              />
              <polyline
                points="20,33 28,41 44,25"
                stroke="#10b981" strokeWidth="3.5"
                strokeLinecap="round" strokeLinejoin="round"
                className="queue-empty-state__check"
              />
            </svg>
            <p className="queue-empty-state__title">{emptyTitle()}</p>
            <p className="queue-empty-state__sub">{emptySub()}</p>
          </div>
        ) : (
          <div className="patient-list__rows">
            {waiting.map((patient, index) => (
              <div className="patient-list__row" key={patient.tokenNumber}>
                <span className="patient-list__token">#{patient.tokenNumber}</span>
                <span className="patient-list__wait">
                  ~{servingWait + index * state.avgConsultTime} min
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
