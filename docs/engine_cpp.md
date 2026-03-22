# C++ Engine

The native engine lives in `engine_cpp/`.

Its job is now broader: maintain the authoritative simulation state for both nonlinear dynamics and linear normal modes.

## Main Files

- [engine_cpp/src/main.cpp](/c:/Users/SMARTECHLATAM%20GERALD/Desktop/git3/normal-modes-of-coupled-pendulums/engine_cpp/src/main.cpp)
- [engine_cpp/src/pendulum_system.hpp](/c:/Users/SMARTECHLATAM%20GERALD/Desktop/git3/normal-modes-of-coupled-pendulums/engine_cpp/src/pendulum_system.hpp)
- [engine_cpp/src/pendulum_system.cpp](/c:/Users/SMARTECHLATAM%20GERALD/Desktop/git3/normal-modes-of-coupled-pendulums/engine_cpp/src/pendulum_system.cpp)
- [engine_cpp/src/simulation_engine.hpp](/c:/Users/SMARTECHLATAM%20GERALD/Desktop/git3/normal-modes-of-coupled-pendulums/engine_cpp/src/simulation_engine.hpp)
- [engine_cpp/src/simulation_engine.cpp](/c:/Users/SMARTECHLATAM%20GERALD/Desktop/git3/normal-modes-of-coupled-pendulums/engine_cpp/src/simulation_engine.cpp)
- [engine_cpp/CMakeLists.txt](/c:/Users/SMARTECHLATAM%20GERALD/Desktop/git3/normal-modes-of-coupled-pendulums/engine_cpp/CMakeLists.txt)

## Runtime Modes

The executable supports two runtime styles:

```text
pendulum_cli.exe n g l1 l2 ... ln m1 m2 ... mn
pendulum_cli.exe --stdio-server
```

The first form keeps the original one-shot modal CLI.
The second form starts a persistent simulation server that reads commands from `stdin` and writes JSON snapshots to `stdout`.

## Internal Steps

For linear mode:

1. Parse `n`, `g`, `lengths`, and `masses`.
2. Build the linearized matrices:

$$
M_{ij} = \mu_{ij} l_i l_j,
\qquad
K_{ij} = \delta_{ij} \mu_i g l_i.
$$

3. Solve the generalized self-adjoint eigenproblem:

$$
K v = \lambda M v.
$$

4. Convert eigenvalues to frequencies using `omega = sqrt(lambda)`.
5. Reconstruct modal motion over time from the initial angles.

For nonlinear mode:

1. Build suffix mass sums.
2. Assemble the coupled acceleration system.
3. Solve that linear system by Gaussian elimination.
4. Integrate the first-order system with RK4.
5. Convert the resulting angles into world-space bob positions.

## Why a Generalized Self-Adjoint Solver

The current implementation uses Eigen's generalized self-adjoint solver rather than explicitly building `M^-1 K`.

That is preferable because:

- the linearized system is naturally a generalized symmetric problem
- it is numerically cleaner
- it preserves the structure of the mechanics better than multiplying by `M^-1`

## Output Shape

In server mode the engine prints JSON snapshots to stdout, including:

- mode
- time
- playing state
- angles
- velocities
- bob positions
- frequencies for linear mode

The backend then forwards those snapshots to the frontend.
