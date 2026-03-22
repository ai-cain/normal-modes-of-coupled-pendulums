#ifndef PENDULUM_SYSTEM_HPP
#define PENDULUM_SYSTEM_HPP

#include <Eigen/Dense>
#include <vector>
#include <string>

class PendulumSystem {
public:
    int n;
    double total_length;
    double g;
    
    Eigen::MatrixXd M;
    Eigen::MatrixXd K;
    
    Eigen::VectorXd eigenvalues; // Squared natural frequencies (omega^2)
    Eigen::MatrixXd eigenvectors; // Modal shapes
    
    PendulumSystem(int num_pendulums, double L = 1.12, double gravity = 9.8);
    
    void build_matrices();
    std::string to_json() const;
};

#endif
