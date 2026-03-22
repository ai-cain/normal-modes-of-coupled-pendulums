cmake_minimum_required(VERSION 3.14)
project(CoupledPendulumEngine VERSION 1.0)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED True)

# We include the previously downloaded Eigen3 library directly
include_directories(build/_deps/eigen-src)

add_executable(pendulum_cli src/main.cpp src/pendulum_system.cpp)
