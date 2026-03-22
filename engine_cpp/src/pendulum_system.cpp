#include "pendulum_system.hpp"
#include <Eigen/Eigenvalues>
#include <iostream>
#include <algorithm>
#include <cmath>

PendulumSystem::PendulumSystem(int num_pendulums, std::vector<double> L_array, double gravity) 
    : n(num_pendulums), lengths(L_array), g(gravity) {
    if (n < 1) n = 1;
    if (lengths.size() != n) lengths.assign(n, 1.12/n);
}

void PendulumSystem::build_matrices() {
    M = Eigen::MatrixXd::Zero(n, n);
    K = Eigen::MatrixXd::Zero(n, n);
    
    for (int i = 0; i < n; ++i) {
        for (int j = 0; j < n; ++j) {
            // M_{i,j} = (SUM_{k=max(i,j)}^{n} m_k) * l_j
            // For equal masses m_k=1, this is (n - max(i,j)) * l_j
            M(i, j) = (n - std::max(i, j)) * lengths[j]; 
        }
        K(i, i) = g * (n - i);
    }
}

void PendulumSystem::solve_modes() {
    // Solve standard eigenvalue problem: (M^-1 * K) x = lambda x
    Eigen::MatrixXd MinvK = M.inverse() * K;
    Eigen::EigenSolver<Eigen::MatrixXd> es(MinvK);
    
    // Some modes might be slightly complex due to numerical precision, we just take real part
    eigenvalues = es.eigenvalues().real();
    eigenvectors = es.eigenvectors().real();
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
