# Mathematical Model of the Implemented Pendulum Sandbox

This project now contains two related models of the same serial planar pendulum chain:

1. A `nonlinear` model used by the interactive physical sandbox.
2. A `linearized` model used by the modal-analysis view.

Both support unequal lengths and unequal masses.

## 1. Coordinates and Geometry

Consider a planar serial chain of `n` point masses.

- `l_i > 0` is the length of segment `i`
- `m_i > 0` is the bob mass at node `i`
- `theta_i(t)` is the angle of segment `i` measured from the downward vertical

Using `1`-based indexing, the position of mass `k` is

$$
x_k = \sum_{j=1}^{k} l_j \sin \theta_j,
\qquad
y_k = -\sum_{j=1}^{k} l_j \cos \theta_j.
$$

Its velocity is therefore

$$
\dot{x}_k = \sum_{j=1}^{k} l_j \cos\theta_j \, \dot{\theta}_j,
\qquad
\dot{y}_k = \sum_{j=1}^{k} l_j \sin\theta_j \, \dot{\theta}_j.
$$

## 2. Energies

The kinetic energy is

$$
T = \frac{1}{2}\sum_{k=1}^{n} m_k \left(\dot{x}_k^2 + \dot{y}_k^2\right).
$$

After expanding,

$$
T
= \frac{1}{2}\sum_{i=1}^{n}\sum_{j=1}^{n}
\mu_{ij} \, l_i l_j \cos(\theta_i-\theta_j)\,\dot{\theta}_i \dot{\theta}_j,
$$

where

$$
\mu_{ij} = \sum_{k=\max(i,j)}^{n} m_k.
$$

The gravitational potential is

$$
V = \sum_{k=1}^{n} m_k g y_k
= -\sum_{i=1}^{n} \mu_i g l_i \cos\theta_i,
$$

with

$$
\mu_i = \sum_{k=i}^{n} m_k.
$$

The Lagrangian is

$$
\mathcal{L}(\theta,\dot{\theta}) = T - V.
$$

## 3. Nonlinear Equations of Motion

Applying the Euler-Lagrange equations gives the nonlinear coupled dynamics

$$
\begin{aligned}
\sum_{j=1}^{n}
\mu_{ij} l_j \cos(\theta_i-\theta_j)\,\ddot{\theta}_j
&=
-\mu_i g \sin\theta_i
-\sum_{j=1}^{n}
\mu_{ij} l_j \sin(\theta_i-\theta_j)\,\dot{\theta}_j^2, \\
&\qquad i=1,\dots,n.
\end{aligned}
$$

Equivalently, define the configuration-dependent matrix

$$
A_{ij}(\theta) = \mu_{ij} l_j \cos(\theta_i-\theta_j)
$$

and the right-hand side

$$
b_i(\theta,\dot{\theta}) =
-\mu_i g \sin\theta_i
-\sum_{j=1}^{n}
\mu_{ij} l_j \sin(\theta_i-\theta_j)\,\dot{\theta}_j^2.
$$

Then the accelerations are found by solving

$$
A(\theta)\,\ddot{\theta} = b(\theta,\dot{\theta}).
$$

## 4. What the Nonlinear Sandbox Integrates

The frontend integrates the first-order system

$$
\dot{\theta} = \omega,
\qquad
\dot{\omega} = A(\theta)^{-1} b(\theta,\omega)
$$

with a fourth-order Runge-Kutta scheme (`RK4`).

This is the model used for:

- large angles
- unequal lengths
- unequal masses
- visually non-periodic and potentially chaotic motion

Important: the nonlinear system may exhibit chaotic behavior only in some regions of state space. Large angles alone do not guarantee chaos.

## 5. Linear Small-Angle Model

For normal-mode analysis, the app also uses the small-angle approximation

$$
\sin\theta_i \approx \theta_i,
\qquad
\cos(\theta_i-\theta_j) \approx 1,
\qquad
\sin(\theta_i-\theta_j) \approx 0.
$$

Under this approximation,

$$
\sum_{j=1}^{n} \mu_{ij} l_j \ddot{\theta}_j + \mu_i g \theta_i = 0.
$$

This can be written in symmetric generalized-eigenvalue form

$$
M \ddot{\theta} + K \theta = 0,
$$

with

$$
M_{ij} = \mu_{ij} l_i l_j,
\qquad
K_{ij} = \delta_{ij}\,\mu_i g l_i.
$$

The modal problem is therefore

$$
K v = \lambda M v,
\qquad
\lambda = \omega^2.
$$

The C++ backend solves this generalized self-adjoint eigenvalue problem directly.

## 6. Modal Superposition

If `v_1, \dots, v_n` are the modal vectors and `\omega_1, \dots, \omega_n` the natural frequencies, then the linear solution is

$$
\theta(t) = \sum_{k=1}^{n}
\left(
a_k \cos(\omega_k t) + b_k \sin(\omega_k t)
\right) v_k.
$$

In the current UI, the modal view uses zero initial angular velocity, so the coefficients are determined only from the initial angle vector `theta(0)`.

## 7. Why the Linear View Is Not Chaotic

After diagonalization, the linearized dynamics reduce to decoupled harmonic oscillators:

$$
\ddot{q}_k + \omega_k^2 q_k = 0.
$$

Hence the modal system is integrable. It can show:

- beating
- energy exchange between physical coordinates
- quasi-periodic motion

but not deterministic chaos.

## 8. Special Cases

### Equal masses

If `m_i = m`, then

$$
\mu_i = (n-i+1)m,
\qquad
\mu_{ij} = (n-\max(i,j)+1)m.
$$

### Equal lengths

If `l_i = l`, the linear matrices reduce to the familiar textbook forms up to overall factors of `l` and `m`.

## 9. Implementation Summary

- `frontend_web/src/App.tsx`
  - nonlinear RK4 integrator
  - equal/unequal UI toggles
  - trajectory tails for each bob
- `engine_cpp/src/pendulum_system.cpp`
  - symmetric generalized eigenproblem for the linearized model
- `backend_node/server.js`
  - passes lengths and masses from the UI to the C++ solver
