#include "pendulum_system.hpp"
#include <Eigen/Eigenvalues>
#include <iostream>
#include <algorithm>

PendulumSystem::PendulumSystem(int num_pendulums, double L, double gravity) 
    : n(num_pendulums), total_length(L), g(gravity) {
    if (n < 1) n = 1;
}

void PendulumSystem::build_matrices() {
    M = Eigen::MatrixXd::Zero(n, n);
    K = Eigen::MatrixXd::Zero(n, n);
    
    double segment_length = total_length / n;
    double k_factor = g / segment_length;
    
    for (int i = 0; i < n; ++i) {
        for (int j = 0; j < n; ++j) {
            M(i, j) = n - std::max(i, j); 
        }
        K(i, i) = k_factor * (n - i);
    }
}

void PendulumSystem::solve_modes() {
    // Solve generalized eigenvalue problem: K x = lambda M x
    Eigen::GeneralizedSelfAdjointEigenSolver<Eigen::MatrixXd> es(K, M);
    
    eigenvalues = es.eigenvalues();
    eigenvectors = es.eigenvectors();
}

#include <sstream>
#include <iomanip>

std::string PendulumSystem::to_json() const {
    std::stringstream ss;
    ss << std::fixed << std::setprecision(6);
    ss << "{\n";
    ss << "  \"n\": " << n << ",\n";
    ss << "  \"total_length\": " << total_length << ",\n";
    ss << "  \"g\": " << g << ",\n";
    
    // frequencies = sqrt(eigenvalues)
    ss << "  \"frequencies\": [";
    for(int i=0; i<n; ++i) {
        ss << std::sqrt(std::max(0.0, eigenvalues(i)));
        if (i < n - 1) ss << ", ";
    }
    ss << "],\n";
    
    // Modal shapes (columns are eigenvectors)
    // We normalize such that the first component is 1 for readability
    ss << "  \"modal_shapes\": [\n";
    for(int j_col=0; j_col<n; ++j_col) {
        ss << "    [";
        double a1 = eigenvectors(0, j_col);
        for(int i_row=0; i_row<n; ++i_row) {
            ss << (eigenvectors(i_row, j_col) / a1);
            if (i_row < n - 1) ss << ", ";
        }
        ss << "]";
        if (j_col < n - 1) ss << ",\n";
        else ss << "\n";
    }
    ss << "  ]\n";
    ss << "}\n";
    
    return ss.str();
}
