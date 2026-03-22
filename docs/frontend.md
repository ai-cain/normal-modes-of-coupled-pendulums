# Frontend

The frontend lives in `frontend_web/` and is a React + Vite application.

## Main Responsibilities

- render the UI
- switch between nonlinear and linear views
- maintain current state, playback, and initial conditions
- send configuration commands to the backend
- draw the pendulum chain and fading tails on a canvas
- record the canvas when requested

## Entry Point

- [frontend_web/src/main.tsx](/c:/Users/SMARTECHLATAM%20GERALD/Desktop/git3/normal-modes-of-coupled-pendulums/frontend_web/src/main.tsx)
- [frontend_web/src/App.tsx](/c:/Users/SMARTECHLATAM%20GERALD/Desktop/git3/normal-modes-of-coupled-pendulums/frontend_web/src/App.tsx)

## State Model

The frontend stores:

- `simulationMode`
  - `nonlinear` or `linear`
- distribution modes
  - `lengthMode`
  - `massMode`
  - `angleMode`
- physical parameters
  - `n`
  - `g`
  - `lengths`
  - `masses`
  - `initialAngles`
- runtime state
  - play or pause
  - current time
  - nonlinear angles and velocities
  - trail history

## Nonlinear Path

The nonlinear path is now engine-backed:

1. The frontend sends the current setup to the backend.
2. The backend forwards it to the native C++ engine.
3. The engine integrates the nonlinear equations and streams back world-space bob positions.
4. The frontend renders those positions on the canvas.

This path is used when the user selects `Nonlinear Sandbox`.

## Linear Path

The linear path is modal:

1. The frontend sends parameters to the backend over WebSocket.
2. The backend forwards them to the native engine.
3. The native engine solves the modal problem and reconstructs
   `theta(t)` internally over time.
4. The frontend renders the streamed positions.

This path is used when the user selects `Linear Modes`.

## Visual Layer

The canvas renderer draws:

- the ceiling anchor
- rods
- bobs
- colored trajectory tails

Each bob gets its own color and a finite trail length so the screen stays readable.

## UI Design Notes

The interface exposes equal/unequal toggles separately for:

- masses
- lengths
- initial angles

When a quantity is set to `equal`, only one slider is shown.
When a quantity is set to `unequal`, per-pendulum sliders are shown.

This keeps the UI compact for symmetric experiments while still supporting fully heterogeneous setups.
