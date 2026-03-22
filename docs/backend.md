# Backend

The backend lives in `backend_node/` and acts as a thin bridge between the browser and the native C++ solver.

## Runtime Role

The backend is only needed for the linear modal view.

It does not integrate nonlinear motion. That work happens in the frontend.

## File of Interest

- [backend_node/server.js](/c:/Users/SMARTECHLATAM%20GERALD/Desktop/git3/normal-modes-of-coupled-pendulums/backend_node/server.js)

## Responsibilities

- start an HTTP server on port `3001`
- create a WebSocket server on top of it
- accept messages from the frontend
- normalize `n`, `g`, `lengths`, and `masses`
- invoke `pendulum_cli.exe`
- parse the JSON response and send it back to the client

## Message Shape

The frontend sends JSON of the form:

```json
{
  "n": 4,
  "g": 9.8,
  "lengths": [0.28, 0.28, 0.28, 0.28],
  "masses": [1.0, 1.0, 1.0, 1.0]
}
```

The backend converts this into CLI arguments:

```text
pendulum_cli.exe n g l1 l2 ... ln m1 m2 ... mn
```

## Why `execFile`

The backend uses `execFile` rather than spawning a full shell. This keeps the call simpler and avoids the shell parsing layer.

## Current Limitations

- there is no explicit schema validation library yet
- error handling is intentionally minimal
- the executable path is currently hard-coded to the `Release` build location

These are acceptable for local development, but they would be the first things to harden for production use.
