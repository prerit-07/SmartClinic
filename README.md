# SmartClinic 🩺

A live, real-time clinic queue system built for **Queue Cure '26**.

76% of India's clinics still run on paper token slips and shouting. SmartClinic
replaces that with three synced screens: a **receptionist** registers patients
and collects fees, a **doctor** calls the next patient with one click, and a
**patient waiting-room display** shows the live token, estimated wait, and a
chime the moment the doctor calls someone new — all without anyone refreshing
a page.

## Screens

| Screen | Route | What it does |
|---|---|---|
| 🗂️ Receptionist | `/receptionist` | Add patient (first/middle/last name, age, sex, place, 10-digit contact), collect consultation fee, auto-generate a receipt number, print the receipt, cancel a waiting patient, set average consultation time, view the live waiting list. |
| 🩺 Doctor | `/doctor` | Glance card of the patient currently in consultation (name, age, sex, place, contact). **Call Next Patient** (green) when the queue has people. **Finish Consultation** (amber) when serving someone. Buttons disable cleanly when there's nothing to do. |
| 🖥️ Patient waiting room | `/patient` | Large **Now Serving** token with a chime + flash on every new call. Shows **Standby** (clinic hasn't started), **Please Wait** (registered but doctor between calls), or **Room Free** (last patient done, room cleared). Compact waiting list — **token + estimated wait only, no names**, for patient privacy. Animated empty state when the queue clears. |

## Tech stack

- **Frontend:** React + Vite + `react-router-dom` + `socket.io-client` (`client/`)
- **Backend:** Node.js + Express + Socket.io (`server/`)
- **Real-time:** all three screens stay in sync over WebSockets, no page refresh
- **Persistence:** single state object on the server, persisted to `server/state.json` so the queue survives a server restart

## How live sync works

The server owns one shared state object. Any mutating action (add patient,
call next, finish consultation, remove patient, set avg time) updates that
object, persists it to `state.json`, and the server **broadcasts the full
state** to every connected client via `queue:state`. Every screen simply
re-renders from whatever state arrives — there is no client-to-client
communication and no diffing logic, so screens can never drift out of sync
with each other, only momentarily lag behind the server.

The **Doctor screen is the sole owner of queue progression** (`call:next` /
`finish:current`). The Receptionist screen only adds, removes, and sets the
average time — it never advances the queue. Giving exactly one screen control
over advancing the queue avoids two screens racing to call the same action.

```
Receptionist screen          Doctor screen              Server (Socket.io)             Patient screen
--------------------         --------------             -------------------             --------------
      |                            |                            |                              |
      | patient:add /              | call:next /               |                              |
      | patient:remove /           | finish:current             |                              |
      | avgTime:set                |                            |                              |
      | -------------------------> | -------------------------> |                              |
      |                            |                            |  mutate shared state          |
      |                            |                            |  + persist to state.json      |
      |                            |                            |                              |
      |        queue:state (full state, broadcast to ALL connected clients)                     |
      | <------------------------- | <------------------------- | -------------------------->  |
      |  re-render                 |  re-render                 |                  re-render     |
      v                            v                            v                              v
```

## Data model

```js
{
  currentToken: 12,       // token number last called (0 = none called yet today)
  avgConsultTime: 8,      // minutes per consultation, settable at runtime
  lastIssuedToken: 14,    // counter used to assign the next token number
  queue: [
    {
      tokenNumber: 13,
      name: "Ramesh Kumar",
      age: "34",
      sex: "Male",
      place: "Tikamgarh",
      contact: "9876543210",
      consultFee: 200,
      receiptNumber: "RCPT-0013",
      paidAt: "2026-06-16T09:12:00.000Z",
      status: "waiting"        // "waiting" | "serving" | "done"
    }
  ]
}
```

Estimated wait for a waiting patient at queue position `idx` (0-based) =
`(avgConsultTime if someone is currently being served else 0) + idx * avgConsultTime`.
This is computed live on the client from the broadcast state — never hardcoded.

## Socket events

| Direction | Event | Payload | Notes |
|---|---|---|---|
| Client → Server | `patient:add` | `{ name, age, sex, place, contact, consultFee }` | Validated server-side: name required, contact must be exactly 10 digits and not all-identical, age 1–120 if provided, fee non-negative. Returns `{ ok, error? }` via ack. |
| Client → Server | `call:next` | — | Promotes the next waiting patient (lowest token) to `serving`, marks any previously-serving patient `done`. No-op if queue is empty. |
| Client → Server | `finish:current` | — | Marks the currently-serving patient `done`. Does **not** auto-promote the next patient — the doctor must explicitly click Call Next. |
| Client → Server | `patient:remove` | `tokenNumber` | Removes a **waiting** patient only; rejected via ack error if the token is already `serving`/`done` or doesn't exist. |
| Client → Server | `avgTime:set` | `minutes` | Rejected via ack error if negative or non-numeric. |
| Client → Server | `queue:reset` | — | Clears the whole queue back to a clean slate (new day / demo reset). |
| Server → Clients | `queue:state` | full state object | Broadcast to **everyone** after any mutation, and once immediately to a client on connect so it never waits for the next change. |

## Socket event diagram

```
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│  Receptionist screen │   │    Doctor screen     │   │   Patient screen     │
│    (writer: add /    │   │   (writer: advance    │   │     (read-only)      │
│   remove / avg time) │   │   the queue only)     │   │                      │
└──────────┬───────────┘   └──────────┬───────────┘   └──────────┬───────────┘
           │                          │                          │
           │ patient:add              │ call:next                │
           │ patient:remove           │ finish:current           │
           │ avgTime:set              │                          │
           │ queue:reset              │                          │
           ▼                          ▼                          │
┌─────────────────────────────────────────────────────────────┐  │
│                     Socket.io Server (Express)                │  │
│                                                                │  │
│   1. Validate payload (state.js)                              │  │
│      - reject via ack({ ok:false, error }) if invalid          │  │
│   2. Mutate shared state object                                │  │
│   3. Persist to state.json                                     │  │
│   4. io.emit('queue:state', getState())  ──────────────────┐  │  │
│   5. ack({ ok:true }) back to the calling client only       │  │  │
└───────────────────────────────────────────────────────────┼──┘  │
           ▲                          ▲                      │     │
           │     queue:state          │     queue:state       │     │
           └──────────────────────────┴───────────────────────┴─────┘
                    (broadcast to ALL connected sockets, including
                     a fresh client that just connected)
```

**Event-by-event walkthrough:**

1. **Receptionist adds a patient.** Client emits `patient:add` with the form payload. Server validates (name, 10-digit contact, age range, fee) inside `state.js`. On success it pushes a new `{ status: "waiting" }` entry, persists, and broadcasts `queue:state` to all three screen types. On failure it returns `{ ok: false, error }` only to the Receptionist via the ack callback — no broadcast happens, so other screens never see a rejected/partial state.

2. **Doctor calls next.** Client emits `call:next` (no payload). Server finds the lowest-numbered `waiting` token, marks any currently-`serving` token as `done`, marks the new one `serving`, persists, and broadcasts. The Patient screen detects `currentToken` changed and fires the chime + flash. The Doctor screen's glance card updates with the new patient's details.

3. **Doctor finishes.** Client emits `finish:current`. Server marks the `serving` token `done` and broadcasts — by design this does **not** auto-promote the next patient (see Design Decisions below), so the Doctor screen returns to "Room Free" until Call Next is clicked again.

4. **Receptionist cancels a waiting patient.** Client emits `patient:remove` with a `tokenNumber`. Server rejects via ack if that token is not currently `waiting` (e.g. already being served or already done), otherwise removes it and broadcasts.

5. **Avg time changes.** Client emits `avgTime:set` with `minutes`. Server validates non-negative, updates `avgConsultTime`, broadcasts. Every screen's estimated-wait calculation picks up the new value on the very next render, since it's computed live from broadcast state rather than cached.

6. **New client connects.** The server immediately calls `socket.emit('queue:state', getState())` to that one socket on connection, so a screen opened mid-day shows the correct current state without waiting for someone else to trigger a change.

## Run locally

Open two terminals.

**1. Backend**

```bash
cd server
npm install
npm run dev          # http://localhost:3001
```

**2. Frontend**

```bash
cd client
npm install
npm run dev           # http://localhost:5173
```

Then open:

- Receptionist: <http://localhost:5173/receptionist>
- Doctor: <http://localhost:5173/doctor>
- Patient waiting room: <http://localhost:5173/patient>

Open all three in separate tabs (or separate devices on the same network) to
see live sync — add a patient on Receptionist, call them on Doctor, and watch
the Patient screen update with a chime, with no refresh anywhere.

## Deploy

- **Backend** → Render or Railway (both support WebSockets). Root dir `server`, start command `npm start`. Set `CORS_ORIGIN` to the deployed frontend URL.
- **Frontend** → Vercel or Netlify. Root dir `client`, build `npm run build`, output `dist`. Set `VITE_SERVER_URL` to the deployed backend URL.

## Project structure

```
server/
  src/
    index.js     Express + Socket.io server, event wiring, broadcast logic
    state.js     Queue state model, validation, persistence to state.json
  state.json     Generated at runtime — the persisted queue (gitignored)

client/
  src/
    screens/
      Receptionist.jsx   Add/remove patients, fees, receipts, avg time
      Doctor.jsx         Call next / finish consultation, patient glance card
      Patient.jsx        Now Serving display, chime, waiting list, empty states
    useQueue.js          Shared hook: subscribes to queue:state, tracks connection
    socket.js            Socket.io client connection
    styles.css
```

## Design decisions & assumptions (quick reference)

- Broadcast-full-state on every change, no diffing.
- Doctor screen exclusively owns queue progression; Receptionist never calls or finishes.
- "Finish Consultation" goes to Room Free, never auto-promotes — doctor must click Call Next.
- JSON-file persistence over in-memory, so the queue survives a restart mid-demo.
- No patient names shown on the public Patient screen — token + wait time only.
- All validation enforced server-side, not just in the form.
- Assumptions: single doctor/counter, single clinic, no auth, one queue per day.

Full reasoning, including concurrency handling and every edge case
considered, is in the **Thought process** section below.

## Thought process

**How I interpreted the problem.** The brief asked for a token-based queue
with two synced screens. I extended that to three screens because a real
clinic has three distinct roles with three distinct needs: the receptionist
needs a fast intake form, the doctor needs a single clear action button and
patient context, and the patient needs reassurance and privacy — not the same
information the doctor sees. Splitting "call next" onto the Doctor screen
specifically (rather than leaving it on Receptionist, as the original brief
implied) was a deliberate deviation: in a real clinic the receptionist
doesn't always know the doctor is ready, but the doctor always does.

**Why one shared state object, broadcast in full, every time.** The
alternative — sending incremental diffs per event — is harder to get right
and easier to get subtly wrong (a dropped or out-of-order event leaves a
client permanently desynced). Broadcasting the complete state on every change
means every screen is always rendering a real snapshot the server actually
held at some point; there is no client-side merge logic that could introduce
a bug. The cost is more bytes per update, which is irrelevant at clinic scale
(single digits of waiting patients, occasional events).

**Concurrency — what I considered and how it's handled:**

- *Two clients clicking the same action at once* (e.g. two Doctor screen tabs
  open, both click Call Next). The server processes socket events
  sequentially on a single event loop — there's no real parallelism within
  one Node process, so two near-simultaneous `call:next` emits are still
  handled one after another. The second one simply sees an already-updated
  state (e.g. queue already advanced) and acts on that, so the worst case is
  a no-op, not a corrupted double-advance.
- *Fast repeated clicks on one client before the UI re-renders.* Handled
  client-side with a `busy` boolean on both the Doctor screen (guards
  `call:next` / `finish:current`) and a `removingTokens` Set on the
  Receptionist screen (guards `patient:remove` per-token). The button
  disables immediately on click and only re-enables once the server's ack
  callback fires, so a double-click can't fire the event twice.
- *Receptionist cancelling a patient the Doctor is mid-consultation with.*
  Deliberately disallowed: `removePatient` in `state.js` throws if the
  patient's status is not `"waiting"`. Only patients who haven't been called
  yet can be cancelled, so a consultation in progress can never be silently
  pulled out from under the doctor.
- *A client trusting only client-side validation.* Every validation rule
  (name required, contact exactly 10 digits and not all-identical, age
  1–120, fee non-negative) is enforced again inside `state.js` on the server,
  independent of what the form already checked. The client-side checks exist
  purely for instant feedback; the server is the actual authority and
  returns a structured error via the ack callback if a request slips through
  invalid.
- *A new screen opening mid-day.* The server emits the current `queue:state`
  to a socket immediately on connection, before any new event happens, so a
  screen opened at 2pm doesn't show stale or empty data until the next
  action.
- *Server restart mid-day.* State is persisted to `state.json` after every
  single mutation, not batched, so a crash or restart loses at most the
  in-flight request, not the day's queue.

**Edge cases specifically designed for:**

- *Doctor finishes a consultation with patients still waiting.* Resolved by
  always going to "Room Free" rather than auto-promoting — see the dedicated
  decision below.
- *Empty queue.* The Doctor screen's action button has three mutually
  exclusive states (Call Next / Finish / disabled "Queue Empty") computed
  from `isServing` and `hasWaiting`, so there's never a moment where a button
  is clickable but would do nothing.
- *Patient screen distinguishing "nothing has happened today" from "everyone
  has been seen."* These look identical if you only check "is anyone
  currently being served" — both are "no." The fix was tracking
  `currentToken > 0` (something was called at least once today) separately
  from `waiting.length` and `serving`, giving three distinct, correctly
  labeled idle states: Standby (`currentToken === 0`, nothing has happened),
  Please Wait (people are waiting), and Room Free (`currentToken > 0`, queue
  empty, last patient done).
- *Patient screen privacy.* Names are never sent to that screen's rendering
  path in a way that's displayed — only token number and estimated wait. The
  waiting room is a shared physical space; showing names there would leak
  information to every other patient present.
- *Chime firing on first page load.* A patient opening the waiting-room page
  receives an initial `queue:state` snapshot just like any other update. If
  the chime fired on every state event, it would chime immediately on load
  for no reason. Fixed with a `hasSynced` flag and a ref tracking the
  previous token — the very first snapshot received is recorded silently,
  and the chime only fires on a subsequent, genuine change.

**Why "Finish Consultation" doesn't auto-promote the next patient.** This was
the single biggest behavioral decision in the project. Auto-promoting (next
patient becomes "serving" the instant the doctor finishes) is technically
simpler, but it assumes the doctor is instantly ready for the next person,
which isn't true in a real clinic — there's often a need to write notes, take
a short break, or prepare the room. Going to "Room Free" first and requiring
an explicit "Call Next" click gives the doctor that buffer and matches the
physical workflow more honestly, at the cost of one extra click per patient.

**Assumptions made:** single doctor/counter (no multi-room support), single
clinic instance (no multi-tenancy), no authentication on any screen, one
continuous queue per day reset manually via `queue:reset` rather than an
automatic midnight rollover.

**What I'd reconsider with more time:** token numbers never reset or reuse
gaps after a cancellation, which is fine for a single day but would need a
cleaner reset strategy for multi-day continuous operation; and there's
currently no limit on how many patients can be added in immediate succession,
which would matter if this were exposed to true public internet traffic
rather than a single front desk.

## What I'd add with more time

- Multiple doctors/counters, each with its own queue
- Daily report / history view (patients seen, fees collected, average actual wait)
- SMS/WhatsApp notification when a patient's token is close
- Receptionist login/auth
- A real database (SQLite/Postgres) if persistence needs grow beyond a single clinic
