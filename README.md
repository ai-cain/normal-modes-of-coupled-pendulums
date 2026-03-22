# Normal Modes of Coupled Pendulums

An advanced simulation and visualization engine for computing the normal modes, natural frequencies, and modal superposition dynamics of $n$-coupled pendulums.

## 🧠 Project Goal

This project models the complex dynamics of a system of $n$ coupled pendulums from the perspective of modal analysis and linear algebra. Using programmatic derivations of mass ($M$) and stiffness ($K$) matrices, we calculate the system's eigenvalues and eigenvectors to render interactive, real-time modal animations.

More than just a physics animation sandbox, this repository is architected as an applied mathematics tool bridging C++ computational dynamics, Python analytical validation, and TypeScript web visualization.

## 📐 Mathematical Foundation

The core algebraic equations are based on the academic reference for $n$-coupled pendulums.
We linearize the Lagrangian of $n$ identical pendulum masses to arrive at a matrix differential equation:

$$ M \frac{d^2 \mathbf{\theta}}{dt^2} + K \mathbf{\theta} = \mathbf{0} $$

By reducing this to a generalized eigenvalue problem $(M^{-1}K)\mathbf{A} = \omega^2\mathbf{A}$, we find:
- **The Eigenvalues ($\omega^2$)**: Real, squared natural frequencies of the system.
- **The Eigenvectors ($\mathbf{A}$)**: Form the orthogonal basis (modal shapes) defining how the pendulums swing in harmony.

📥 **See the full mathematical derivation and LaTeX proofs in [docs/mathematical_model.md](docs/mathematical_model.md).**

## 🧩 Architecture

This project is built using a "senior tier" modular stack splitting numerics and UI:

1. **Numerical Engine (C++)**:
   - High-performance matrix builders and RK4 integrators.
   - Eigen3 numerical library for generalized eigendecompositions.
2. **Analytical Validation (Python)**:
   - Scripts using `NumPy` and `SciPy` to construct mathematical truths and validate engine outputs.
3. **Web Visualization (TypeScript/React)**:
   - React + Vite dashboard displaying canvas renders of the pendulums, modal frequency spectrums, and dynamic phase plots.

## 🚀 Getting Started

*(Instructions for building the C++ engine and starting the React web server will be added here as components are implemented.)*

---
*Inspired by the derivations at [Física en el Ordenador - Universidad del País Vasco](http://www.sc.ehu.es/sbweb/fisica3/oscilaciones/pendulo_doble/n_pendulos.html).*
