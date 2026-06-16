# SmartClinic

A live, real-time clinic queue management system. A receptionist registers patients, collects fees, and manages the waiting list; a doctor reviews patient details and calls them in; a waiting-room screen shows **Now Serving #X**, chimes on updates, and displays estimated wait times — all kept in sync over WebSockets with no page refresh.

---

## Screen Roles

1. **Receptionist Screen** (`/receptionist`): Front desk dashboard to register new patients (Name, Age, Sex, Place, Contact), set the average consultation time, print PDF receipts, and cancel waiting patients.
2. **Doctor Screen** (`/doctor`): Clinical dashboard showing the patient currently in consultation, details of their chart, and controls to finish the consultation or call the next patient.
3. **Patient Screen** (`/patient`): Read-only waiting-room TV display that flashes and chimes on token changes, lists the active queue with live estimated wait times, and displays clear clinic status messages.

---

## Tech Stack

- **Frontend:** React + Vite + `socket.io-client` (`client/`)
- **Backend:** Node.js + Express + Socket.io (`server/`)
- **State:** Single in-memory state object on the server, persisted to a JSON file (`state.json`) to survive dyno/server restarts.

---

## How Live Sync Works

The server owns one shared state object. Any change (adding a patient, calling next, canceling a token, finishing a consultation, or setting the average time) mutates that object and the server **broadcasts the full state** to every connected client via the `queue:state` event. Each screen simply re-renders from whatever state arrives.

```
  Receptionist / Doctor                Server (Socket.io)              Patient Screen
  ---------------------                ------------------              --------------
        |                                      |                              |
        |  patient:add / call:next             |                              |
        |  finish:current / patient:remove     |                              |
        | ---------------------------------->  |                              |
        |                                      |  mutate shared state         |
        |                                      |  + persist to state.json     |
        |                                      |                              |
        |          queue:state (full state, broadcast to ALL clients)         |
        | <----------------------------------- | ---------------------------> |
        |  re-render                           |                  re-render   |
        v                                      v                              v
```

---

## Data Model

```json
{
  "currentToken": 12,
  "avgConsultTime": 8,
  "queue": [
    {
      "tokenNumber": 12,
      "name": "Arjun Sharma",
      "age": "28",
      "sex": "Male",
      "place": "New Delhi",
      "contact": "9876543210",
      "consultFee": 500,
      "receiptNumber": "RCPT-0012",
      "paidAt": "2026-06-16T18:00:00.000Z",
      "status": "serving"
    },
    {
      "tokenNumber": 13,
      "name": "Priya Patel",
      "age": "34",
      "sex": "Female",
      "place": "Mumbai",
      "contact": "9812345678",
      "consultFee": 500,
      "receiptNumber": "RCPT-0013",
      "paidAt": "2026-06-16T18:05:00.000Z",
      "status": "waiting"
    }
  ]
}
```

- **`status`**: One of `waiting`, `serving`, or `done`.
- **Estimated wait time**: Calculated on-the-fly for each waiting patient based on their position in the array (`index * avgConsultTime`). It automatically handles sequence gaps when intermediate tokens are canceled.

---

## Socket Events

| Direction | Event | Payload | Description |
| :--- | :--- | :--- | :--- |
| **Client → Server** | `patient:add` | `{ name, age, sex, place, contact, consultFee }` | Registers a new patient. |
| **Client → Server** | `call:next` | — | Calls the next waiting patient into the consultation. |
| **Client → Server** | `finish:current` | — | Finishes the current patient, clearing the consulting room. |
| **Client → Server** | `patient:remove` | `tokenNumber` (number) | Cancels a waiting patient. |
| **Client → Server** | `avgTime:set` | `minutes` (number) | Updates the average consultation duration. |
| **Client → Server** | `queue:reset` | — | Clears the queue and resets the day's counters. |
| **Server → Clients** | `queue:state` | Full state object | Broadcasts the updated clinic queue state. |

---

## Edge Case Safeguards

### 1. Doctor Screen Room Flow & Double-Clicks
- **Room Free-then-call**: The doctor must explicitly click **Finish Consultation** to complete an ongoing visit and free up the room before they are allowed to click **Call Next Patient**. This gives the doctor a breather and matches physical workflows.
- **Double-Click Protection**: Actions are debounced with a client-side `busy` lock that disables the buttons until the server acknowledges the event. Server handlers are fully idempotent.

### 2. Form & Data Validations
- **Contact Number Checks**: Must be exactly 10 digits. Letters are stripped automatically. Both client and server reject dummy inputs consisting of identical digits (e.g. `0000000000`).
- **Whitespace Sanitization**: Text fields (like name) are trimmed. Whitespace-only submissions are rejected.
- **Age Bounds**: Age is optional, but if entered, must be a whole number between `1` and `120`.
- **Zero-Fee Safety**: If the fee is left blank, it defaults to `₹0` safely. All fee calculations reject negative or non-finite inputs. The PDF receipt generator prints `₹0` without crashing.

### 3. Patient Screen & Audio Alerts
- **Chime-on-load Prevention**: A `hasSynced` flag in the queue hook blocks the token-call chime/animation from firing when the patient screen is first loaded or refreshed. It only chimes for genuine, subsequent token advancements.
- **Precise Idle Labels**:
  - **Standby**: No patients have been called yet today (`currentToken === 0`, `0 waiting`).
  - **Please Wait**: Patients are in the queue, but the doctor is currently between consultations (`currentToken` active, `0 serving`, `>0 waiting`).
  - **Room Free / Queue Cleared**: All registered patients have been cleared (`currentToken > 0`, `0 waiting`).

### 4. Patient Cancellations
- **Mid-Consultation Lock**: Receptionists cannot cancel a patient currently in consultation. The active patient is filtered out of the waiting list, and the server rejects removals for any non-waiting status.
- **Double-Cancel Lock**: The "Cancel" button is immediately disabled and displays `…` when clicked, blocking consecutive clicks.

### 5. Multi-Client & Networking
- **Concurrency**: Node's event loop executes requests sequentially. Since `state.lastIssuedToken` is incremented synchronously, simultaneous additions produce consecutive, unique token numbers.
- **Connection Banners**:
  - If a screen disconnects, the connection status dot turns solid red and pulses.
  - The Patient screen displays a prominent orange warning banner at the top of the viewport (`⚠️ Connection lost. Trying to reconnect to clinic...`) to alert patients and staff.
  - Upon reconnection, the client automatically receives a fresh state broadcast from the server.

---

## Run Locally

Open two terminals.

### 1. Run the Backend
```bash
cd server
npm install
npm run dev          # Runs on http://localhost:3001
```

### 2. Run the Frontend
```bash
cd client
npm install
cp .env.example .env # VITE_SERVER_URL defaults to http://localhost:3001
npm run dev          # Runs on http://localhost:5173
```

Then open the screens in separate tabs or devices:
- **Receptionist:** <http://localhost:5173/receptionist>
- **Doctor:** <http://localhost:5173/doctor>
- **Patient Waiting Room:** <http://localhost:5173/patient>

---

## Project Structure

```
server/   Node.js + Express + Socket.io backend (state management & watch-mode file updates)
client/   React + Vite frontend (screens, custom hooks, and shared stylesheets)
```

---

## Deploying

- **Backend:** Deploy to Render, Railway, or Fly.io (with WebSocket support enabled). Set `CORS_ORIGIN` to the deployed frontend URL.
- **Frontend:** Deploy to Vercel, Netlify, or Amplify. Set `VITE_SERVER_URL` to the deployed backend URL.
