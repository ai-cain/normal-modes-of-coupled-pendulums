import { useEffect, useMemo, useRef, useState } from 'react';
import './index.css';

type SimulationMode = 'nonlinear' | 'linear';
type DistributionMode = 'equal' | 'independent';

interface SimulationData {
  n: number;
  lengths: number[];
  masses: number[];
  g: number;
  frequencies: number[];
  modal_shapes: number[][];
  inverse_modal_shapes: number[][];
}

interface BobPosition {
  x: number;
  y: number;
}

interface StateDerivative {
  angleRates: number[];
  velocityRates: number[];
}

interface NonlinearState {
  angles: number[];
  velocities: number[];
}

const INITIAL_N = 2;
const TOTAL_DEFAULT_LENGTH = 1.12;
const DEFAULT_MASS = 1.0;
const DEFAULT_INITIAL_ANGLE = 0.6;
const LINEAR_ANGLE_LIMIT = 0.35;
const NONLINEAR_ANGLE_LIMIT = 2.8;
const MAX_SUBSTEP = 1 / 240;
const MAX_TRAIL_POINTS = 180;
const DEFAULT_LENGTHS = [0.46, 0.76];
const DEFAULT_MASSES = [1.35, 0.8];
const DEFAULT_INITIAL_ANGLES = [0.95, -0.35];
const COLOR_PALETTE = [
  '125, 211, 252',
  '165, 180, 252',
  '244, 114, 182',
  '253, 186, 116',
  '134, 239, 172',
  '248, 113, 113',
  '196, 181, 253',
  '103, 232, 249',
  '250, 204, 21',
  '147, 197, 253',
];

const createFilledArray = (count: number, value: number) =>
  Array.from({ length: count }, () => value);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const wrapAngle = (angle: number) => {
  const period = Math.PI * 2;
  let wrapped = (angle + Math.PI) % period;

  if (wrapped < 0) {
    wrapped += period;
  }

  return wrapped - Math.PI;
};

const buildSuffixMasses = (masses: number[]) => {
  const suffix = new Array(masses.length).fill(0);

  for (let i = masses.length - 1; i >= 0; i -= 1) {
    suffix[i] = masses[i] + (suffix[i + 1] ?? 0);
  }

  return suffix;
};

const solveLinearSystem = (matrix: number[][], rhs: number[]) => {
  const size = rhs.length;
  const a = matrix.map((row) => [...row]);
  const b = [...rhs];

  for (let col = 0; col < size; col += 1) {
    let pivotRow = col;

    for (let row = col + 1; row < size; row += 1) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivotRow][col])) {
        pivotRow = row;
      }
    }

    if (Math.abs(a[pivotRow][col]) < 1e-10) {
      return new Array(size).fill(0);
    }

    if (pivotRow !== col) {
      [a[col], a[pivotRow]] = [a[pivotRow], a[col]];
      [b[col], b[pivotRow]] = [b[pivotRow], b[col]];
    }

    for (let row = col + 1; row < size; row += 1) {
      const factor = a[row][col] / a[col][col];

      for (let inner = col; inner < size; inner += 1) {
        a[row][inner] -= factor * a[col][inner];
      }

      b[row] -= factor * b[col];
    }
  }

  const solution = new Array(size).fill(0);

  for (let row = size - 1; row >= 0; row -= 1) {
    let sum = b[row];

    for (let col = row + 1; col < size; col += 1) {
      sum -= a[row][col] * solution[col];
    }

    solution[row] = sum / a[row][row];
  }

  return solution;
};

const computeNonlinearAccelerations = (
  angles: number[],
  velocities: number[],
  lengths: number[],
  masses: number[],
  gravity: number,
) => {
  const n = angles.length;
  const suffixMasses = buildSuffixMasses(masses);
  const systemMatrix = Array.from({ length: n }, () => new Array(n).fill(0));
  const rhs = new Array(n).fill(0);

  for (let i = 0; i < n; i += 1) {
    rhs[i] = -suffixMasses[i] * gravity * Math.sin(angles[i]);

    for (let j = 0; j < n; j += 1) {
      const massFromMax = suffixMasses[Math.max(i, j)];
      const delta = angles[i] - angles[j];

      systemMatrix[i][j] = massFromMax * lengths[j] * Math.cos(delta);
      rhs[i] -= massFromMax * lengths[j] * Math.sin(delta) * velocities[j] * velocities[j];
    }
  }

  return solveLinearSystem(systemMatrix, rhs);
};

