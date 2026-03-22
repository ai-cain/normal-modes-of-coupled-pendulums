# C++ Engine

The native solver lives in `engine_cpp/`.

Its job is narrowly scoped: solve the linearized modal problem for unequal masses and unequal lengths.

## Main Files

- [engine_cpp/src/main.cpp](/c:/Users/SMARTECHLATAM%20GERALD/Desktop/git3/normal-modes-of-coupled-pendulums/engine_cpp/src/main.cpp)
- [engine_cpp/src/pendulum_system.hpp](/c:/Users/SMARTECHLATAM%20GERALD/Desktop/git3/normal-modes-of-coupled-pendulums/engine_cpp/src/pendulum_system.hpp)
- [engine_cpp/src/pendulum_system.cpp](/c:/Users/SMARTECHLATAM%20GERALD/Desktop/git3/normal-modes-of-coupled-pendulums/engine_cpp/src/pendulum_system.cpp)
- [engine_cpp/CMakeLists.txt](/c:/Users/SMARTECHLATAM%20GERALD/Desktop/git3/normal-modes-of-coupled-pendulums/engine_cpp/CMakeLists.txt)

## Input Contract

The executable expects:

```text
pendulum_cli.exe n g l1 l2 ... ln m1 m2 ... mn
```

If some arrays are missing, defaults are filled in by the program.

## Internal Steps

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
5. Return JSON with:
   - frequencies
   - modal shapes
   - inverse modal shapes

## Why a Generalized Self-Adjoint Solver

The current implementation uses Eigen's generalized self-adjoint solver rather than explicitly building `M^-1 K`.

That is preferable because:

- the linearized system is naturally a generalized symmetric problem
- it is numerically cleaner
- it preserves the structure of the mechanics better than multiplying by `M^-1`

## Output Shape

The engine prints JSON to stdout. The backend then parses and forwards that JSON to the frontend.

This makes the native solver easy to test independently from the web app.
