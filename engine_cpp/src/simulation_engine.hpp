#ifndef SIMULATION_ENGINE_HPP
#define SIMULATION_ENGINE_HPP

#include <atomic>
#include <functional>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

struct Point2D {
    double x;
    double y;
};

struct EngineConfig {
    std::string mode;
    int n;
    double g;
    std::vector<double> lengths;
    std::vector<double> masses;
    std::vector<double> initial_angles;
};

class SimulationEngine {
public:
    using EmitFn = std::function<void(const std::string&)>;

    explicit SimulationEngine(EmitFn emit_fn);
    ~SimulationEngine();

    void start();
    void stop();
    void handle_command(const std::string& line);

private:
    EmitFn emit_fn_;
    std::atomic<bool> running_{false};
    std::thread simulation_thread_;

    mutable std::mutex state_mutex_;

    EngineConfig config_;
    bool playing_{false};
    bool dirty_{true};
    int revision_{0};
    double current_time_{0.0};

    std::vector<double> current_angles_;
    std::vector<double> current_velocities_;
    std::vector<Point2D> current_positions_;

    std::vector<double> frequencies_;
    std::vector<std::vector<double>> modal_shapes_;
    std::vector<std::vector<double>> inverse_modal_shapes_;
    std::vector<double> modal_coefficients_;

    void simulation_loop();
    void apply_config_locked(const EngineConfig& next_config);
    void reset_locked();
    void advance_locked(double dt);
    void update_linear_state_locked();
    void update_positions_locked();
    void rebuild_linear_cache_locked();

    void emit_ready() const;
    void emit_error(const std::string& message) const;
    void emit_state() const;
};

#endif