const evaluateDerivative = (
  angles: number[],
  velocities: number[],
  lengths: number[],
  masses: number[],
  gravity: number,
): StateDerivative => ({
  angleRates: [...velocities],
  velocityRates: computeNonlinearAccelerations(angles, velocities, lengths, masses, gravity),
});

const rk4Step = (
  angles: number[],
  velocities: number[],
  dt: number,
  lengths: number[],
  masses: number[],
  gravity: number,
): NonlinearState => {
  const addScaled = (base: number[], delta: number[], factor: number) =>
    base.map((value, index) => value + factor * delta[index]);

  const k1 = evaluateDerivative(angles, velocities, lengths, masses, gravity);
  const k2 = evaluateDerivative(
    addScaled(angles, k1.angleRates, 0.5 * dt),
    addScaled(velocities, k1.velocityRates, 0.5 * dt),
    lengths,
    masses,
    gravity,
  );
  const k3 = evaluateDerivative(
    addScaled(angles, k2.angleRates, 0.5 * dt),
    addScaled(velocities, k2.velocityRates, 0.5 * dt),
    lengths,
    masses,
    gravity,
  );
  const k4 = evaluateDerivative(
    addScaled(angles, k3.angleRates, dt),
    addScaled(velocities, k3.velocityRates, dt),
    lengths,
    masses,
    gravity,
  );

  const nextAngles = angles.map((value, index) =>
    wrapAngle(
      value +
        (dt / 6) *
          (k1.angleRates[index] +
            2 * k2.angleRates[index] +
            2 * k3.angleRates[index] +
            k4.angleRates[index]),
    ),
  );

  const nextVelocities = velocities.map(
    (value, index) =>
      value +
      (dt / 6) *
        (k1.velocityRates[index] +
          2 * k2.velocityRates[index] +
          2 * k3.velocityRates[index] +
          k4.velocityRates[index]),
  );

  return {
    angles: nextAngles,
    velocities: nextVelocities,
  };
};

