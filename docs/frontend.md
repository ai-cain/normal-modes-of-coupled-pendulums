# Frontend

The frontend lives in `frontend_web/` and is a React + Vite application.

## Main Responsibilities

- render the UI
- switch between nonlinear and linear views
- integrate the nonlinear equations in the browser
- maintain current state, playback, and initial conditions
- draw the pendulum chain and fading tails on a canvas

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

The nonlinear solver is implemented entirely in the frontend:

1. Build suffix mass sums.
2. Assemble the nonlinear linear system `A(theta) theta_ddot = b(theta, theta_dot)`.
3. Solve that linear system by Gaussian elimination.
4. Integrate the first-order system with RK4.
5. Render the resulting rod and bob positions on the canvas.

This path is used when the user selects `Nonlinear Sandbox`.

## Linear Path

The linear path is modal:

1. The frontend sends parameters to the backend over WebSocket.
2. The backend returns frequencies and modal shapes.
3. The frontend computes modal coefficients using `V^-1 theta_0`.
4. The frontend reconstructs

$$
\theta_i(t) = \sum_k c_k V_{ik}\cos(\omega_k t).
$$

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
