# Coupled Pendulums Docs

This documentation covers the full project, not only the mathematical model.

Use this section when you want to understand how the app is assembled end to end:

- [Architecture](architecture.md): how frontend, backend, and C++ engine fit together
- [Mathematical Model](mathematical_model.md): nonlinear and linear equations implemented in the app
- [Frontend](frontend.md): UI structure, nonlinear integrator, canvas renderer, and interaction model
- [Backend](backend.md): WebSocket server and request flow to the native engine
- [C++ Engine](engine_cpp.md): generalized eigenvalue solver for the linear modal model
- [Development Guide](development.md): local workflow, build commands, and practical notes
- [Docs Site](docs_site.md): how to serve these docs with MkDocs

## Quick Orientation

The project has two simulation paths:

- `Nonlinear Sandbox`
  - runs in the frontend
  - supports large angles, unequal lengths, and unequal masses
  - can show strongly non-periodic motion
- `Linear Modes`
  - uses the backend and C++ engine
  - solves the small-angle modal problem
  - is useful for normal modes, beats, and modal decomposition

## Repository Layout

- `frontend_web/`: React + Vite application
- `backend_node/`: Node WebSocket bridge
- `engine_cpp/`: native C++ modal solver
- `docs/`: project documentation and mathematical notes
- `mkdocs.yml`: optional docs-site configuration

## Best Entry Points

If you are reading the code for the first time:

1. Start with [Architecture](architecture.md).
2. Then read [Mathematical Model](mathematical_model.md).
3. Then jump into [frontend_web/src/App.tsx](/c:/Users/SMARTECHLATAM%20GERALD/Desktop/git3/normal-modes-of-coupled-pendulums/frontend_web/src/App.tsx).

If you only want to run the project:

1. Open [Development Guide](development.md).
2. Build the C++ engine.
3. Start the backend and frontend.
