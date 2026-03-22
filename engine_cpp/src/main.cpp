#include "pendulum_system.hpp"
#include <iostream>
#include <string>

int main(int argc, char* argv[]) {
    int n = 4;
    double L = 1.12;
    double g = 9.8;
    
    if (argc >= 2) n = std::stoi(argv[1]);
    if (argc >= 3) L = std::stod(argv[2]);
    if (argc >= 4) g = std::stod(argv[3]);
    
    PendulumSystem sys(n, L, g);
    sys.build_matrices();
    sys.solve_modes();
    
    std::cout << sys.to_json() << std::endl;
    
    return 0;
}
