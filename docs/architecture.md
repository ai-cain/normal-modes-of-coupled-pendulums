# Architecture

This repository is split into three runtime layers plus documentation:

## High-Level Flow

1. The React frontend collects user inputs such as:
   - number of pendulums
   - lengths
   - masses
   - initial angles
   - simulation mode
2. In `Nonlinear Sandbox`, the frontend integrates the equations directly in the browser.
3. In `Linear Modes`, the frontend sends `n`, `lengths`, `masses`, and `g` to the Node backend over WebSocket.
4. The backend invokes the C++ executable with those parameters.
5. The C++ engine builds the linearized matrices, solves the generalized eigenproblem, and returns JSON.
6. The frontend uses the returned modal data to animate the small-angle solution.

## Responsibilities by Layer

### Frontend

- state and UI controls
- equal/unequal toggles for mass, length, and angle
- nonlinear RK4 integrator
- canvas rendering
- trajectory tails
- linear modal reconstruction from eigenvectors and frequencies

### Backend

- receives WebSocket messages from the browser
- validates and normalizes incoming arrays
- launches the native executable with `execFile`
- returns parsed JSON back to the frontend

### C++ Engine

- builds the linearized mass and stiffness matrices
- solves `K v = lambda M v`
- returns frequencies, modal shapes, and inverse modal shapes

## Why the Project Uses Two Solvers

The nonlinear and linear modes answer different questions:

- nonlinear mode answers:
  - what happens for arbitrary large-angle releases?
  - how do unequal masses and lengths affect full motion?
- linear mode answers:
  - what are the normal modes?
  - what are the natural frequencies?
  - how does an initial state decompose into modal coordinates?

Keeping both paths is useful because the linear mode is analytically interpretable, while the nonlinear mode is the physical sandbox.

## Main Files

- [frontend_web/src/App.tsx](/c:/Users/SMARTECHLATAM%20GERALD/Desktop/git3/normal-modes-of-coupled-pendulums/frontend_web/src/App.tsx)
- [backend_node/server.js](/c:/Users/SMARTECHLATAM%20GERALD/Desktop/git3/normal-modes-of-coupled-pendulums/backend_node/server.js)
- [engine_cpp/src/main.cpp](/c:/Users/SMARTECHLATAM%20GERALD/Desktop/git3/normal-modes-of-coupled-pendulums/engine_cpp/src/main.cpp)
- [engine_cpp/src/pendulum_system.cpp](/c:/Users/SMARTECHLATAM%20GERALD/Desktop/git3/normal-modes-of-coupled-pendulums/engine_cpp/src/pendulum_system.cpp)
