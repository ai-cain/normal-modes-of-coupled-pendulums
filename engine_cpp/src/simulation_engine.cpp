#include "simulation_engine.hpp"

#include "pendulum_system.hpp"

#include <algorithm>
#include <chrono>
#include <cmath>
#include <iomanip>
#include <sstream>
#include <stdexcept>
#include <string>
#include <thread>

namespace {

constexpr double TOTAL_DEFAULT_LENGTH = 1.12;
constexpr double DEFAULT_GRAVITY = 9.8;
constexpr double DEFAULT_MASS = 1.0;
constexpr double DEFAULT_INITIAL_ANGLE = 0.6;
constexpr double LINEAR_ANGLE_LIMIT = 0.35;
constexpr double NONLINEAR_ANGLE_LIMIT = 2.8;
constexpr double MAX_SUBSTEP = 1.0 / 240.0;
constexpr int INITIAL_N = 2;
constexpr double LOOP_DT_SECONDS = 1.0 / 60.0;
constexpr double PI = 3.14159265358979323846;

struct StateDerivative {
    std::vector<double> angle_rates;
    std::vector<double> velocity_rates;
};

struct EngineSnapshot {
    std::string mode;
    int revision;
    int n;
    double g;
    double time;
    bool playing;
    std::vector<double> lengths;
    std::vector<double> masses;
    std::vector<double> initial_angles;
    std::vector<double> angles;
    std::vector<double> velocities;
    std::vector<Point2D> positions;
    std::vector<double> frequencies;
};

std::vector<std::string> split_string(const std::string& value, char delimiter) {
    std::vector<std::string> parts;
    std::stringstream ss(value);
    std::string token;

    while (std::getline(ss, token, delimiter)) {
        parts.push_back(token);
    }

    return parts;
}

bool parse_bool_token(const std::string& token) {
    return token == "1" || token == "true" || token == "TRUE" || token == "True";
}

std::string escape_json(const std::string& value) {
    std::string escaped;
    escaped.reserve(value.size());

    for (char ch : value) {
        switch (ch) {
            case '\\':
                escaped += "\\\\";
                break;
            case '"':
                escaped += "\\\"";
                break;
            case '\n':
                escaped += "\\n";
                break;
            default:
                escaped += ch;
                break;
        }
    }

    return escaped;
}

double clamp_value(double value, double min_value, double max_value) {
    return std::min(max_value, std::max(min_value, value));
}

double wrap_angle(double angle) {
    const double period = PI * 2.0;
    double wrapped = std::fmod(angle + PI, period);

    if (wrapped < 0.0) {
        wrapped += period;
    }

    return wrapped - PI;
}

std::vector<double> build_default_lengths(int count) {
    if (count == INITIAL_N) {
        return {0.46, 0.76};
    }

    return std::vector<double>(count, TOTAL_DEFAULT_LENGTH / std::max(count, 1));
}

std::vector<double> build_default_masses(int count) {
    if (count == INITIAL_N) {
        return {1.35, 0.8};
    }

    return std::vector<double>(count, DEFAULT_MASS);
}

std::vector<double> build_default_angles(int count) {
    if (count == INITIAL_N) {
        return {0.95, -0.35};
    }

    std::vector<double> values(count, 0.0);
    if (!values.empty()) {
        values[0] = DEFAULT_INITIAL_ANGLE;
    }
    return values;
}

std::vector<double> sanitize_series(
    const std::vector<double>& values,
    int count,
    const std::vector<double>& defaults
) {
    std::vector<double> sanitized;
    sanitized.reserve(count);

    for (int index = 0; index < count; ++index) {
        sanitized.push_back(index < static_cast<int>(values.size()) ? values[index] : defaults[index]);
    }

    return sanitized;
}

bool nearly_equal(double left, double right, double epsilon = 1e-12) {
    return std::abs(left - right) <= epsilon;
}

bool equal_series(const std::vector<double>& left, const std::vector<double>& right) {
    if (left.size() != right.size()) {
        return false;
    }

    for (std::size_t index = 0; index < left.size(); ++index) {
        if (!nearly_equal(left[index], right[index])) {
            return false;
        }
    }

    return true;
}

std::vector<double> parse_number_list(const std::string& token) {
    std::vector<double> values;

    if (token.empty()) {
        return values;
    }

    for (const std::string& part : split_string(token, ',')) {
        if (!part.empty()) {
            values.push_back(std::stod(part));
        }
    }

    return values;
}

std::string serialize_numbers(const std::vector<double>& values) {
    std::ostringstream ss;
    ss << "[";

    for (std::size_t index = 0; index < values.size(); ++index) {
        ss << values[index];
        if (index + 1 < values.size()) {
            ss << ",";
        }
    }

    ss << "]";
    return ss.str();
}

std::string serialize_points(const std::vector<Point2D>& values) {
    std::ostringstream ss;
    ss << "[";

    for (std::size_t index = 0; index < values.size(); ++index) {
        ss << "{\"x\":" << values[index].x << ",\"y\":" << values[index].y << "}";
        if (index + 1 < values.size()) {
            ss << ",";
        }
    }

    ss << "]";
    return ss.str();
}

std::vector<double> build_suffix_masses(const std::vector<double>& masses) {
    std::vector<double> suffix(masses.size(), 0.0);

    for (int index = static_cast<int>(masses.size()) - 1; index >= 0; --index) {
        suffix[index] = masses[index] + (index + 1 < static_cast<int>(suffix.size()) ? suffix[index + 1] : 0.0);
    }

    return suffix;
}

std::vector<double> solve_linear_system(
    const std::vector<std::vector<double>>& matrix,
    const std::vector<double>& rhs
) {
    const int size = static_cast<int>(rhs.size());
    std::vector<std::vector<double>> a = matrix;
    std::vector<double> b = rhs;

    for (int col = 0; col < size; ++col) {
        int pivot_row = col;

        for (int row = col + 1; row < size; ++row) {
            if (std::abs(a[row][col]) > std::abs(a[pivot_row][col])) {
                pivot_row = row;
            }
        }

        if (std::abs(a[pivot_row][col]) < 1e-10) {
            return std::vector<double>(size, 0.0);
        }

        if (pivot_row != col) {
            std::swap(a[col], a[pivot_row]);
            std::swap(b[col], b[pivot_row]);
        }

        for (int row = col + 1; row < size; ++row) {
            const double factor = a[row][col] / a[col][col];

            for (int inner = col; inner < size; ++inner) {
                a[row][inner] -= factor * a[col][inner];
            }

            b[row] -= factor * b[col];
        }
    }

    std::vector<double> solution(size, 0.0);

    for (int row = size - 1; row >= 0; --row) {
        double sum = b[row];

        for (int col = row + 1; col < size; ++col) {
            sum -= a[row][col] * solution[col];
        }

        solution[row] = sum / a[row][row];
    }

    return solution;
}

std::vector<double> compute_nonlinear_accelerations(
    const std::vector<double>& angles,
    const std::vector<double>& velocities,
    const std::vector<double>& lengths,
    const std::vector<double>& masses,
    double gravity
) {
    const int n = static_cast<int>(angles.size());
    const std::vector<double> suffix_masses = build_suffix_masses(masses);
    std::vector<std::vector<double>> system_matrix(n, std::vector<double>(n, 0.0));
    std::vector<double> rhs(n, 0.0);

    for (int i = 0; i < n; ++i) {
        rhs[i] = -suffix_masses[i] * gravity * std::sin(angles[i]);

        for (int j = 0; j < n; ++j) {
            const double mass_from_max = suffix_masses[std::max(i, j)];
            const double delta = angles[i] - angles[j];

            system_matrix[i][j] = mass_from_max * lengths[j] * std::cos(delta);
            rhs[i] -= mass_from_max * lengths[j] * std::sin(delta) * velocities[j] * velocities[j];
        }
    }

    return solve_linear_system(system_matrix, rhs);
}

StateDerivative evaluate_derivative(
    const std::vector<double>& angles,
    const std::vector<double>& velocities,
    const std::vector<double>& lengths,
    const std::vector<double>& masses,
    double gravity
) {
    return {
        velocities,
        compute_nonlinear_accelerations(angles, velocities, lengths, masses, gravity),
    };
}

std::vector<double> add_scaled(
    const std::vector<double>& base,
    const std::vector<double>& delta,
    double factor
) {
    std::vector<double> result(base.size(), 0.0);

    for (std::size_t index = 0; index < base.size(); ++index) {
        result[index] = base[index] + factor * delta[index];
    }

    return result;
}

std::vector<Point2D> compute_chain_positions(
    const std::vector<double>& angles,
    const std::vector<double>& lengths
) {
    double current_x = 0.0;
    double current_y = 0.0;
    std::vector<Point2D> positions;
    positions.reserve(angles.size());

    for (std::size_t index = 0; index < angles.size(); ++index) {
        current_x += lengths[index] * std::sin(angles[index]);
        current_y += lengths[index] * std::cos(angles[index]);
        positions.push_back({current_x, current_y});
    }

    return positions;
}

std::vector<std::vector<double>> matrix_to_vectors(const Eigen::MatrixXd& matrix) {
    std::vector<std::vector<double>> values(
        static_cast<std::size_t>(matrix.rows()),
        std::vector<double>(static_cast<std::size_t>(matrix.cols()), 0.0)
    );

    for (int row = 0; row < matrix.rows(); ++row) {
        for (int col = 0; col < matrix.cols(); ++col) {
            values[static_cast<std::size_t>(row)][static_cast<std::size_t>(col)] = matrix(row, col);
        }
    }

    return values;
}

std::vector<double> vector_to_std(const Eigen::VectorXd& vector) {
    std::vector<double> values(static_cast<std::size_t>(vector.size()), 0.0);

    for (int index = 0; index < vector.size(); ++index) {
        values[static_cast<std::size_t>(index)] = vector(index);
    }

    return values;
}

EngineConfig sanitize_config(const EngineConfig& raw_config) {
    const int count = std::max(raw_config.n, 1);
    const std::vector<double> default_lengths = build_default_lengths(count);
    const std::vector<double> default_masses = build_default_masses(count);
    std::vector<double> default_angles = build_default_angles(count);

    EngineConfig config;
    config.mode = raw_config.mode == "linear" ? "linear" : "nonlinear";
    config.n = count;
    config.g = raw_config.g > 0.0 ? raw_config.g : DEFAULT_GRAVITY;
    config.lengths = sanitize_series(raw_config.lengths, count, default_lengths);
    config.masses = sanitize_series(raw_config.masses, count, default_masses);
    config.initial_angles = sanitize_series(raw_config.initial_angles, count, default_angles);

    const double angle_limit = config.mode == "linear" ? LINEAR_ANGLE_LIMIT : NONLINEAR_ANGLE_LIMIT;
    for (double& angle : config.initial_angles) {
        angle = clamp_value(angle, -angle_limit, angle_limit);
    }

    return config;
}

bool configs_match(const EngineConfig& left, const EngineConfig& right) {
    return left.mode == right.mode &&
           left.n == right.n &&
           nearly_equal(left.g, right.g) &&
           equal_series(left.lengths, right.lengths) &&
           equal_series(left.masses, right.masses) &&
           equal_series(left.initial_angles, right.initial_angles);
}

std::string serialize_state_json(const EngineSnapshot& snapshot) {
    std::ostringstream ss;
    ss << std::fixed << std::setprecision(6);
    ss << "{\"type\":\"state\",\"data\":{";
    ss << "\"mode\":\"" << escape_json(snapshot.mode) << "\",";
    ss << "\"revision\":" << snapshot.revision << ",";
    ss << "\"n\":" << snapshot.n << ",";
    ss << "\"g\":" << snapshot.g << ",";
    ss << "\"time\":" << snapshot.time << ",";
    ss << "\"playing\":" << (snapshot.playing ? "true" : "false") << ",";
    ss << "\"lengths\":" << serialize_numbers(snapshot.lengths) << ",";
    ss << "\"masses\":" << serialize_numbers(snapshot.masses) << ",";
    ss << "\"initial_angles\":" << serialize_numbers(snapshot.initial_angles) << ",";
    ss << "\"angles\":" << serialize_numbers(snapshot.angles) << ",";
    ss << "\"velocities\":" << serialize_numbers(snapshot.velocities) << ",";
    ss << "\"positions\":" << serialize_points(snapshot.positions) << ",";
    ss << "\"frequencies\":" << serialize_numbers(snapshot.frequencies);
    ss << "}}";
    return ss.str();
}

} // namespace

