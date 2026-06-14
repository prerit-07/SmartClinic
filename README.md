# SmartClinic

A live, real-time clinic queue system. A receptionist adds patients and calls the
next token; a waiting-room screen shows **Now Serving #X** and lets patients look
up their estimated wait — all kept in sync over WebSockets with no page refresh.

## Tech stack

- **Frontend:** React + Vite + `socket.io-client` (`client/`)
- **Backend:** Node.js + Express + Socket.io (`server/`)
- **State:** single in-memory object on the server, persisted to a JSON file

## How live sync works

The server owns one shared state object. Any change (add patient, call next, set
avg time) mutates that object and the server **broadcasts the full state** to
every connected client via the `queue:state` event. Each screen simply re-renders
from whatever state arrives — there is no client-to-client communication and no
diffing logic.

The receptionist screen is the only writer; the patient screen is **read-only**
and just listens. That asymmetry is what makes sync trivially correct.

```
  Receptionist screen                Server (Socket.io)              Patient screen
  -------------------                ------------------              --------------
        |                                    |                              |
        |  patient:add / call:next /         |                              |
        |  avgTime:set                       |                              |
        | ---------------------------------> |                              |
        |                                    |  mutate shared state         |
        |                                    |  + persist to state.json     |
        |                                    |                              |
        |        queue:state (full state, broadcast to ALL clients)         |
        | <--------------------------------- | ---------------------------> |
        |  re-render                         |                  re-render    |
        v                                    v                              v
```

## Data model

```js
{
  currentToken: 12,      // token currently being served (0 = none yet)
  avgConsultTime: 8,     // minutes per consultation
  queue: [
    { tokenNumber: 13, name: "Ramesh", status: "waiting" },
    { tokenNumber: 14, name: "Sita",   status: "serving" }
  ]
}
```

`status` is one of `waiting`, `serving`, `done`. Estimated wait for a token =
(number of waiting patients ahead) × `avgConsultTime`.

## Socket events

| Direction         | Event         | Payload            |
| ----------------- | ------------- | ------------------ |
| Client → Server   | `patient:add` | `name` (string)    |
| Client → Server   | `call:next`   | —                  |
| Client → Server   | `avgTime:set` | `minutes` (number) |
| Client → Server   | `queue:reset` | —                  |
| Server → Clients  | `queue:state` | full state object  |

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
cp .env.example .env # VITE_SERVER_URL defaults to http://localhost:3001
npm run dev          # http://localhost:5173
```

Then open:
- Receptionist: <http://localhost:5173/receptionist>
- Patient waiting room: <http://localhost:5173/patient>

Open both in separate tabs/devices to see live sync.

## Deploy

- **Backend** → Render or Railway (both support WebSockets). Root dir `server`,
  start command `npm start`. Set `CORS_ORIGIN` to the deployed frontend URL.
- **Frontend** → Vercel or Netlify. Root dir `client`, build `npm run build`,
  output `dist`. Set `VITE_SERVER_URL` to the deployed backend URL.

## Project structure

```
server/   Express + Socket.io backend (state model + event handlers)
client/   React + Vite frontend (receptionist + patient screens)
```

## Design decisions & assumptions

- **Broadcast-full-state over per-event diffs** — simplest correct sync model;
  screens never get out of step because they always render the latest snapshot.
- **JSON-file persistence** — chosen over pure in-memory so the queue survives
  free-tier dyno restarts/redeploys during a demo.
- **Assumptions:** single doctor/counter, no authentication, one clinic.

## What I'd add with more time

- Multiple doctors/counters, each with its own queue.
- Patient notifications (SMS/web push) when their token is near.
- Receptionist login/auth.
- A real database (SQLite/Postgres) if persistence needs grow.
