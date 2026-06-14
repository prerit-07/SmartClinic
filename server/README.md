# SmartClinic Backend

Live clinic queue server built with **Express + Socket.io**. The server owns a
single shared state object and broadcasts the full state to all clients after
every change. Screens just re-render from whatever state arrives — no diffing.

## State shape

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

`status` is one of `waiting`, `serving`, or `done`.

## Socket events

| Direction         | Event           | Payload           | Description                              |
| ----------------- | --------------- | ----------------- | ---------------------------------------- |
| Client → Server   | `patient:add`   | `name` (string)   | Adds a patient, auto-assigns next token. |
| Client → Server   | `call:next`     | —                 | Marks current as done, serves next.      |
| Client → Server   | `avgTime:set`   | `minutes` (number)| Sets average consultation time.          |
| Client → Server   | `queue:reset`   | —                 | Clears everything (demo helper).         |
| Server → Clients  | `queue:state`   | full state object | Broadcast after every change + on connect. |

All client→server events accept an optional acknowledgement callback that
returns `{ ok: true }` or `{ ok: false, error }`.

## Run locally

```bash
cd server
npm install
cp .env.example .env   # optional; adjust PORT / CORS_ORIGIN
npm run dev            # auto-restarts on changes
```

Server starts on `http://localhost:3001`. Check `GET /health` to see live state.

## Persistence

State is written to `server/state.json` on every change and reloaded on startup,
so the queue survives restarts/redeploys. The file is gitignored.

## Deploy (Render / Railway)

- Root directory: `server`
- Build command: `npm install`
- Start command: `npm start`
- Set `CORS_ORIGIN` to your deployed frontend URL.
- `PORT` is injected automatically by both platforms.
