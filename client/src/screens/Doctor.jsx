import { useState } from 'react';
import { socket } from '../socket.js';
import { useQueue } from '../useQueue.js';

// ─────────────────────────────────────────────────────────────────────────────
// Design decision (documented):
//   "Finish Consultation" always goes to Room Free first, even when there
//   are patients waiting. The doctor must explicitly click "Call Next" to
//   bring in the next patient. This gives the doctor a deliberate breather
//   between consultations and matches the physical workflow of a clinic.
//   Auto-promote is NOT used.
// ─────────────────────────────────────────────────────────────────────────────

export default function Doctor() {
  const { state, connected } = useQueue();

  // busy flag prevents double-fire from fast clicks before the server
  // broadcasts back and the UI re-renders with updated state.
  const [busy, setBusy] = useState(false);

  const waiting = state.queue.filter((p) => p.status === 'waiting');
  const serving  = state.queue.find((p)  => p.status === 'serving');

  // Guard: re-verify server-side conditions on click, not just render-time.
  function handleCallNext() {
    if (busy || waiting.length === 0) return;
    setBusy(true);
    socket.emit('call:next', () => setBusy(false));
  }

  function handleFinish() {
    if (busy || !serving) return;
    setBusy(true);
    socket.emit('finish:current', () => setBusy(false));
  }

  // Info rows for the glance card
  const infoRows = serving
    ? [
        { label: 'Name',    value: serving.name },
        { label: 'Age',     value: serving.age     || '—' },
        { label: 'Sex',     value: serving.sex     || '—' },
        { label: 'Place',   value: serving.place   || '—' },
        { label: 'Contact', value: serving.contact || '—' },
      ]
    : [];

  // Three mutually-exclusive button states:
  //  showFinish – amber  – patient currently being served (must finish first)
  //  showCall   – green  – room is free, but patients are waiting
  //  showEmpty  – grey   – room is free, and nobody is waiting
  const isServing  = Boolean(serving);
  const hasWaiting = waiting.length > 0;
  const showFinish = isServing;
  const showCall   = !isServing && hasWaiting;
  const showEmpty  = !isServing && !hasWaiting;

  // Connection label for the doctor screen (dot alone is easy to miss).
  const connLabel = !connected
    ? 'Reconnecting…'
    : busy
    ? 'Updating…'
    : null;

  return (
    <div className="page doctor">
      {/* Connection dot (top-right) */}
      <span
        className={connected ? 'status status--ok dot' : 'status status--off dot'}
        title={connected ? 'Live' : 'Reconnecting…'}
      />

      <header className="doctor-header">
        <h1>Doctor</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {connLabel && (
            <span className="doctor-conn-label">{connLabel}</span>
          )}
          <span className="doctor-queue-badge">
            {waiting.length} waiting
          </span>
        </div>
      </header>

      {/* ── Patient glance card ─────────────────────────────────────── */}
      {serving ? (
        <section className="patient-glance card">
          <div className="patient-glance__token">
            Token&nbsp;
            <strong>#{serving.tokenNumber}</strong>
            <span className="patient-glance__status-chip">In Consultation</span>
          </div>
          <table className="patient-glance__table">
            <tbody>
              {infoRows.map(({ label, value }) => (
                <tr key={label}>
                  <th>{label}</th>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <section className="patient-glance patient-glance--empty card">
          <p className="patient-glance__none">No patient in consultation</p>
        </section>
      )}

      {/* ── Action button ──────────────────────────────────────────── */}
      <div className="doctor-call-wrap">
        {showCall && (
          <>
            <button
              id="call-next-btn"
              className="btn-call-next"
              onClick={handleCallNext}
              disabled={busy}
            >
              {busy ? 'Calling…' : 'Call Next Patient'}
            </button>
            <p className="doctor-next-hint">
              Next up: Token&nbsp;<strong>#{waiting[0].tokenNumber}</strong>
            </p>
          </>
        )}

        {showFinish && (
          <>
            <button
              id="finish-btn"
              className="btn-call-next btn-finish"
              onClick={handleFinish}
              disabled={busy}
            >
              {busy ? 'Finishing…' : 'Finish Consultation'}
            </button>
            <p className="doctor-next-hint">
              {waiting.length > 0
                ? <>Next up: Token <strong>#{waiting[0].tokenNumber}</strong></>
                : 'No more patients in queue'}
            </p>
          </>
        )}

        {showEmpty && (
          <button
            id="empty-btn"
            className="btn-call-next"
            disabled
          >
            Queue Empty
          </button>
        )}
      </div>
    </div>
  );
}