SimulationEngine::SimulationEngine(EmitFn emit_fn)
    : emit_fn_(std::move(emit_fn)) {
    EngineConfig defaults;
    defaults.mode = "nonlinear";
    defaults.n = INITIAL_N;
    defaults.g = DEFAULT_GRAVITY;
    defaults.lengths = build_default_lengths(INITIAL_N);
    defaults.masses = build_default_masses(INITIAL_N);
    defaults.initial_angles = build_default_angles(INITIAL_N);

    std::lock_guard<std::mutex> lock(state_mutex_);
    apply_config_locked(defaults);
}

SimulationEngine::~SimulationEngine() {
    stop();
}

void SimulationEngine::start() {
    if (running_.exchange(true)) {
        return;
    }

    simulation_thread_ = std::thread(&SimulationEngine::simulation_loop, this);
    emit_ready();
    emit_state();
}

void SimulationEngine::stop() {
    if (!running_.exchange(false)) {
        return;
    }

    if (simulation_thread_.joinable()) {
        simulation_thread_.join();
    }
}

void SimulationEngine::handle_command(const std::string& line) {
    if (line.empty()) {
        return;
    }

    try {
        const std::vector<std::string> parts = split_string(line, '\t');
        if (parts.empty()) {
            return;
        }

        const std::string& command = parts[0];

        if (command == "CONFIG") {
            if (parts.size() < 8) {
                throw std::runtime_error("CONFIG command requires 7 arguments.");
            }

            EngineConfig next_config;
            next_config.mode = parts[1];
            next_config.n = std::stoi(parts[2]);
            next_config.g = std::stod(parts[3]);
            next_config.lengths = parse_number_list(parts[4]);
            next_config.masses = parse_number_list(parts[5]);
            next_config.initial_angles = parse_number_list(parts[6]);
            const bool next_playing = parse_bool_token(parts[7]);

            {
                std::lock_guard<std::mutex> lock(state_mutex_);
                const EngineConfig sanitized_next = sanitize_config(next_config);
                const bool config_changed = !configs_match(config_, sanitized_next);
                const bool playing_changed = playing_ != next_playing;

                if (config_changed) {
                    config_ = sanitized_next;
                    ++revision_;
                    current_time_ = 0.0;
                    current_angles_ = config_.initial_angles;
                    current_velocities_.assign(static_cast<std::size_t>(config_.n), 0.0);
                    rebuild_linear_cache_locked();
                    update_positions_locked();
                }

                if (playing_changed) {
                    playing_ = next_playing;
                }

                if (config_changed || playing_changed) {
                    dirty_ = true;
                }
            }

            emit_state();
            return;
        }

        if (command == "PLAY") {
            if (parts.size() < 2) {
                throw std::runtime_error("PLAY command requires a boolean value.");
            }

            {
                std::lock_guard<std::mutex> lock(state_mutex_);
                playing_ = parse_bool_token(parts[1]);
                dirty_ = true;
            }

            emit_state();
            return;
        }

        if (command == "RESET") {
            {
                std::lock_guard<std::mutex> lock(state_mutex_);
                reset_locked();
                dirty_ = true;
            }

            emit_state();
            return;
        }

        if (command == "REQUEST_STATE") {
            emit_state();
            return;
        }

        throw std::runtime_error("Unknown engine command: " + command);
    } catch (const std::exception& error) {
        emit_error(error.what());
    }
}

