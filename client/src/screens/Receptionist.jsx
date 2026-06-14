import { useState } from 'react';
import { socket } from '../socket.js';
import { useQueue } from '../useQueue.js';

export default function Receptionist() {
  const { state, connected } = useQueue();
  const [name, setName] = useState('');
  const [avgInput, setAvgInput] = useState('');
  const [error, setError] = useState('');

  const waiting = state.queue.filter((p) => p.status === 'waiting');
  const serving = state.queue.find((p) => p.status === 'serving');

  function handleAdd(e) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    socket.emit('patient:add', clean, (res) => {
      if (res && !res.ok) setError(res.error || 'Failed to add patient');
      else setError('');
    });
    setName('');
  }

  function handleCallNext() {
    socket.emit('call:next');
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
          {state.currentToken > 0 ? `#${state.currentToken}` : '—'}
        </span>
        {serving && <span className="serving-name">{serving.name}</span>}
      </section>

      {error && <p className="error">{error}</p>}

      <div className="controls">
        <form onSubmit={handleAdd} className="card">
          <h2>Add patient</h2>
          <div className="row">
            <input
              type="text"
              placeholder="Patient name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Patient name"
            />
            <button type="submit">Add</button>
          </div>
        </form>

        <form onSubmit={handleSetAvg} className="card">
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

        <div className="card">
          <h2>Queue control</h2>
          <button
            className="btn-primary"
            onClick={handleCallNext}
            disabled={waiting.length === 0}
          >
            Call Next
          </button>
          <p className="hint">{waiting.length} waiting</p>
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
                <th>Est. wait</th>
              </tr>
            </thead>
            <tbody>
              {waiting.map((p, idx) => (
                <tr key={p.tokenNumber}>
                  <td>#{p.tokenNumber}</td>
                  <td>{p.name}</td>
                  <td>{idx * state.avgConsultTime} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
