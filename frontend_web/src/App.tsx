import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import ControlsPanel from './components/ControlsPanel';
import {
  clamp,
  COLOR_PALETTE,
  computeChainPositions,
  computeViewport,
  createFilledArray,
  DEFAULT_GRAVITY,
  DEFAULT_INITIAL_ANGLE,
  DEFAULT_INITIAL_ANGLES,
  DEFAULT_LENGTHS,
  DEFAULT_MASS,
  DEFAULT_MASSES,
  INITIAL_N,
  LINEAR_ANGLE_LIMIT,
  MAX_SUBSTEP,
  MAX_TRAIL_POINTS,
  NONLINEAR_ANGLE_LIMIT,
  rk4Step,
  toCanvasPoint,
  TOTAL_DEFAULT_LENGTH,
} from './lib/pendulumMath';
import type {
  DistributionMode,
  Point,
  SimulationData,
  SimulationMode,
} from './types';
import './index.css';

const buildDefaultLengths = (count: number) =>
  count === INITIAL_N
    ? [...DEFAULT_LENGTHS]
    : createFilledArray(count, TOTAL_DEFAULT_LENGTH / count);

const buildDefaultMasses = (count: number) =>
  count === INITIAL_N ? [...DEFAULT_MASSES] : createFilledArray(count, DEFAULT_MASS);

const buildDefaultAngles = (count: number) =>
  count === INITIAL_N
    ? [...DEFAULT_INITIAL_ANGLES]
    : Array.from({ length: count }, (_, index) => (index === 0 ? DEFAULT_INITIAL_ANGLE : 0));

const resizeSeries = (
  current: number[],
  nextCount: number,
  fallback: (index: number) => number,
) => Array.from({ length: nextCount }, (_, index) => current[index] ?? fallback(index));