void SimulationEngine::simulation_loop() {
    using clock = std::chrono::steady_clock;

    auto previous = clock::now();

    while (running_) {
        const auto now = clock::now();
        const double dt = std::chrono::duration<double>(now - previous).count();
        previous = now;

        bool should_emit = false;

        {
            std::lock_guard<std::mutex> lock(state_mutex_);

            if (playing_) {
                advance_locked(dt);
                dirty_ = false;
                should_emit = true;
            } else if (dirty_) {
                dirty_ = false;
                should_emit = true;
            }
        }

        if (should_emit) {
            emit_state();
        }

        std::this_thread::sleep_for(std::chrono::duration<double>(LOOP_DT_SECONDS));
    }
}

void SimulationEngine::apply_config_locked(const EngineConfig& next_config) {
    config_ = sanitize_config(next_config);
    ++revision_;
    current_time_ = 0.0;
    current_angles_ = config_.initial_angles;
    current_velocities_.assign(static_cast<std::size_t>(config_.n), 0.0);
    rebuild_linear_cache_locked();
    update_positions_locked();
}

void SimulationEngine::reset_locked() {
    current_time_ = 0.0;
    current_angles_ = config_.initial_angles;
    current_velocities_.assign(static_cast<std::size_t>(config_.n), 0.0);
    rebuild_linear_cache_locked();
    update_positions_locked();
}

