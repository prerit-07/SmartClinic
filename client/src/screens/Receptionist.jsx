import { useState } from 'react';
import { socket } from '../socket.js';
import { useQueue } from '../useQueue.js';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));
}

function printReceipt(patient) {
  const receiptWindow = window.open('', '_blank', 'width=420,height=640');
  if (!receiptWindow) return;

  const receiptDate = patient.paidAt
    ? new Date(patient.paidAt).toLocaleString()
    : new Date().toLocaleString();

  receiptWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Receipt ${patient.receiptNumber || patient.tokenNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 24px; color: #102033; }
          .receipt { border: 1px solid #dbe5ea; border-radius: 8px; padding: 20px; }
          h1 { margin: 0 0 4px; font-size: 24px; }
          .muted { color: #64748b; margin: 0 0 20px; }
          .row { display: flex; justify-content: space-between; border-top: 1px solid #e5edf1; padding: 12px 0; }
          .total { font-size: 20px; font-weight: 800; }
          .footer { margin-top: 24px; color: #64748b; font-size: 13px; text-align: center; }
          @media print { button { display: none; } body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="receipt">
          <h1>SmartClinic</h1>
          <p class="muted">Consultation Fee Receipt</p>
          <div class="row"><span>Receipt No.</span><strong>${patient.receiptNumber || '-'}</strong></div>
          <div class="row"><span>Date</span><strong>${receiptDate}</strong></div>
          <div class="row"><span>Token</span><strong>#${patient.tokenNumber}</strong></div>
          <div class="row"><span>Patient</span><strong>${patient.name}</strong></div>
          <div class="row total"><span>Paid</span><strong>${formatCurrency(patient.consultFee)}</strong></div>
          <p class="footer">Please keep this receipt until your consultation is complete.</p>
        </div>
        <script>window.print();</script>
      </body>
    </html>
  `);
  receiptWindow.document.close();
}

export default function Receptionist() {
  const { state, connected } = useQueue();
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');
  const [place, setPlace] = useState('');
  const [contact, setContact] = useState('');
  const [consultFee, setConsultFee] = useState('');
  const [avgInput, setAvgInput] = useState('');
  const [error, setError] = useState('');
  // Track which tokens are mid-removal to prevent double-click race.
  const [removingTokens, setRemovingTokens] = useState(new Set());

  const waiting = state.queue.filter((p) => p.status === 'waiting');
  const serving = state.queue.find((p) => p.status === 'serving');
  const servingWait = serving ? state.avgConsultTime : 0;

  function handleAdd(e) {
    e.preventDefault();
    // Trim + reject whitespace-only first name
    const first = firstName.trim();
    if (!first) {
      setError('First name is required.');
      return;
    }

    const fullName = [first, middleName.trim(), lastName.trim()]
      .filter(Boolean)
      .join(' ');

    // Contact: exactly 10 digits (also enforced server-side)
    const cleanContact = contact.trim();
    if (!/^[0-9]{10}$/.test(cleanContact)) {
      setError('Contact number must be exactly 10 digits.');
      return;
    }
    if (/^(\d)\1{9}$/.test(cleanContact)) {
      setError('Contact number cannot be all identical digits (e.g. 0000000000).');
      return;
    }

    // Age validation (1 - 120)
    const cleanAge = age.trim();
    if (cleanAge !== '') {
      const ageNum = Number(cleanAge);
      if (!Number.isInteger(ageNum) || ageNum < 1 || ageNum > 120) {
        setError('Age must be a whole number between 1 and 120.');
        return;
      }
    }

    // Fee: non-negative and numeric
    const feeVal = consultFee === '' ? 0 : Number(consultFee);
    if (isNaN(feeVal) || feeVal < 0) {
      setError('Fee must be a valid non-negative number.');
      return;
    }

    socket.emit(
      'patient:add',
      {
        name: fullName,
        age: cleanAge,
        sex,
        place: place.trim(),
        contact: cleanContact,
        consultFee: feeVal,
      },
      (res) => {
        if (res && !res.ok) setError(res.error || 'Failed to add patient');
        else setError('');
      }
    );
    setFirstName('');
    setMiddleName('');
    setLastName('');
    setAge('');
    setSex('');
    setPlace('');
    setContact('');
    setConsultFee('');
  }

  function handleRemove(tokenNumber) {
    // Prevent double-click: ignore if already mid-removal for this token.
    if (removingTokens.has(tokenNumber)) return;
    setRemovingTokens((prev) => new Set(prev).add(tokenNumber));
    socket.emit('patient:remove', tokenNumber, (res) => {
      setRemovingTokens((prev) => {
        const next = new Set(prev);
        next.delete(tokenNumber);
        return next;
      });
      if (res && !res.ok) setError(res.error || 'Failed to remove patient');
      else setError('');
    });
  }

  function handleSetAvg(e) {
    e.preventDefault();
    if (avgInput === '') return;
    socket.emit('avgTime:set', Number(avgInput), (res) => {
      if (res && !res.ok) setError(res.error || 'Failed to set avg time');
      else setError('');
    });
    setAvgInput('');
  }

  return (
    <div className="page receptionist">
      <header className="topbar">
        <h1>Receptionist</h1>
        <span className={connected ? 'status status--ok' : 'status status--off'}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </header>

      <section className="now-serving">
        <span className="label">Now Serving</span>
        <span className="token">
          {serving ? `#${serving.tokenNumber}` : '-'}
        </span>
        {serving && <span className="serving-name">{serving.name}</span>}
      </section>

      {error && <p className="error">{error}</p>}

      <div className="controls">
        <form onSubmit={handleAdd} className="card controls__main">
          <h2>Add patient and collect fee</h2>
          <div className="row row--name">
            <input
              type="text"
              placeholder="First name *"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              aria-label="First name"
              required
            />
            <input
              type="text"
              placeholder="Middle name"
              value={middleName}
              onChange={(e) => setMiddleName(e.target.value)}
              aria-label="Middle name"
            />
            <input
              type="text"
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              aria-label="Last name"
            />
          </div>
          <div className="row row--fees">
            <input
              type="number"
              min="0"
              placeholder="Fee (₹)"
              value={consultFee}
              onChange={(e) => setConsultFee(e.target.value)}
              aria-label="Consultation fee"
            />
            <button type="submit">Add</button>
          </div>
          <div className="row row--demo2">
            <input
              type="number"
              min="1"
              max="120"
              placeholder="Age"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              aria-label="Age"
            />
            <select
              value={sex}
              onChange={(e) => setSex(e.target.value)}
              aria-label="Sex"
            >
              <option value="">Sex</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="row row--demo2">
            <input
              type="text"
              placeholder="Place / City"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              aria-label="Place"
            />
            <input
              id="contact-input"
              type="tel"
              placeholder="Contact no. (10 digits) *"
              value={contact}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                setContact(digits);
              }}
              inputMode="numeric"
              pattern="[0-9]{10}"
              minLength={10}
              maxLength={10}
              required
              aria-label="Contact number (10 digits, required)"
            />
          </div>
        </form>

        {/* ── Right sidebar: Queue status (top) + Avg time (bottom) ── */}
        <div className="controls__sidebar">
          <div className="card card--info">
            <h2>Queue status</h2>
            <p className="queue-stat">
              <span className="queue-stat__num">{waiting.length}</span>
              <span className="queue-stat__label">waiting</span>
            </p>
            <p className="hint">Call Next is on the <strong>Doctor</strong> screen
              &nbsp;·&nbsp; <a href="/doctor" target="_blank" rel="noreferrer">Open →</a>
            </p>
          </div>

          <form onSubmit={handleSetAvg} className="card card--compact">
            <h2>Avg consultation time</h2>
            <div className="row">
              <input
                type="number"
                min="0"
                placeholder={`${state.avgConsultTime} min`}
                value={avgInput}
                onChange={(e) => setAvgInput(e.target.value)}
                aria-label="Average consultation time in minutes"
              />
              <button type="submit">Set</button>
            </div>
            <p className="hint">Currently {state.avgConsultTime} min per patient</p>
          </form>
        </div>
      </div>


      <section className="card">
        <h2>Waiting list</h2>
        {waiting.length === 0 ? (
          <p className="empty">No patients waiting.</p>
        ) : (
          <table className="queue-table">
            <thead>
              <tr>
                <th>Token</th>
                <th>Name</th>
                <th>Fee</th>
                <th>Est. wait</th>
                <th>Receipt</th>
                <th>Remove</th>
              </tr>
            </thead>
            <tbody>
              {waiting.map((p, idx) => (
                <tr key={p.tokenNumber}>
                  <td>#{p.tokenNumber}</td>
                  <td>{p.name}</td>
                  <td>{formatCurrency(p.consultFee)}</td>
                  <td>{servingWait + idx * state.avgConsultTime} min</td>
                  <td>
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={() => printReceipt(p)}
                    >
                      Print
                    </button>
                  </td>
                  <td>
                    <button
                      className="btn-danger"
                      type="button"
                      disabled={removingTokens.has(p.tokenNumber)}
                      onClick={() => handleRemove(p.tokenNumber)}
                    >
                      {removingTokens.has(p.tokenNumber) ? '…' : 'Cancel'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
