# Coupled Pendulums Sandbox

Interactive sandbox for serial coupled pendulums with two complementary views of the same system:

- `Nonlinear Sandbox`: integrates the full coupled equations for large angles, unequal lengths, and unequal masses.
- `Linear Modes`: solves the small-angle generalized eigenvalue problem to show normal modes, frequencies, and modal superposition.

The frontend is a React + Vite canvas app. The linear modal solver lives in C++ and is served to the UI through a small Node/WebSocket bridge.

## Demo Video

[Download the higher-quality recording (`demo.gif`)](docs/media/demo.gif)

<p align="center">
  <img src="docs/media/demo.gif" alt="Coupled pendulums demo animation" width="82%" />
</p>

## What Is Implemented

- Arbitrary number of pendulums from `1` to `10`
- Equal/unequal toggles for:
  - lengths
  - masses
  - initial angles
- Nonlinear time evolution with RK4 integration
- Linear modal analysis with unequal lengths and unequal masses
- Fading trails for each bob so phase-space-like recurrence is easier to see on the canvas

## Mathematical Scope

- The nonlinear mode is the physical sandbox.
  It supports large angles and can show strongly non-periodic motion, including chaotic-looking behavior in appropriate energy regimes.
- The linear mode is intentionally not chaotic.
  After small-angle linearization, the system becomes an integrable modal superposition problem.

The full derivation of the implemented model is in [docs/mathematical_model.md](docs/mathematical_model.md).

## Project Layout

- `engine_cpp/`
  - C++ modal solver for the linearized generalized eigenvalue problem
- `backend_node/`
  - Node server exposing the C++ solver over WebSocket
- `frontend_web/`
  - React UI, canvas renderer, nonlinear RK4 sandbox, and controls

## Running Locally

### 1. Build the C++ engine

From the repository root:

```powershell
cmake -S engine_cpp -B engine_cpp/build
cmake --build engine_cpp/build --config Release
```

### 2. Start the backend

```powershell
cd backend_node
pnpm install
pnpm start
```

The backend expects the executable at `engine_cpp/build/Release/pendulum_cli.exe`.

### 3. Start the frontend

```powershell
cd frontend_web
pnpm install
pnpm dev
```

Then open `http://localhost:5173/`.

The frontend reads the backend WebSocket URL from `frontend_web/.env`:

```env
VITE_BACKEND_WS_URL=ws://localhost:3001
```

For deploys, copy `frontend_web/.env.example` and set it to your public backend WebSocket URL.

## Notes

- In `Nonlinear Sandbox`, chaos is possible but not guaranteed for every release condition.
- In `Linear Modes`, large angles are clamped because the modal model is only valid in the small-angle regime.
- The current implementation assumes point masses connected by rigid, massless rods in a planar serial chain.

## Core Equations

For the full nonlinear serial chain with unequal masses and unequal lengths, the implemented equations are

```math
\sum_{j=1}^{n} \mu_{ij} l_j \cos(\theta_i-\theta_j)\,\ddot{\theta}_j
=
-\mu_i g \sin(\theta_i)
- \sum_{j=1}^{n} \mu_{ij} l_j \sin(\theta_i-\theta_j)\,\dot{\theta}_j^2
```

with

```math
\mu_i = \sum_{k=i}^{n} m_k
\qquad
\mu_{ij} = \sum_{k=\max(i,j)}^{n} m_k
```

That nonlinear system is what the frontend integrates in `Nonlinear Sandbox`.

For the small-angle modal view, the C++ engine solves the linearized generalized eigenvalue problem

```math
K v = \lambda M v
\qquad
\lambda = \omega^2
```

with

```math
M_{ij} = \mu_{ij} l_i l_j
\qquad
K_{ij} = \delta_{ij}\,\mu_i g l_i
```

## Where To Look

- For the real mathematical model implemented in the app, read [docs/mathematical_model.md](docs/mathematical_model.md).
- For the nonlinear RK4 sandbox in code, look at `frontend_web/src/App.tsx`.
- For the linear modal solver in C++, look at `engine_cpp/src/pendulum_system.cpp`.

## Project Docs

Documentation for the rest of the stack is now organized in `docs/`:

- [docs/index.md](docs/index.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/frontend.md](docs/frontend.md)
- [docs/backend.md](docs/backend.md)
- [docs/engine_cpp.md](docs/engine_cpp.md)
- [docs/development.md](docs/development.md)
- [docs/docs_site.md](docs/docs_site.md)

If you want a browsable docs site, install the Python docs dependencies and run:

```powershell
python -m pip install -r requirements-docs.txt
python -m mkdocs serve
```
