import { useEffect, useEffectEvent, useRef, useState } from 'react';
import ControlsPanel from './components/ControlsPanel';
import {
  clamp,
  COLOR_PALETTE,
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
  MAX_TRAIL_POINTS,
  NONLINEAR_ANGLE_LIMIT,
  toCanvasPoint,
  TOTAL_DEFAULT_LENGTH,
} from './lib/pendulumMath';
import type { DistributionMode, EngineSnapshot, Point, SimulationMode } from './types';
import './index.css';

const buildDefaultLengths = (count: number) =>
  count === INITIAL_N ? [...DEFAULT_LENGTHS] : createFilledArray(count, TOTAL_DEFAULT_LENGTH / count);

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

const backendWebSocketUrl =
  import.meta.env.VITE_BACKEND_WS_URL?.trim() || 'ws://localhost:3001';

const recordingMimeTypes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];

const getSupportedRecordingMimeType = () => {
  if (typeof MediaRecorder === 'undefined') {
    return '';
  }

  return recordingMimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? '';
};

const drawSnapshot = (
  canvas: HTMLCanvasElement,
  snapshot: EngineSnapshot,
  trails: Point[][],
) => {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  const width = canvas.width;
  const height = canvas.height;
  const scenePoints: Point[] = [{ x: 0, y: 0 }, ...snapshot.positions];
  trails.forEach((trail) => {
    scenePoints.push(...trail);
  });

  const viewport = computeViewport(scenePoints, width, height);
  const anchorPoint = toCanvasPoint({ x: 0, y: 0 }, viewport);
  const canvasPositions = snapshot.positions.map((point) => toCanvasPoint(point, viewport));
  const canvasTrails = trails.map((trail) => trail.map((point) => toCanvasPoint(point, viewport)));

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
};

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

  const [snapshot, setSnapshot] = useState<EngineSnapshot | null>(null);
  const [error, setError] = useState('');
  const [isPlaying, setIsPlaying] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isSocketReady, setIsSocketReady] = useState(false);
  const [recordingError, setRecordingError] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingUrlRef = useRef<string | null>(null);
  const trailHistoryRef = useRef<Point[][]>(Array.from({ length: INITIAL_N }, () => []));
  const lastTrailRevisionRef = useRef(-1);
  const lastTrailTimeRef = useRef(Number.NEGATIVE_INFINITY);
  const isPlayingRef = useRef(isPlaying);
  const lastConfigKeyRef = useRef('');

  const angleLimit =
    simulationMode === 'linear' ? LINEAR_ANGLE_LIMIT : NONLINEAR_ANGLE_LIMIT;
  const isRecordingSupported =
    typeof MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    'captureStream' in HTMLCanvasElement.prototype;

  const resetTrailState = (count: number) => {
    trailHistoryRef.current = Array.from({ length: count }, () => []);
    lastTrailRevisionRef.current = -1;
    lastTrailTimeRef.current = Number.NEGATIVE_INFINITY;
  };

  const releaseRecordingUrl = () => {
    if (!recordingUrlRef.current) {
      return;
    }

    URL.revokeObjectURL(recordingUrlRef.current);
    recordingUrlRef.current = null;
  };

  const stopRecorderStream = (recorder: MediaRecorder | null) => {
    recorder?.stream.getTracks().forEach((track) => track.stop());
  };

  const downloadRecording = (blob: Blob) => {
    releaseRecordingUrl();

    const url = URL.createObjectURL(blob);
    recordingUrlRef.current = url;

    const link = document.createElement('a');
    link.href = url;
    link.download = `coupled-pendulums-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
    link.click();
  };

  const sendSocketMessage = useEffectEvent((payload: unknown) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      return;
    }

    wsRef.current.send(JSON.stringify(payload));
  });

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    const socket = new WebSocket(backendWebSocketUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      lastConfigKeyRef.current = '';
      setIsSocketReady(true);
      setError('');
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'error' || message.error) {
          setError(message.message ?? message.error ?? 'Engine error.');
          return;
        }

        if (message.type === 'state') {
          setSnapshot(message.data as EngineSnapshot);
          setError('');
        }
      } catch {
        setError('Invalid output from engine.');
      }
    };

    socket.onclose = () => {
      lastConfigKeyRef.current = '';
      setIsSocketReady(false);
    };

    return () => {
      lastConfigKeyRef.current = '';
      setIsSocketReady(false);
      socket.close();
    };
  }, []);

  useEffect(
    () => () => {
      releaseRecordingUrl();

      const recorder = mediaRecorderRef.current;
      mediaRecorderRef.current = null;
      recordedChunksRef.current = [];

      if (!recorder) {
        return;
      }

      recorder.ondataavailable = null;
      recorder.onerror = null;
      recorder.onstop = null;

      if (recorder.state !== 'inactive') {
        recorder.stop();
      }

      stopRecorderStream(recorder);
    },
    [],
  );

  useEffect(() => {
    if (!isSocketReady) {
      return;
    }

    const configKey = JSON.stringify({
      simulationMode,
      n,
      g,
      lengths,
      masses,
      initialAngles,
      playing: isPlayingRef.current,
    });

    if (lastConfigKeyRef.current === configKey) {
      return;
    }

    lastConfigKeyRef.current = configKey;

    sendSocketMessage({
      type: 'configure',
      data: {
        simulationMode,
        n,
        g,
        lengths,
        masses,
        initialAngles,
        playing: isPlayingRef.current,
      },
    });
  }, [g, initialAngles, isSocketReady, lengths, masses, n, simulationMode]);

  useEffect(() => {
    if (!isSocketReady) {
      return;
    }

    sendSocketMessage({
      type: 'set_playing',
      data: { playing: isPlaying },
    });
  }, [isPlaying, isSocketReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    if (!snapshot) {
      const context = canvas.getContext('2d');
      context?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    if (
      lastTrailRevisionRef.current !== snapshot.revision ||
      snapshot.time < lastTrailTimeRef.current
    ) {
      resetTrailState(snapshot.positions.length);
    }

    if (trailHistoryRef.current.length !== snapshot.positions.length) {
      trailHistoryRef.current = Array.from({ length: snapshot.positions.length }, () => []);
    }

    if (snapshot.playing && snapshot.time > lastTrailTimeRef.current + 1e-9) {
      snapshot.positions.forEach((position, index) => {
        const trail = trailHistoryRef.current[index];
        trail.push(position);

        if (trail.length > MAX_TRAIL_POINTS) {
          trail.shift();
        }
      });
    }

    lastTrailRevisionRef.current = snapshot.revision;
    lastTrailTimeRef.current = snapshot.time;

    drawSnapshot(canvas, snapshot, trailHistoryRef.current);
  }, [snapshot]);

  const updateLengths = (nextLengths: number[]) => {
    setLengths(nextLengths);
    resetTrailState(nextLengths.length);
  };

  const updateMasses = (nextMasses: number[]) => {
    setMasses(nextMasses);
    resetTrailState(nextMasses.length);
  };

  const updateAngles = (nextAngles: number[]) => {
    setInitialAngles(nextAngles);
    resetTrailState(nextAngles.length);
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
    resetTrailState(nextCount);
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
    resetTrailState(n);
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

  const handleReset = () => {
    setIsPlaying(false);
    resetTrailState(n);
    sendSocketMessage({ type: 'reset' });
    sendSocketMessage({ type: 'set_playing', data: { playing: false } });
  };

  const handleToggleRecording = () => {
    const currentRecorder = mediaRecorderRef.current;

    if (currentRecorder && currentRecorder.state !== 'inactive') {
      currentRecorder.stop();
      return;
    }

    if (!isRecordingSupported) {
      setRecordingError('Recording is not supported in this browser.');
      return;
    }

    const canvas = canvasRef.current;

    if (!canvas) {
      setRecordingError('Canvas is not ready yet.');
      return;
    }

    const mimeType = getSupportedRecordingMimeType();

    try {
      const stream = canvas.captureStream(60);
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recordedChunksRef.current = [];
      setRecordingError('');

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setRecordingError('Recording failed while capturing the canvas.');
        setIsRecording(false);
        mediaRecorderRef.current = null;
        recordedChunksRef.current = [];
        stopRecorderStream(recorder);
      };

      recorder.onstop = () => {
        const blob =
          recordedChunksRef.current.length > 0
            ? new Blob(recordedChunksRef.current, { type: mimeType || 'video/webm' })
            : null;

        if (blob) {
          downloadRecording(blob);
        }

        setIsRecording(false);
        mediaRecorderRef.current = null;
        recordedChunksRef.current = [];
        stopRecorderStream(recorder);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setIsRecording(true);
    } catch {
      setRecordingError('The browser could not start recording the pendulum canvas.');
      setIsRecording(false);
    }
  };

  const headerDescription =
    simulationMode === 'nonlinear'
      ? 'Engine-backed workspace for nonlinear motion.'
      : 'Engine-backed workspace for normal modes.';

  const modeNote =
    simulationMode === 'nonlinear'
      ? 'Native engine integrates the full coupled equations.'
      : 'Native engine reconstructs motion from normal modes.';

  const stageStatusLabel = !isSocketReady
    ? 'Engine offline'
    : snapshot
      ? snapshot.playing
        ? 'Engine streaming'
        : 'Engine synced'
      : 'Awaiting engine state';

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
          isRecording={isRecording}
          isRecordingSupported={isRecordingSupported}
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
          recordingError={recordingError}
          onSimulationModeChange={handleSimulationModeChange}
          onTogglePlay={() => setIsPlaying((value) => !value)}
          onToggleRecording={handleToggleRecording}
          onReset={handleReset}
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
              {isRecording && <span className="status-pill recording">Recording</span>}
              <span className={`status-pill ${isPlaying ? 'active' : ''}`}>
                {isPlaying ? 'Running' : 'Paused'}
              </span>
              <span
                className={`status-pill ${
                  !isSocketReady ? 'warning' : 'success'
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