void SimulationEngine::advance_locked(double dt) {
    if (dt <= 0.0) {
        return;
    }

    if (config_.mode == "linear") {
        current_time_ += dt;
        update_linear_state_locked();
        return;
    }

    double remaining = dt;

    while (remaining > 1e-8) {
        const double step_dt = std::min(MAX_SUBSTEP, remaining);

        const StateDerivative k1 = evaluate_derivative(
            current_angles_,
            current_velocities_,
            config_.lengths,
            config_.masses,
            config_.g
        );
        const StateDerivative k2 = evaluate_derivative(
            add_scaled(current_angles_, k1.angle_rates, 0.5 * step_dt),
            add_scaled(current_velocities_, k1.velocity_rates, 0.5 * step_dt),
            config_.lengths,
            config_.masses,
            config_.g
        );
        const StateDerivative k3 = evaluate_derivative(
            add_scaled(current_angles_, k2.angle_rates, 0.5 * step_dt),
            add_scaled(current_velocities_, k2.velocity_rates, 0.5 * step_dt),
            config_.lengths,
            config_.masses,
            config_.g
        );
        const StateDerivative k4 = evaluate_derivative(
            add_scaled(current_angles_, k3.angle_rates, step_dt),
            add_scaled(current_velocities_, k3.velocity_rates, step_dt),
            config_.lengths,
            config_.masses,
            config_.g
        );

        for (std::size_t index = 0; index < current_angles_.size(); ++index) {
            current_angles_[index] = wrap_angle(
                current_angles_[index] +
                (step_dt / 6.0) *
                    (k1.angle_rates[index] +
                     2.0 * k2.angle_rates[index] +
                     2.0 * k3.angle_rates[index] +
                     k4.angle_rates[index])
            );
            current_velocities_[index] +=
                (step_dt / 6.0) *
                (k1.velocity_rates[index] +
                 2.0 * k2.velocity_rates[index] +
                 2.0 * k3.velocity_rates[index] +
                 k4.velocity_rates[index]);
        }

        remaining -= step_dt;
    }

    current_time_ += dt;
    update_positions_locked();
}

