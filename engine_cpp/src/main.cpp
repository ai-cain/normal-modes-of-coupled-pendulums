#include "pendulum_system.hpp"
#include <iostream>
#include <string>

int main(int argc, char* argv[]) {
    int n = 4;
    double g = 9.8;
    std::vector<double> lengths;
    std::vector<double> masses;
    
    if (argc >= 2) n = std::stoi(argv[1]);
    if (argc >= 3) g = std::stod(argv[2]);
    
    for (int i = 0; i < n; ++i) {
        if (argc >= 4 + i) {
            lengths.push_back(std::stod(argv[3 + i]));
        } else {
            lengths.push_back(1.12 / n);
        }
    }

    for (int i = 0; i < n; ++i) {
        if (argc >= 4 + n + i) {
            masses.push_back(std::stod(argv[3 + n + i]));
        } else {
            masses.push_back(1.0);
        }
    }
    
    PendulumSystem sys(n, lengths, masses, g);
    sys.build_matrices();
    sys.solve_modes();
    
    std::cout << sys.to_json() << std::endl;
    
    return 0;
}
