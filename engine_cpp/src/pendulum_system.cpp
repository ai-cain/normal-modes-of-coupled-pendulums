#include "pendulum_system.hpp"
#include <Eigen/Eigenvalues>
#include <iostream>
#include <algorithm>
#include <cmath>

PendulumSystem::PendulumSystem(
    int num_pendulums,
    std::vector<double> L_array,
    std::vector<double> M_array,
    double gravity
)
    : n(num_pendulums), lengths(L_array), masses(M_array), g(gravity) {
    if (n < 1) n = 1;
    if (lengths.size() != n) lengths.assign(n, 1.12/n);
    if (masses.size() != n) masses.assign(n, 1.0);
}

void PendulumSystem::build_matrices() {
    M = Eigen::MatrixXd::Zero(n, n);
    K = Eigen::MatrixXd::Zero(n, n);
    
    for (int i = 0; i < n; ++i) {
        const double li = lengths[i];
        double masses_from_i = 0.0;
        for (int k = i; k < n; ++k) {
            masses_from_i += masses[k];
        }

        for (int j = 0; j < n; ++j) {
            const double lj = lengths[j];
            double masses_from_max = 0.0;
            for (int k = std::max(i, j); k < n; ++k) {
                masses_from_max += masses[k];
            }

            // Small-angle serial n-pendulum:
            // M_{i,j} = (sum of masses below max(i, j)) * l_i * l_j
            M(i, j) = masses_from_max * li * lj;
        }

        // Gravity contributes independently to each generalized angle, scaled by
        // the segment length and the masses hanging below that joint.
        K(i, i) = g * masses_from_i * li;
    }
}

void PendulumSystem::solve_modes() {
    // Solve the symmetric generalized eigenproblem K v = lambda M v.
    // This is more stable than explicitly forming M^-1 K and preserves the
    // self-adjoint structure of the linearized mechanics.
    Eigen::GeneralizedSelfAdjointEigenSolver<Eigen::MatrixXd> es(K, M);

    eigenvalues = es.eigenvalues();
    eigenvectors = es.eigenvectors();
    inverse_eigenvectors = eigenvectors.inverse();
}

#include <sstream>
#include <iomanip>

std::string PendulumSystem::to_json() const {
    std::stringstream ss;
    ss << std::fixed << std::setprecision(6);
    ss << "{\n";
    ss << "  \"n\": " << n << ",\n";
    ss << "  \"lengths\": [";
    for(int i=0; i<n; ++i) { ss << lengths[i] << (i<n-1?", ":""); }
    ss << "],\n";
    ss << "  \"masses\": [";
    for(int i=0; i<n; ++i) { ss << masses[i] << (i<n-1?", ":""); }
    ss << "],\n";
    ss << "  \"g\": " << g << ",\n";
    
    // frequencies = sqrt(eigenvalues)
    ss << "  \"frequencies\": [";
    for(int i=0; i<n; ++i) {
        double val = eigenvalues(i);
        ss << std::sqrt(val > 0.0 ? val : 0.0);
        if (i < n - 1) ss << ", ";
    }
    ss << "],\n";
    
    ss << "  \"modal_shapes\": [\n";
    for(int i_row=0; i_row<n; ++i_row) {
        ss << "    [";
        for(int j_col=0; j_col<n; ++j_col) {
            ss << eigenvectors(i_row, j_col) << (j_col < n - 1 ? ", " : "");
        }
        ss << "]" << (i_row < n - 1 ? ",\n" : "\n");
    }
    ss << "  ],\n";

    ss << "  \"inverse_modal_shapes\": [\n";
    for(int i_row=0; i_row<n; ++i_row) {
        ss << "    [";
        for(int j_col=0; j_col<n; ++j_col) {
            ss << inverse_eigenvectors(i_row, j_col) << (j_col < n - 1 ? ", " : "");
        }
        ss << "]" << (i_row < n - 1 ? ",\n" : "\n");
    }
    ss << "  ]\n";
    
    ss << "}\n";
    
    return ss.str();
}
