# Architecture

This repository is split into three runtime layers plus documentation:

## High-Level Flow

1. The React frontend collects user inputs such as:
   - number of pendulums
   - lengths
   - masses
   - initial angles
   - simulation mode
2. The frontend sends the current configuration and control state to the Node backend over WebSocket.
3. The backend forwards those commands to a persistent C++ engine process over `stdin/stdout`.
4. The C++ engine owns the simulation state, advances time internally, and emits JSON snapshots with angles and bob positions.
5. The backend forwards those snapshots back to the browser over WebSocket.
6. The frontend renders the received world positions on the canvas.

## Responsibilities by Layer

### Frontend

- state and UI controls
- equal/unequal toggles for mass, length, and angle
- WebSocket client for engine commands and snapshots
- canvas rendering
- trajectory tails
- recording support

### Backend

- receives WebSocket messages from the browser
- validates and normalizes incoming arrays
- keeps a long-lived native engine process alive
- translates browser JSON messages into native engine commands
- forwards native engine JSON snapshots back to the frontend

### C++ Engine

- maintains the authoritative simulation state
- integrates the nonlinear equations with RK4
- builds the linearized mass and stiffness matrices
- solves `K v = lambda M v`
- reconstructs linear modal motion over time
- returns snapshots with angles, velocities, positions, and frequencies

## Why the Project Uses Two Models

The nonlinear and linear modes answer different questions:

- nonlinear mode answers:
  - what happens for arbitrary large-angle releases?
  - how do unequal masses and lengths affect full motion?
- linear mode answers:
  - what are the normal modes?
  - what are the natural frequencies?
  - how does an initial state decompose into modal coordinates?

Keeping both paths is useful because the linear mode is analytically interpretable, while the nonlinear mode is the physical sandbox. Both are now served by the same native engine so the browser stays focused on controls and rendering.

## Main Files

- [frontend_web/src/App.tsx](/c:/Users/SMARTECHLATAM%20GERALD/Desktop/git3/normal-modes-of-coupled-pendulums/frontend_web/src/App.tsx)
- [backend_node/server.js](/c:/Users/SMARTECHLATAM%20GERALD/Desktop/git3/normal-modes-of-coupled-pendulums/backend_node/server.js)
- [engine_cpp/src/main.cpp](/c:/Users/SMARTECHLATAM%20GERALD/Desktop/git3/normal-modes-of-coupled-pendulums/engine_cpp/src/main.cpp)
- [engine_cpp/src/pendulum_system.cpp](/c:/Users/SMARTECHLATAM%20GERALD/Desktop/git3/normal-modes-of-coupled-pendulums/engine_cpp/src/pendulum_system.cpp)