function App() {
  const initialAnglesArray = [...DEFAULT_INITIAL_ANGLES];

  const [simulationMode, setSimulationMode] = useState<SimulationMode>('nonlinear');
  const [lengthMode, setLengthMode] = useState<DistributionMode>('independent');
  const [massMode, setMassMode] = useState<DistributionMode>('independent');
  const [angleMode, setAngleMode] = useState<DistributionMode>('independent');

  const [n, setN] = useState<number>(INITIAL_N);
  const [g, setG] = useState<number>(9.8);
  const [lengths, setLengths] = useState<number[]>([...DEFAULT_LENGTHS]);
  const [masses, setMasses] = useState<number[]>([...DEFAULT_MASSES]);
  const [initialAngles, setInitialAngles] = useState<number[]>(initialAnglesArray);

  const [data, setData] = useState<SimulationData | null>(null);
  const [error, setError] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isSocketReady, setIsSocketReady] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const timeRef = useRef<number>(0);
  const lastFrameTime = useRef<number>(performance.now());
  const nonlinearAnglesRef = useRef<number[]>([...initialAnglesArray]);
  const nonlinearVelocitiesRef = useRef<number[]>(createFilledArray(INITIAL_N, 0));
  const trailHistoryRef = useRef<BobPosition[][]>(
    Array.from({ length: INITIAL_N }, () => [] as BobPosition[]),
  );

  const angleLimit =
    simulationMode === 'linear' ? LINEAR_ANGLE_LIMIT : NONLINEAR_ANGLE_LIMIT;

  const clearTrails = (count: number) => {
    trailHistoryRef.current = Array.from({ length: count }, () => []);
  };

  const resetNonlinearState = (angles: number[]) => {
    nonlinearAnglesRef.current = [...angles];
    nonlinearVelocitiesRef.current = createFilledArray(angles.length, 0);
    timeRef.current = 0;
    clearTrails(angles.length);
  };

  const requestUpdate = (
    pendulums: number,
    segmentLengths: number[],
    bobMasses: number[],
    gravity: number,
  ) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          n: pendulums,
          lengths: segmentLengths,
          masses: bobMasses,
          g: gravity,
        }),
      );
    }
  };

  useEffect(() => {
    const wsUrl = 'ws://localhost:3001';
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      setIsSocketReady(true);
    };

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.error) {
        setError(msg.error);
        return;
      }

      if (msg.type === 'modes_result') {
        setData(msg.data);
        setError('');
      }
    };

    socket.onclose = () => {
      setIsSocketReady(false);
    };

    return () => {
      setIsSocketReady(false);
      socket.close();
    };
  }, []);

  useEffect(() => {
    if (!isSocketReady) {
      return;
    }

    requestUpdate(n, lengths, masses, g);
  }, [g, isSocketReady, lengths, masses, n]);

  const modalCoefficients = useMemo(() => {
    if (!data) {
      return [];
    }

    const coefficients = new Array(n).fill(0);
    const inverseModalShapes = data.inverse_modal_shapes;

    for (let i = 0; i < n; i += 1) {
      let sum = 0;

      for (let j = 0; j < n; j += 1) {
        sum += inverseModalShapes[i][j] * initialAngles[j];
      }

      coefficients[i] = sum;
    }

    return coefficients;
  }, [data, initialAngles, n]);

  const advanceNonlinearState = (totalDt: number) => {
    let remaining = totalDt;
    let nextAngles = nonlinearAnglesRef.current;
    let nextVelocities = nonlinearVelocitiesRef.current;

    while (remaining > 1e-8) {
      const dt = Math.min(MAX_SUBSTEP, remaining);
      const nextState = rk4Step(nextAngles, nextVelocities, dt, lengths, masses, g);

      nextAngles = nextState.angles;
      nextVelocities = nextState.velocities;
      remaining -= dt;
    }

    nonlinearAnglesRef.current = nextAngles;
    nonlinearVelocitiesRef.current = nextVelocities;
  };

  const updateLengths = (nextLengths: number[]) => {
    setLengths(nextLengths);
    resetNonlinearState(initialAngles);
  };

  const updateMasses = (nextMasses: number[]) => {
    setMasses(nextMasses);
    resetNonlinearState(initialAngles);
  };

  const updateAngles = (nextAngles: number[]) => {
    setInitialAngles(nextAngles);
    resetNonlinearState(nextAngles);
  };

  const handleSimulationModeChange = (nextMode: SimulationMode) => {
    if (nextMode === simulationMode) {
      return;
    }

    const nextLimit = nextMode === 'linear' ? LINEAR_ANGLE_LIMIT : NONLINEAR_ANGLE_LIMIT;
    const nextAngles = initialAngles.map((angle) => clamp(angle, -nextLimit, nextLimit));

    setSimulationMode(nextMode);
    updateAngles(nextAngles);
  };

  const handleNChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextN = parseInt(e.target.value, 10);
    const defaultLength = TOTAL_DEFAULT_LENGTH / nextN;

    const nextLengths =
      lengthMode === 'equal'
        ? createFilledArray(nextN, lengths[0] ?? defaultLength)
        : Array.from({ length: nextN }, (_, index) => lengths[index] ?? defaultLength);

    const nextMasses =
      massMode === 'equal'
        ? createFilledArray(nextN, masses[0] ?? DEFAULT_MASS)
        : Array.from({ length: nextN }, (_, index) => masses[index] ?? DEFAULT_MASS);

    const nextAngles =
      angleMode === 'equal'
        ? createFilledArray(
            nextN,
            clamp(initialAngles[0] ?? DEFAULT_INITIAL_ANGLE, -angleLimit, angleLimit),
          )
        : Array.from({ length: nextN }, (_, index) => {
            if (index < initialAngles.length) {
              return clamp(initialAngles[index], -angleLimit, angleLimit);
            }

            return index === 0 ? clamp(DEFAULT_INITIAL_ANGLE, -angleLimit, angleLimit) : 0;
          });

    setN(nextN);
    setLengths(nextLengths);
    setMasses(nextMasses);
    setInitialAngles(nextAngles);
    resetNonlinearState(nextAngles);
  };

  const handleLengthModeChange = (nextMode: DistributionMode) => {
    if (nextMode === lengthMode) {
      return;
    }

    setLengthMode(nextMode);

    if (nextMode === 'equal') {
      updateLengths(createFilledArray(n, lengths[0] ?? TOTAL_DEFAULT_LENGTH / n));
    } else {
      clearTrails(n);
    }
  };

  const handleMassModeChange = (nextMode: DistributionMode) => {
    if (nextMode === massMode) {
      return;
    }

    setMassMode(nextMode);

    if (nextMode === 'equal') {
      updateMasses(createFilledArray(n, masses[0] ?? DEFAULT_MASS));
    } else {
      clearTrails(n);
    }
  };

  const handleAngleModeChange = (nextMode: DistributionMode) => {
    if (nextMode === angleMode) {
      return;
    }

    setAngleMode(nextMode);

    if (nextMode === 'equal') {
      updateAngles(
        createFilledArray(
          n,
          clamp(initialAngles[0] ?? DEFAULT_INITIAL_ANGLE, -angleLimit, angleLimit),
        ),
      );
    } else {
      clearTrails(n);
    }
  };

  const handleSharedLengthChange = (value: number) => {
    updateLengths(createFilledArray(n, value));
  };

  const handleSharedMassChange = (value: number) => {
    updateMasses(createFilledArray(n, value));
  };

  const handleSharedAngleChange = (value: number) => {
    updateAngles(createFilledArray(n, value));
  };

  const handleLengthChange = (index: number, value: number) => {
    const nextLengths = [...lengths];
    nextLengths[index] = value;
    updateLengths(nextLengths);
  };

  const handleMassChange = (index: number, value: number) => {
    const nextMasses = [...masses];
    nextMasses[index] = value;
    updateMasses(nextMasses);
  };

  const handleAngleChange = (index: number, value: number) => {
    const nextAngles = [...initialAngles];
    nextAngles[index] = value;
    updateAngles(nextAngles);
  };

  const resetToInitialState = () => {
    setIsPlaying(false);
    resetNonlinearState(initialAngles);
  };

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    const ctx = canvasRef.current.getContext('2d');

    if (!ctx) {
      return;
    }

    let animationId = 0;
    const canvas = canvasRef.current;
    const width = canvas.width;
    const height = canvas.height;

    const draw = (now: number) => {
      const dt = Math.min((now - lastFrameTime.current) / 1000, 0.05);
      lastFrameTime.current = now;

      if (isPlaying) {
        if (simulationMode === 'nonlinear') {
          advanceNonlinearState(dt);
        }

        timeRef.current += dt;
      }

      const anglesToDraw =
        simulationMode === 'linear' && data
          ? Array.from({ length: n }, (_, i) => {
              let angle = 0;

              for (let k = 0; k < n; k += 1) {
                angle +=
                  modalCoefficients[k] *
                  data.modal_shapes[i][k] *
                  Math.cos(data.frequencies[k] * timeRef.current);
              }

              return angle;
            })
          : simulationMode === 'linear'
            ? initialAngles
            : nonlinearAnglesRef.current;

      ctx.clearRect(0, 0, width, height);

      const totalLength = lengths.reduce((sum, value) => sum + value, 0);
      const sidePadding = 42;
      const topPadding = 24;
      const bottomPadding = 34;
      const scaleX = (width - 2 * sidePadding) / (2 * (totalLength || 1));
      const scaleY = (height - topPadding - bottomPadding) / (2 * (totalLength || 1));
      const scale = Math.min(scaleX, scaleY);
      const anchorX = width / 2;
      const anchorY = topPadding + scale * totalLength;

      let currentX = anchorX;
      let currentY = anchorY;
      const bobPositions: BobPosition[] = [];

      ctx.beginPath();
      ctx.moveTo(anchorX - 120, topPadding);
      ctx.lineTo(anchorX + 120, topPadding);
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.95)';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(anchorX, anchorY, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(226, 232, 240, 0.95)';
      ctx.fill();

      for (let i = 0; i < n; i += 1) {
        const nextX = currentX + scale * lengths[i] * Math.sin(anglesToDraw[i]);
        const nextY = currentY + scale * lengths[i] * Math.cos(anglesToDraw[i]);

        bobPositions.push({ x: nextX, y: nextY });
        currentX = nextX;
        currentY = nextY;
      }

      if (trailHistoryRef.current.length !== n) {
        clearTrails(n);
      }

      if (isPlaying) {
        bobPositions.forEach((position, index) => {
          const trail = trailHistoryRef.current[index];
          trail.push(position);

          if (trail.length > MAX_TRAIL_POINTS) {
            trail.shift();
          }
        });
      }

      trailHistoryRef.current.forEach((trail, index) => {
        const rgb = COLOR_PALETTE[index % COLOR_PALETTE.length];
        ctx.lineCap = 'round';

        for (let pointIndex = 1; pointIndex < trail.length; pointIndex += 1) {
          const progress = pointIndex / Math.max(1, trail.length - 1);
          const alpha = 0.015 + Math.pow(progress, 2.15) * 0.72;
          const widthScale = 0.8 + progress * 1.8;

          ctx.beginPath();
          ctx.moveTo(trail[pointIndex - 1].x, trail[pointIndex - 1].y);
          ctx.lineTo(trail[pointIndex].x, trail[pointIndex].y);
          ctx.lineWidth = widthScale;
          ctx.strokeStyle = `rgba(${rgb}, ${alpha})`;
          ctx.stroke();
        }
      });

      currentX = anchorX;
      currentY = anchorY;

      for (let i = 0; i < n; i += 1) {
        const bob = bobPositions[i];
        const rgb = COLOR_PALETTE[i % COLOR_PALETTE.length];

        ctx.beginPath();
        ctx.moveTo(currentX, currentY);
        ctx.lineTo(bob.x, bob.y);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(203, 213, 225, 0.8)';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(bob.x, bob.y, 11, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb}, 0.88)`;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(248, 250, 252, 0.95)';
        ctx.stroke();

        currentX = bob.x;
        currentY = bob.y;
      }

      animationId = requestAnimationFrame(draw);
    };

    lastFrameTime.current = performance.now();
    animationId = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(animationId);
  }, [data, g, initialAngles, isPlaying, lengths, masses, modalCoefficients, n, simulationMode]);

  const hasSharedControls =
    lengthMode === 'equal' || massMode === 'equal' || angleMode === 'equal';
  const hasIndependentControls =
    lengthMode === 'independent' ||
    massMode === 'independent' ||
    angleMode === 'independent';

  const headerDescription =
    simulationMode === 'nonlinear'
      ? 'Nonlinear n-pendulum sandbox with arbitrary masses, lengths, and large angles'
      : 'Linear small-angle modal superposition for normal modes and beats';

  const modeNote =
    simulationMode === 'nonlinear'
      ? 'Nonlinear mode integrates the full coupled equations with RK4. Chaos can appear for some high-energy initial conditions, but it is not guaranteed for every large-angle release.'
      : 'Linear mode solves the small-angle modal problem. It is ideal for eigenmodes and beating, but it is integrable and therefore not chaotic.';

  return (
    <div className="container">
      <header>
        <h1>Coupled Pendulums Sandbox</h1>
        <p>{headerDescription}</p>
      </header>

      <main className="main-content">
        <div className="controls-panel card">
          <div className="controls-toolbar">
          <h2>Simulation Controls</h2>

          <div className="toggle-block">
            <span className="toggle-label">Dynamics</span>
            <div className="toggle-row">
              <button
                type="button"
                className={`toggle-button ${simulationMode === 'nonlinear' ? 'active' : ''}`}
                onClick={() => handleSimulationModeChange('nonlinear')}
              >
                Nonlinear Sandbox
              </button>
              <button
                type="button"
                className={`toggle-button ${simulationMode === 'linear' ? 'active' : ''}`}
                onClick={() => handleSimulationModeChange('linear')}
              >
                Linear Modes
              </button>
            </div>
          </div>

          <div className="model-note">{modeNote}</div>

          <div className="playback-controls">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="btn-primary"
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button type="button" onClick={resetToInitialState} className="btn-secondary">
              Reset t = 0
            </button>
          </div>

          </div>

          <div className="controls-body">

          <div className="control-group">
            <label>N (Number of Pendulums): {n}</label>
            <input type="range" min="1" max="10" value={n} onChange={handleNChange} />
          </div>

          <div className="control-group">
            <label>Gravity (g): {g.toFixed(2)} m/s²</label>
            <input
              type="range"
              min="1.0"
              max="25.0"
              step="0.1"
              value={g}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                setG(value);
                resetNonlinearState(initialAngles);
              }}
            />
          </div>

          <div className="toggle-grid">
            <div className="toggle-block">
              <span className="toggle-label">Lengths</span>
              <div className="toggle-row">
                <button
                  type="button"
                  className={`toggle-button ${lengthMode === 'equal' ? 'active' : ''}`}
                  onClick={() => handleLengthModeChange('equal')}
                >
                  Equal
                </button>
                <button
                  type="button"
                  className={`toggle-button ${lengthMode === 'independent' ? 'active' : ''}`}
                  onClick={() => handleLengthModeChange('independent')}
                >
                  Unequal
                </button>
              </div>
            </div>

            <div className="toggle-block">
              <span className="toggle-label">Masses</span>
              <div className="toggle-row">
                <button
                  type="button"
                  className={`toggle-button ${massMode === 'equal' ? 'active' : ''}`}
                  onClick={() => handleMassModeChange('equal')}
                >
                  Equal
                </button>
                <button
                  type="button"
                  className={`toggle-button ${massMode === 'independent' ? 'active' : ''}`}
                  onClick={() => handleMassModeChange('independent')}
                >
                  Unequal
                </button>
              </div>
            </div>

            <div className="toggle-block">
              <span className="toggle-label">Angles</span>
              <div className="toggle-row">
                <button
                  type="button"
                  className={`toggle-button ${angleMode === 'equal' ? 'active' : ''}`}
                  onClick={() => handleAngleModeChange('equal')}
                >
                  Equal
                </button>
                <button
                  type="button"
                  className={`toggle-button ${angleMode === 'independent' ? 'active' : ''}`}
                  onClick={() => handleAngleModeChange('independent')}
                >
                  Unequal
                </button>
              </div>
            </div>
          </div>

          {hasSharedControls && (
            <div className="shared-panel">
              <h3>Shared Controls</h3>

              {angleMode === 'equal' && (
                <div className="control-group small">
                  <label>
                    Shared Initial Angle: {((initialAngles[0] ?? 0) * 180 / Math.PI).toFixed(1)}°
                  </label>
                  <input
                    type="range"
                    min={-angleLimit}
                    max={angleLimit}
                    step="0.01"
                    value={initialAngles[0] ?? 0}
                    onChange={(e) => handleSharedAngleChange(parseFloat(e.target.value))}
                  />
                </div>
              )}

              {lengthMode === 'equal' && (
                <div className="control-group small">
                  <label>Shared Segment Length: {(lengths[0] ?? 0).toFixed(2)} m</label>
                  <input
                    type="range"
                    min="0.1"
                    max="2.0"
                    step="0.05"
                    value={lengths[0] ?? TOTAL_DEFAULT_LENGTH / n}
                    onChange={(e) => handleSharedLengthChange(parseFloat(e.target.value))}
                  />
                </div>
              )}

              {massMode === 'equal' && (
                <div className="control-group small">
                  <label>Shared Mass: {(masses[0] ?? 0).toFixed(2)} kg</label>
                  <input
                    type="range"
                    min="0.2"
                    max="5.0"
                    step="0.05"
                    value={masses[0] ?? DEFAULT_MASS}
                    onChange={(e) => handleSharedMassChange(parseFloat(e.target.value))}
                  />
                </div>
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
                    <div className="control-group small">
                      <label>
                        Initial Angle: {((initialAngles[index] ?? 0) * 180 / Math.PI).toFixed(1)}°
                      </label>
                      <input
                        type="range"
                        min={-angleLimit}
                        max={angleLimit}
                        step="0.01"
                        value={initialAngles[index] ?? 0}
                        onChange={(e) => handleAngleChange(index, parseFloat(e.target.value))}
                      />
                    </div>
                  )}

                  {lengthMode === 'independent' && (
                    <div className="control-group small">
                      <label>Segment Length: {(lengths[index] ?? 0).toFixed(2)} m</label>
                      <input
                        type="range"
                        min="0.1"
                        max="2.0"
                        step="0.05"
                        value={lengths[index] ?? TOTAL_DEFAULT_LENGTH / n}
                        onChange={(e) => handleLengthChange(index, parseFloat(e.target.value))}
                      />
                    </div>
                  )}

                  {massMode === 'independent' && (
                    <div className="control-group small">
                      <label>Mass: {(masses[index] ?? 0).toFixed(2)} kg</label>
                      <input
                        type="range"
                        min="0.2"
                        max="5.0"
                        step="0.05"
                        value={masses[index] ?? DEFAULT_MASS}
                        onChange={(e) => handleMassChange(index, parseFloat(e.target.value))}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {error && <div className="error">{error}</div>}
          </div>
        </div>

        <div className="canvas-panel card">
          <canvas ref={canvasRef} width={700} height={760}></canvas>
        </div>
      </main>
    </div>
  );
}

export default App;