function App() {
  const [simulationMode, setSimulationMode] = useState<SimulationMode>('nonlinear');
  const [lengthMode, setLengthMode] = useState<DistributionMode>('independent');
  const [massMode, setMassMode] = useState<DistributionMode>('independent');
  const [angleMode, setAngleMode] = useState<DistributionMode>('independent');

  const [n, setN] = useState(INITIAL_N);
  const [g, setG] = useState(DEFAULT_GRAVITY);
  const [lengths, setLengths] = useState<number[]>(buildDefaultLengths(INITIAL_N));
  const [masses, setMasses] = useState<number[]>(buildDefaultMasses(INITIAL_N));
  const [initialAngles, setInitialAngles] = useState<number[]>(buildDefaultAngles(INITIAL_N));

  const [data, setData] = useState<SimulationData | null>(null);
  const [error, setError] = useState('');
  const [isPlaying, setIsPlaying] = useState(true);
  const [isSocketReady, setIsSocketReady] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const timeRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const nonlinearAnglesRef = useRef<number[]>([...DEFAULT_INITIAL_ANGLES]);
  const nonlinearVelocitiesRef = useRef<number[]>(createFilledArray(INITIAL_N, 0));
  const trailHistoryRef = useRef<Point[][]>(Array.from({ length: INITIAL_N }, () => []));

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

  const requestLinearUpdate = (
    pendulumCount: number,
    nextLengths: number[],
    nextMasses: number[],
    gravity: number,
  ) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      return;
    }

    wsRef.current.send(
      JSON.stringify({
        n: pendulumCount,
        lengths: nextLengths,
        masses: nextMasses,
        g: gravity,
      }),
    );
  };

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:3001');
    wsRef.current = socket;

    socket.onopen = () => {
      setIsSocketReady(true);
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.error) {
        setError(message.error);
        return;
      }

      if (message.type === 'modes_result') {
        setData(message.data);
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

    requestLinearUpdate(n, lengths, masses, g);
  }, [g, isSocketReady, lengths, masses, n]);

  const modalCoefficients = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.inverse_modal_shapes.map((row) =>
      row.reduce((sum, value, index) => sum + value * (initialAngles[index] ?? 0), 0),
    );
  }, [data, initialAngles]);

  const advanceNonlinearState = useEffectEvent((totalDt: number) => {
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
  });

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

  const handleNChange = (nextCount: number) => {
    const defaultLengths = buildDefaultLengths(nextCount);
    const defaultMasses = buildDefaultMasses(nextCount);
    const defaultAngles = buildDefaultAngles(nextCount);

    const nextLengths =
      lengthMode === 'equal'
        ? createFilledArray(nextCount, lengths[0] ?? defaultLengths[0])
        : resizeSeries(lengths, nextCount, (index) => defaultLengths[index] ?? defaultLengths[0]);

    const nextMasses =
      massMode === 'equal'
        ? createFilledArray(nextCount, masses[0] ?? defaultMasses[0])
        : resizeSeries(masses, nextCount, (index) => defaultMasses[index] ?? defaultMasses[0]);

    const nextAngles =
      angleMode === 'equal'
        ? createFilledArray(
            nextCount,
            clamp(initialAngles[0] ?? defaultAngles[0], -angleLimit, angleLimit),
          )
        : resizeSeries(initialAngles, nextCount, (index) =>
            clamp(defaultAngles[index] ?? 0, -angleLimit, angleLimit),
          );

    setN(nextCount);
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
      return;
    }

    updateLengths(
      resizeSeries(lengths, n, (index) => buildDefaultLengths(n)[index] ?? TOTAL_DEFAULT_LENGTH / n),
    );
  };

  const handleMassModeChange = (nextMode: DistributionMode) => {
    if (nextMode === massMode) {
      return;
    }

    setMassMode(nextMode);

    if (nextMode === 'equal') {
      updateMasses(createFilledArray(n, masses[0] ?? DEFAULT_MASS));
      return;
    }

    updateMasses(resizeSeries(masses, n, (index) => buildDefaultMasses(n)[index] ?? DEFAULT_MASS));
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
      return;
    }

    updateAngles(
      resizeSeries(initialAngles, n, (index) =>
        clamp(buildDefaultAngles(n)[index] ?? 0, -angleLimit, angleLimit),
      ),
    );
  };

  const handleGravityChange = (value: number) => {
    setG(value);
    resetNonlinearState(initialAngles);
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
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    let animationId = 0;
    const width = canvas.width;
    const height = canvas.height;

    const draw = (now: number) => {
      const dt = Math.min((now - lastFrameTimeRef.current) / 1000, 0.05);
      lastFrameTimeRef.current = now;

      if (isPlaying) {
        if (simulationMode === 'nonlinear') {
          advanceNonlinearState(dt);
        }

        timeRef.current += dt;
      }

      const anglesToDraw =
        simulationMode === 'linear' && data
          ? Array.from({ length: n }, (_, index) =>
              data.modal_shapes[index].reduce(
                (sum, modalValue, modeIndex) =>
                  sum +
                  (modalCoefficients[modeIndex] ?? 0) *
                    modalValue *
                    Math.cos((data.frequencies[modeIndex] ?? 0) * timeRef.current),
                0,
              ),
            )
          : simulationMode === 'linear'
            ? initialAngles
            : nonlinearAnglesRef.current;

      const worldPositions = computeChainPositions(anglesToDraw, lengths);

      if (trailHistoryRef.current.length !== n) {
        clearTrails(n);
      }

      if (isPlaying) {
        worldPositions.forEach((position, index) => {
          const trail = trailHistoryRef.current[index];
          trail.push(position);

          if (trail.length > MAX_TRAIL_POINTS) {
            trail.shift();
          }
        });
      }

      const scenePoints: Point[] = [{ x: 0, y: 0 }, ...worldPositions];
      trailHistoryRef.current.forEach((trail) => {
        scenePoints.push(...trail);
      });

      const viewport = computeViewport(scenePoints, width, height);
      const anchorPoint = toCanvasPoint({ x: 0, y: 0 }, viewport);
      const canvasPositions = worldPositions.map((point) => toCanvasPoint(point, viewport));
      const canvasTrails = trailHistoryRef.current.map((trail) =>
        trail.map((point) => toCanvasPoint(point, viewport)),
      );

      context.clearRect(0, 0, width, height);

      context.beginPath();
      context.moveTo(anchorPoint.x - 120, anchorPoint.y);
      context.lineTo(anchorPoint.x + 120, anchorPoint.y);
      context.lineWidth = 3;
      context.strokeStyle = 'rgba(31, 37, 50, 0.2)';
      context.stroke();

      context.beginPath();
      context.arc(anchorPoint.x, anchorPoint.y, 4, 0, Math.PI * 2);
      context.fillStyle = 'rgba(31, 37, 50, 0.48)';
      context.fill();

      context.lineCap = 'round';
      canvasTrails.forEach((trail, index) => {
        const rgb = COLOR_PALETTE[index % COLOR_PALETTE.length];

        for (let pointIndex = 1; pointIndex < trail.length; pointIndex += 1) {
          const progress = pointIndex / Math.max(1, trail.length - 1);
          const alpha = 0.03 + Math.pow(progress, 2.1) * 0.42;
          const widthScale = 0.85 + progress * 1.45;

          context.beginPath();
          context.moveTo(trail[pointIndex - 1].x, trail[pointIndex - 1].y);
          context.lineTo(trail[pointIndex].x, trail[pointIndex].y);
          context.lineWidth = widthScale;
          context.strokeStyle = `rgba(${rgb}, ${alpha})`;
          context.stroke();
        }
      });

      let previousPoint = anchorPoint;
      canvasPositions.forEach((point, index) => {
        const rgb = COLOR_PALETTE[index % COLOR_PALETTE.length];

        context.beginPath();
        context.moveTo(previousPoint.x, previousPoint.y);
        context.lineTo(point.x, point.y);
        context.lineWidth = 2;
        context.strokeStyle = 'rgba(53, 60, 74, 0.38)';
        context.stroke();

        context.beginPath();
        context.arc(point.x, point.y, 11, 0, Math.PI * 2);
        context.fillStyle = `rgba(${rgb}, 0.82)`;
        context.fill();
        context.lineWidth = 2;
        context.strokeStyle = 'rgba(255, 252, 247, 0.92)';
        context.stroke();

        previousPoint = point;
      });

      animationId = requestAnimationFrame(draw);
    };

    lastFrameTimeRef.current = performance.now();
    animationId = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(animationId);
  }, [data, g, initialAngles, isPlaying, lengths, masses, modalCoefficients, n, simulationMode]);

  const headerDescription =
    simulationMode === 'nonlinear'
      ? 'Single-view workspace for nonlinear motion.'
      : 'Single-view workspace for normal modes.';

  const modeNote =
    simulationMode === 'nonlinear'
      ? 'Full coupled equations integrated with RK4.'
      : 'Motion reconstructed from normal modes.';

  const stageStatusLabel =
    simulationMode === 'linear'
      ? isSocketReady
        ? 'Linear backend ready'
        : 'Linear backend offline'
      : 'Running in browser';

  const metricCards = [
    {
      label: 'Mode',
      value: simulationMode === 'nonlinear' ? 'Full dynamics' : 'Normal modes',
    },
    {
      label: 'Chain',
      value: `${n} bodies`,
    },
    {
      label: 'Gravity',
      value: `${g.toFixed(2)} m/s^2`,
    },
    {
      label: 'Status',
      value: isPlaying ? 'Animating' : 'Paused',
    },
  ];

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Coupled Pendulums</span>
          <h1>Pendulum lab</h1>
          <p>{headerDescription}</p>
        </div>

        <div className="hero-metrics">
          {metricCards.map((metric) => (
            <article key={metric.label} className="metric-card">
              <span className="metric-label">{metric.label}</span>
              <strong>{metric.value}</strong>
            </article>
          ))}
        </div>
      </header>

      <main className="workspace">
        <ControlsPanel
          simulationMode={simulationMode}
          modeNote={modeNote}
          isPlaying={isPlaying}
          isSocketReady={isSocketReady}
          n={n}
          g={g}
          lengthMode={lengthMode}
          massMode={massMode}
          angleMode={angleMode}
          angleLimit={angleLimit}
          lengths={lengths}
          masses={masses}
          initialAngles={initialAngles}
          error={error}
          onSimulationModeChange={handleSimulationModeChange}
          onTogglePlay={() => setIsPlaying((value) => !value)}
          onReset={resetToInitialState}
          onNChange={handleNChange}
          onGravityChange={handleGravityChange}
          onLengthModeChange={handleLengthModeChange}
          onMassModeChange={handleMassModeChange}
          onAngleModeChange={handleAngleModeChange}
          onSharedAngleChange={handleSharedAngleChange}
          onSharedLengthChange={handleSharedLengthChange}
          onSharedMassChange={handleSharedMassChange}
          onAngleChange={handleAngleChange}
          onLengthChange={handleLengthChange}
          onMassChange={handleMassChange}
        />

        <section className="stage-panel card">
          <div className="stage-header">
            <div>
              <span className="section-eyebrow">Live View</span>
              <h2>Pendulum stage</h2>
            </div>

            <div className="stage-badges">
              <span className={`status-pill ${isPlaying ? 'active' : ''}`}>
                {isPlaying ? 'Running' : 'Paused'}
              </span>
              <span
                className={`status-pill ${
                  simulationMode === 'linear' && !isSocketReady ? 'warning' : 'success'
                }`}
              >
                {stageStatusLabel}
              </span>
            </div>
          </div>

          <div className="canvas-frame">
            <canvas ref={canvasRef} width={700} height={760}></canvas>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
