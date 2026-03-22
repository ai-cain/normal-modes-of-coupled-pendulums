# Development Guide

This page is for working locally on the repo.

## Prerequisites

- Node.js
- pnpm
- CMake
- a C++17 compiler
- Python, only if you want to serve the docs site with MkDocs

## Local Workflow

### Build the C++ solver

From the repository root:

```powershell
cmake -S engine_cpp -B engine_cpp/build
cmake --build engine_cpp/build --config Release
```

### Start the backend

```powershell
cd backend_node
pnpm install
pnpm start
```

### Start the frontend

```powershell
cd frontend_web
pnpm install
pnpm dev
```

The app should then be available at `http://localhost:5173/`.

## Typical Edit Paths

- math or nonlinear simulation behavior
  - [frontend_web/src/App.tsx](/c:/Users/SMARTECHLATAM%20GERALD/Desktop/git3/normal-modes-of-coupled-pendulums/frontend_web/src/App.tsx)
- backend bridge behavior
  - [backend_node/server.js](/c:/Users/SMARTECHLATAM%20GERALD/Desktop/git3/normal-modes-of-coupled-pendulums/backend_node/server.js)
- modal solver and native numerics
  - [engine_cpp/src/pendulum_system.cpp](/c:/Users/SMARTECHLATAM%20GERALD/Desktop/git3/normal-modes-of-coupled-pendulums/engine_cpp/src/pendulum_system.cpp)
- documentation site
  - [mkdocs.yml](/c:/Users/SMARTECHLATAM%20GERALD/Desktop/git3/normal-modes-of-coupled-pendulums/mkdocs.yml)

## Validation Commands

Frontend build:

```powershell
cd frontend_web
pnpm build
```

C++ build:

```powershell
cmake --build engine_cpp/build --config Release
```

Native smoke test:

```powershell
.\engine_cpp\build\Release\pendulum_cli.exe 2 9.8 1.0 1.4 1.0 2.5
```

## Notes

- The nonlinear sandbox currently runs on the frontend only.
- The backend is intentionally slim.
- Python is optional and is only used for the docs toolchain in this repository.
