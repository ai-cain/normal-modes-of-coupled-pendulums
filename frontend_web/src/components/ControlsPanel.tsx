import type { ReactNode } from 'react';
import type { DistributionMode, SimulationMode } from '../types';

interface ControlsPanelProps {
  simulationMode: SimulationMode;
  modeNote: string;
  isPlaying: boolean;
  isRecording: boolean;
  isRecordingSupported: boolean;
  isSocketReady: boolean;
  n: number;
  g: number;
  lengthMode: DistributionMode;
  massMode: DistributionMode;
  angleMode: DistributionMode;
  angleLimit: number;
  lengths: number[];
  masses: number[];
  initialAngles: number[];
  error: string;
  recordingError: string;
  onSimulationModeChange: (mode: SimulationMode) => void;
  onTogglePlay: () => void;
  onToggleRecording: () => void;
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
  valueLabel: string;
  value: number;
  min: number;
  max: number;
  step: number;
  inputDecimals?: number;
  onChange: (value: number) => void;
}

interface PanelSectionProps {
  eyebrow: string;
  title: string;
  description?: string;
  fullWidth?: boolean;
  children: ReactNode;
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
  valueLabel,
  value,
  min,
  max,
  step,
  inputDecimals = 2,
  onChange,
}: SliderFieldProps) => (
  <div className="slider-field">
    <div className="field-heading">
      <label>{label}</label>
      <span className="field-value">{valueLabel}</span>
    </div>
    <div className="field-controls">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(parseFloat(event.target.value))}
      />
      <input
        className="value-input"
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number(value.toFixed(inputDecimals))}
        onChange={(event) => {
          const nextValue = parseFloat(event.target.value);

          if (!Number.isNaN(nextValue)) {
            onChange(nextValue);
          }
        }}
      />
    </div>
  </div>
);

const PanelSection = ({
  eyebrow,
  title,
  description,
  fullWidth = false,
  children,
}: PanelSectionProps) => (
  <section className={`panel-section ${fullWidth ? 'full-width' : ''}`}>
    <div className="section-heading">
      <span className="section-eyebrow">{eyebrow}</span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
    </div>
    {children}
  </section>
);

const toDegrees = (angle: number) => (angle * 180) / Math.PI;
const toRadians = (angle: number) => (angle * Math.PI) / 180;
const formatAngle = (angleDegrees: number) => `${angleDegrees.toFixed(1)} deg`;

