# Backend

The backend lives in `backend_node/` and acts as a thin bridge between the browser and the persistent native C++ engine.

## Runtime Role

The backend is now needed for both views:

- `Nonlinear Sandbox`
- `Linear Modes`

It does not integrate motion itself. It only translates messages between the browser and the native engine.

## File of Interest

- [backend_node/server.js](/c:/Users/SMARTECHLATAM%20GERALD/Desktop/git3/normal-modes-of-coupled-pendulums/backend_node/server.js)

## Responsibilities

- start an HTTP server on port `3001`
- create a WebSocket server on top of it
- spawn the C++ engine once and keep it alive
- accept messages from the frontend
- normalize `n`, `g`, `lengths`, `masses`, and `initialAngles`
- forward commands to the engine over `stdin`
- parse JSON snapshots from `stdout` and send them back to the client

## Message Shape

The frontend sends JSON commands of the form:

```json
{
  "type": "configure",
  "data": {
    "simulationMode": "linear",
    "n": 4,
    "g": 9.8,
    "lengths": [0.28, 0.28, 0.28, 0.28],
    "masses": [1.0, 1.0, 1.0, 1.0],
    "initialAngles": [0.2, 0.0, 0.0, 0.0],
    "playing": true
  }
}
```

The backend converts that into a compact native command line written to the engine's standard input:

```text
CONFIG    linear    4    9.8    l1,l2,l3,l4    m1,m2,m3,m4    a1,a2,a3,a4    1
```

## Why a Persistent Process

The backend now uses a long-lived native process instead of launching a new executable per update.

That matters because:

- nonlinear simulation needs continuous state
- slider changes should not restart a process for every intermediate value
- the frontend should receive streamed snapshots instead of solving physics locally

## Current Limitations

- there is no explicit schema validation library yet
- the backend currently manages one shared native engine session
- executable discovery still assumes common local build locations

These are acceptable for local development, but they would be the first things to harden for production use.