void SimulationEngine::update_linear_state_locked() {
    current_angles_.assign(static_cast<std::size_t>(config_.n), 0.0);
    current_velocities_.assign(static_cast<std::size_t>(config_.n), 0.0);

    for (int coordinate = 0; coordinate < config_.n; ++coordinate) {
        double angle_sum = 0.0;
        double velocity_sum = 0.0;

        for (int mode_index = 0; mode_index < config_.n; ++mode_index) {
            const double frequency = mode_index < static_cast<int>(frequencies_.size()) ? frequencies_[mode_index] : 0.0;
            const double modal_value =
                coordinate < static_cast<int>(modal_shapes_.size()) &&
                        mode_index < static_cast<int>(modal_shapes_[coordinate].size())
                    ? modal_shapes_[coordinate][mode_index]
                    : 0.0;
            const double coefficient =
                mode_index < static_cast<int>(modal_coefficients_.size()) ? modal_coefficients_[mode_index] : 0.0;

            angle_sum += coefficient * modal_value * std::cos(frequency * current_time_);
            velocity_sum -= coefficient * modal_value * frequency * std::sin(frequency * current_time_);
        }

        current_angles_[static_cast<std::size_t>(coordinate)] = angle_sum;
        current_velocities_[static_cast<std::size_t>(coordinate)] = velocity_sum;
    }

    update_positions_locked();
}

