import { useMemo, useState } from 'react';
import { useQueue } from '../useQueue.js';

export default function Patient() {
  const { state, connected } = useQueue();
  const [lookup, setLookup] = useState('');

  const waiting = state.queue.filter((p) => p.status === 'waiting');

  // Compute wait estimate for the looked-up token.
  const result = useMemo(() => {
    const token = Number(lookup);
    if (!lookup || !Number.isInteger(token)) return null;

    const entry = state.queue.find((p) => p.tokenNumber === token);
    if (!entry) {
      return { found: false, token };
    }
    if (entry.status === 'serving') {
      return { found: true, token, status: 'serving', wait: 0, name: entry.name };
    }
    if (entry.status === 'done') {
      return { found: true, token, status: 'done', wait: 0, name: entry.name };
    }
    // waiting: count how many waiting patients are ahead of this token.
    const ahead = waiting.filter((p) => p.tokenNumber < token).length;
    return {
      found: true,
      token,
      status: 'waiting',
      ahead,
      wait: ahead * state.avgConsultTime,
      name: entry.name,
    };
  }, [lookup, state, waiting]);

  return (
    <div className="page patient">
      <span
        className={connected ? 'status status--ok dot' : 'status status--off dot'}
        title={connected ? 'Live' : 'Offline'}
      />

      <section className="now-serving now-serving--big">
        <span className="label">Now Serving</span>
        <span className="token token--xl">
          {state.currentToken > 0 ? `#${state.currentToken}` : '—'}
        </span>
      </section>

      <p className="waiting-count">
        {waiting.length === 0
          ? 'No patients waiting'
          : `${waiting.length} waiting · ~${state.avgConsultTime} min each`}
      </p>

      <section className="lookup card">
        <h2>Check your wait</h2>
        <div className="row">
          <input
            type="number"
            min="1"
            placeholder="Enter your token number"
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
            aria-label="Your token number"
          />
        </div>

        {result && !result.found && (
          <p className="lookup-result lookup-result--muted">
            Token #{result.token} is not in the queue.
          </p>
        )}
        {result && result.found && result.status === 'serving' && (
          <p className="lookup-result lookup-result--now">
            It's your turn, token #{result.token}! Please proceed.
          </p>
        )}
        {result && result.found && result.status === 'done' && (
          <p className="lookup-result lookup-result--muted">
            Token #{result.token} has already been served.
          </p>
        )}
        {result && result.found && result.status === 'waiting' && (
          <p className="lookup-result">
            {result.ahead === 0 ? (
              <>You're next! Estimated wait: <strong>~0 min</strong>.</>
            ) : (
              <>
                <strong>{result.ahead}</strong> ahead of you · estimated wait{' '}
                <strong>~{result.wait} min</strong>.
              </>
            )}
          </p>
        )}
      </section>
    </div>
  );
}
