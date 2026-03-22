import type { DistributionMode, SimulationMode } from '../types';

interface ControlsPanelProps {
  simulationMode: SimulationMode;
  modeNote: string;
  isPlaying: boolean;
  n: number;
  g: number;
  lengthMode: DistributionMode;
  massMode: DistributionMode;
  angleMode: DistributionMode;
  angleLimit: number;
  lengths: number[];
  masses: number[];
  initialAngles: number[];
  hasSharedControls: boolean;
  hasIndependentControls: boolean;
  error: string;
  onSimulationModeChange: (mode: SimulationMode) => void;
  onTogglePlay: () => void;
  onReset: () => void;
  onNChange: (value: number) => void;
  onGravityChange: (value: number) => void;
  onLengthModeChange: (mode: DistributionMode) => void;
  onMassModeChange: (mode: DistributionMode) => void;
  onAngleModeChange: (mode: DistributionMode) => void;
  onSharedAngleChange: (value: number) => void;
  onSharedLengthChange: (value: number) => void;
  onSharedMassChange: (value: number) => void;
  onAngleChange: (index: number, value: number) => void;
  onLengthChange: (index: number, value: number) => void;
  onMassChange: (index: number, value: number) => void;
}

interface ToggleGroupProps<T extends string> {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

const ToggleGroup = <T extends string>({
  label,
  value,
  onChange,
  options,
}: ToggleGroupProps<T>) => (
  <div className="toggle-block">
    <span className="toggle-label">{label}</span>
    <div className="toggle-row">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`toggle-button ${value === option.value ? 'active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  </div>
);

const SliderField = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: SliderFieldProps) => (
  <div className="control-group small">
    <label>{label}</label>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(parseFloat(event.target.value))}
    />
  </div>
);

const formatAngle = (angle: number) => `${((angle * 180) / Math.PI).toFixed(1)} deg`;

function ControlsPanel({
  simulationMode,
  modeNote,
  isPlaying,
  n,
  g,
  lengthMode,
  massMode,
  angleMode,
  angleLimit,
  lengths,
  masses,
  initialAngles,
  hasSharedControls,
  hasIndependentControls,
  error,
  onSimulationModeChange,
  onTogglePlay,
  onReset,
  onNChange,
  onGravityChange,
  onLengthModeChange,
  onMassModeChange,
  onAngleModeChange,
  onSharedAngleChange,
  onSharedLengthChange,
  onSharedMassChange,
  onAngleChange,
  onLengthChange,
  onMassChange,
}: ControlsPanelProps) {
  return (
    <div className="controls-panel card">
      <div className="controls-toolbar">
        <h2>Simulation Controls</h2>

        <ToggleGroup
          label="Dynamics"
          value={simulationMode}
          onChange={onSimulationModeChange}
          options={[
            { value: 'nonlinear', label: 'Nonlinear Sandbox' },
            { value: 'linear', label: 'Linear Modes' },
          ]}
        />

        <div className="playback-controls">
          <button type="button" onClick={onTogglePlay} className="btn-primary">
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button type="button" onClick={onReset} className="btn-secondary">
            Reset t = 0
          </button>
        </div>
      </div>

      <div className="controls-body">
        <div className="model-note">{modeNote}</div>

        <div className="control-group">
          <label>N (Number of Pendulums): {n}</label>
          <input
            type="range"
            min="1"
            max="10"
            value={n}
            onChange={(event) => onNChange(parseInt(event.target.value, 10))}
          />
        </div>

        <div className="control-group">
          <label>Gravity (g): {g.toFixed(2)} m/s^2</label>
          <input
            type="range"
            min="1.0"
            max="25.0"
            step="0.1"
            value={g}
            onChange={(event) => onGravityChange(parseFloat(event.target.value))}
          />
        </div>

        <div className="toggle-grid">
          <ToggleGroup
            label="Lengths"
            value={lengthMode}
            onChange={onLengthModeChange}
            options={[
              { value: 'equal', label: 'Equal' },
              { value: 'independent', label: 'Unequal' },
            ]}
          />

          <ToggleGroup
            label="Masses"
            value={massMode}
            onChange={onMassModeChange}
            options={[
              { value: 'equal', label: 'Equal' },
              { value: 'independent', label: 'Unequal' },
            ]}
          />

          <ToggleGroup
            label="Angles"
            value={angleMode}
            onChange={onAngleModeChange}
            options={[
              { value: 'equal', label: 'Equal' },
              { value: 'independent', label: 'Unequal' },
            ]}
          />
        </div>

        {hasSharedControls && (
          <div className="shared-panel">
            <h3>Shared Controls</h3>

            {angleMode === 'equal' && (
              <SliderField
                label={`Shared Initial Angle: ${formatAngle(initialAngles[0] ?? 0)}`}
                value={initialAngles[0] ?? 0}
                min={-angleLimit}
                max={angleLimit}
                step={0.01}
                onChange={onSharedAngleChange}
              />
            )}

            {lengthMode === 'equal' && (
              <SliderField
                label={`Shared Segment Length: ${(lengths[0] ?? 0).toFixed(2)} m`}
                value={lengths[0] ?? 0}
                min={0.1}
                max={2.0}
                step={0.05}
                onChange={onSharedLengthChange}
              />
            )}

            {massMode === 'equal' && (
              <SliderField
                label={`Shared Mass: ${(masses[0] ?? 0).toFixed(2)} kg`}
                value={masses[0] ?? 0}
                min={0.2}
                max={5.0}
                step={0.05}
                onChange={onSharedMassChange}
              />
            )}
          </div>
        )}

        {hasIndependentControls && (
          <div className="scroll-panel">
            <h3>Per-Pendulum Controls</h3>

            {Array.from({ length: n }, (_, index) => (
              <div key={index} className="pendulum-config">
                <h4>Pendulum {index + 1}</h4>

                {angleMode === 'independent' && (
                  <SliderField
                    label={`Initial Angle: ${formatAngle(initialAngles[index] ?? 0)}`}
                    value={initialAngles[index] ?? 0}
                    min={-angleLimit}
                    max={angleLimit}
                    step={0.01}
                    onChange={(value) => onAngleChange(index, value)}
                  />
                )}

                {lengthMode === 'independent' && (
                  <SliderField
                    label={`Segment Length: ${(lengths[index] ?? 0).toFixed(2)} m`}
                    value={lengths[index] ?? 0}
                    min={0.1}
                    max={2.0}
                    step={0.05}
                    onChange={(value) => onLengthChange(index, value)}
                  />
                )}

                {massMode === 'independent' && (
                  <SliderField
                    label={`Mass: ${(masses[index] ?? 0).toFixed(2)} kg`}
                    value={masses[index] ?? 0}
                    min={0.2}
                    max={5.0}
                    step={0.05}
                    onChange={(value) => onMassChange(index, value)}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {error && <div className="error">{error}</div>}
      </div>
    </div>
  );
}

export default ControlsPanel;