void SimulationEngine::update_positions_locked() {
    current_positions_ = compute_chain_positions(current_angles_, config_.lengths);
}

void SimulationEngine::rebuild_linear_cache_locked() {
    frequencies_.clear();
    modal_shapes_.clear();
    inverse_modal_shapes_.clear();
    modal_coefficients_.clear();

    if (config_.mode != "linear") {
        return;
    }

    PendulumSystem system(config_.n, config_.lengths, config_.masses, config_.g);
    system.build_matrices();
    system.solve_modes();

    frequencies_ = vector_to_std(system.eigenvalues);
    for (double& value : frequencies_) {
        value = std::sqrt(value > 0.0 ? value : 0.0);
    }

    modal_shapes_ = matrix_to_vectors(system.eigenvectors);
    inverse_modal_shapes_ = matrix_to_vectors(system.inverse_eigenvectors);
    modal_coefficients_.assign(static_cast<std::size_t>(config_.n), 0.0);

    for (int mode_index = 0; mode_index < config_.n; ++mode_index) {
        double coefficient = 0.0;

        for (int coordinate = 0; coordinate < config_.n; ++coordinate) {
            coefficient +=
                inverse_modal_shapes_[static_cast<std::size_t>(mode_index)][static_cast<std::size_t>(coordinate)] *
                config_.initial_angles[static_cast<std::size_t>(coordinate)];
        }

        modal_coefficients_[static_cast<std::size_t>(mode_index)] = coefficient;
    }
}

void SimulationEngine::emit_ready() const {
    if (emit_fn_) {
        emit_fn_("{\"type\":\"ready\"}");
    }
}

void SimulationEngine::emit_error(const std::string& message) const {
    if (!emit_fn_) {
        return;
    }

    emit_fn_(
        std::string("{\"type\":\"error\",\"message\":\"") + escape_json(message) + "\"}"
    );
}

void SimulationEngine::emit_state() const {
    EngineSnapshot snapshot;

    {
        std::lock_guard<std::mutex> lock(state_mutex_);
        snapshot.mode = config_.mode;
        snapshot.revision = revision_;
        snapshot.n = config_.n;
        snapshot.g = config_.g;
        snapshot.time = current_time_;
        snapshot.playing = playing_;
        snapshot.lengths = config_.lengths;
        snapshot.masses = config_.masses;
        snapshot.initial_angles = config_.initial_angles;
        snapshot.angles = current_angles_;
        snapshot.velocities = current_velocities_;
        snapshot.positions = current_positions_;
        snapshot.frequencies = frequencies_;
    }

    if (emit_fn_) {
        emit_fn_(serialize_state_json(snapshot));
    }
}
