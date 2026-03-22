#ifndef PENDULUM_SYSTEM_HPP
#define PENDULUM_SYSTEM_HPP

#include <Eigen/Dense>
#include <vector>
#include <string>

class PendulumSystem {
public:
    int n;
    std::vector<double> lengths;
    double g;
    
    Eigen::MatrixXd M;
    Eigen::MatrixXd K;
    
    Eigen::VectorXd eigenvalues; // Squared natural frequencies (omega^2)
    Eigen::MatrixXd eigenvectors; // Modal shapes
    Eigen::MatrixXd inverse_eigenvectors; // V^-1
    
    PendulumSystem(int num_pendulums, std::vector<double> L_array, double gravity = 9.8);
    
    void build_matrices();
    void solve_modes();
    std::string to_json() const;
};

#endif