function ControlsPanel({
  simulationMode,
  modeNote,
  isPlaying,
  isRecording,
  isRecordingSupported,
  isSocketReady,
  n,
  g,
  lengthMode,
  massMode,
  angleMode,
  angleLimit,
  lengths,
  masses,
  initialAngles,
  error,
  recordingError,
  onSimulationModeChange,
  onTogglePlay,
  onToggleRecording,
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
  const hasSharedControls =
    lengthMode === 'equal' || massMode === 'equal' || angleMode === 'equal';
  const hasIndependentControls =
    lengthMode === 'independent' ||
    massMode === 'independent' ||
    angleMode === 'independent';
  const connectionLabel =
    simulationMode === 'linear'
      ? isSocketReady
        ? 'Solver ready'
        : 'Solver offline'
      : 'Browser';
  const angleLimitDegrees = toDegrees(angleLimit);

  return (
    <aside className="controls-panel card">
      <div className="panel-intro">
        <div>
          <span className="section-eyebrow">Controls</span>
          <h2>Setup</h2>
          <p>Mass, length and angle values stay visible while you edit.</p>
        </div>
        <span
          className={`connection-pill ${
            simulationMode === 'linear' && !isSocketReady ? 'warning' : 'success'
          }`}
        >
          {connectionLabel}
        </span>
      </div>

      <div className="panel-actions">
        <button type="button" onClick={onTogglePlay} className="btn-primary">
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button type="button" onClick={onReset} className="btn-secondary">
          Reset
        </button>
        <button
          type="button"
          onClick={onToggleRecording}
          className={isRecording ? 'btn-stop' : 'btn-record'}
          disabled={!isRecordingSupported}
        >
          {isRecording ? 'Stop' : 'Record'}
        </button>
      </div>

      <div className="panel-scroll">
        <PanelSection eyebrow="Dynamics" title="Model">
          <ToggleGroup
            label="Dynamics"
            value={simulationMode}
            onChange={onSimulationModeChange}
            options={[
              { value: 'nonlinear', label: 'Nonlinear Sandbox' },
              { value: 'linear', label: 'Linear Modes' },
            ]}
          />
          <div className="model-note">{modeNote}</div>
        </PanelSection>

        <PanelSection eyebrow="System" title="Global values">
          <SliderField
            label="Pendulums"
            valueLabel={`${n}`}
            value={n}
            min={1}
            max={10}
            step={1}
            inputDecimals={0}
            onChange={onNChange}
          />

          <SliderField
            label="Gravity"
            valueLabel={`${g.toFixed(2)} m/s^2`}
            value={g}
            min={1}
            max={25}
            step={0.1}
            inputDecimals={2}
            onChange={onGravityChange}
          />
        </PanelSection>

        <PanelSection eyebrow="Structure" title="Distribution">
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
        </PanelSection>

        {hasSharedControls && (
          <PanelSection eyebrow="Shared" title="Shared values" fullWidth>
            {angleMode === 'equal' && (
              <SliderField
                label="Initial angle"
                valueLabel={formatAngle(toDegrees(initialAngles[0] ?? 0))}
                value={toDegrees(initialAngles[0] ?? 0)}
                min={-angleLimitDegrees}
                max={angleLimitDegrees}
                step={0.5}
                inputDecimals={1}
                onChange={(value) => onSharedAngleChange(toRadians(value))}
              />
            )}

            {lengthMode === 'equal' && (
              <SliderField
                label="Segment length"
                valueLabel={`${(lengths[0] ?? 0).toFixed(2)} m`}
                value={lengths[0] ?? 0}
                min={0.1}
                max={2}
                step={0.05}
                inputDecimals={2}
                onChange={onSharedLengthChange}
              />
            )}

            {massMode === 'equal' && (
              <SliderField
                label="Mass"
                valueLabel={`${(masses[0] ?? 0).toFixed(2)} kg`}
                value={masses[0] ?? 0}
                min={0.2}
                max={5}
                step={0.05}
                inputDecimals={2}
                onChange={onSharedMassChange}
              />
            )}
          </PanelSection>
        )}

        {hasIndependentControls && (
          <PanelSection eyebrow="Per pendulum" title="Fine tuning" fullWidth>
            <div className="pendulum-grid">
              {Array.from({ length: n }, (_, index) => (
                <div key={index} className="pendulum-config">
                  <div className="pendulum-heading">
                    <h4>Pendulum {index + 1}</h4>
                    <span>#{index + 1}</span>
                  </div>

                  {angleMode === 'independent' && (
                    <SliderField
                      label="Initial angle"
                      valueLabel={formatAngle(toDegrees(initialAngles[index] ?? 0))}
                      value={toDegrees(initialAngles[index] ?? 0)}
                      min={-angleLimitDegrees}
                      max={angleLimitDegrees}
                      step={0.5}
                      inputDecimals={1}
                      onChange={(value) => onAngleChange(index, toRadians(value))}
                    />
                  )}

                  {lengthMode === 'independent' && (
                    <SliderField
                      label="Segment length"
                      valueLabel={`${(lengths[index] ?? 0).toFixed(2)} m`}
                      value={lengths[index] ?? 0}
                      min={0.1}
                      max={2}
                      step={0.05}
                      inputDecimals={2}
                      onChange={(value) => onLengthChange(index, value)}
                    />
                  )}

                  {massMode === 'independent' && (
                    <SliderField
                      label="Mass"
                      valueLabel={`${(masses[index] ?? 0).toFixed(2)} kg`}
                      value={masses[index] ?? 0}
                      min={0.2}
                      max={5}
                      step={0.05}
                      inputDecimals={2}
                      onChange={(value) => onMassChange(index, value)}
                    />
                  )}
                </div>
              ))}
            </div>
          </PanelSection>
        )}

        {recordingError && <div className="error full-width">{recordingError}</div>}
        {error && <div className="error full-width">{error}</div>}
      </div>
    </aside>
  );
}

export default ControlsPanel;
