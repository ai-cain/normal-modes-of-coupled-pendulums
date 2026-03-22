import express from 'express';
import { spawn } from 'child_process';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

const port = Number(process.env.PORT) || 3001;
const clients = new Set();

const TOTAL_DEFAULT_LENGTH = 1.12;
const DEFAULT_GRAVITY = 9.8;
const DEFAULT_MASS = 1.0;
const DEFAULT_INITIAL_ANGLE = 0.6;
const INITIAL_N = 2;

const buildDefaultLengths = (count) =>
  count === INITIAL_N ? [0.46, 0.76] : Array(count).fill(TOTAL_DEFAULT_LENGTH / count);

const buildDefaultMasses = (count) =>
  count === INITIAL_N ? [1.35, 0.8] : Array(count).fill(DEFAULT_MASS);

const buildDefaultAngles = (count) =>
  count === INITIAL_N
    ? [0.95, -0.35]
    : Array.from({ length: count }, (_, index) => (index === 0 ? DEFAULT_INITIAL_ANGLE : 0));

const resolveEnginePath = () => {
  const extension = process.platform === 'win32' ? '.exe' : '';
  const candidates = [
    path.resolve(__dirname, `../engine_cpp/build/Release/pendulum_cli${extension}`),
    path.resolve(__dirname, `../engine_cpp/build/pendulum_cli${extension}`),
    path.resolve(__dirname, `../engine_cpp/build/Debug/pendulum_cli${extension}`),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
};

const broadcast = (payload) => {
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
};

const enginePath = resolveEnginePath();
let engineProcess = null;
let engineUnavailableReason = '';

const sendBackendError = (message, ws = null) => {
  const payload = JSON.stringify({ type: 'error', message });

  if (ws) {
    ws.send(payload);
    return;
  }

  broadcast(payload);
};

const startEngine = () => {
  if (!fs.existsSync(enginePath)) {
    engineUnavailableReason = `Engine executable not found at ${enginePath}`;
    console.error(engineUnavailableReason);
    return;
  }

  engineProcess = spawn(enginePath, ['--stdio-server'], {
    cwd: path.resolve(__dirname, '..'),
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const stdoutReader = readline.createInterface({ input: engineProcess.stdout });
  stdoutReader.on('line', (line) => {
    const payload = line.trim();
    if (!payload) {
      return;
    }

    broadcast(payload);
  });

  engineProcess.stderr.on('data', (chunk) => {
    const text = chunk.toString().trim();
    if (text) {
      console.error(`[engine] ${text}`);
    }
  });

  engineProcess.on('error', (error) => {
    engineUnavailableReason = `Failed to start engine: ${error.message}`;
    console.error(engineUnavailableReason);
    sendBackendError(engineUnavailableReason);
  });

  engineProcess.on('exit', (code, signal) => {
    const reason = `Engine process exited (${signal ?? code ?? 'unknown'}).`;
    engineUnavailableReason = reason;
    engineProcess = null;
    console.error(reason);
    sendBackendError(reason);
  });
};

const sendEngineCommand = (command, ws) => {
  if (engineUnavailableReason) {
    sendBackendError(engineUnavailableReason, ws);
    return;
  }

  if (!engineProcess || engineProcess.killed || !engineProcess.stdin.writable) {
    sendBackendError('Engine process is not available.', ws);
    return;
  }

  engineProcess.stdin.write(`${command}\n`);
};

const sanitizeNumber = (value, fallback) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const sanitizeSeries = (values, count, defaults) =>
  Array.from({ length: count }, (_, index) => sanitizeNumber(values?.[index], defaults[index]));

const normalizeConfig = (raw) => {
  const n = Math.max(1, Math.min(10, Math.round(sanitizeNumber(raw.n, INITIAL_N))));
  const simulationMode = raw.simulationMode === 'linear' ? 'linear' : 'nonlinear';
  const g = sanitizeNumber(raw.g, DEFAULT_GRAVITY);
  const defaultLengths = buildDefaultLengths(n);
  const defaultMasses = buildDefaultMasses(n);
  const defaultAngles = buildDefaultAngles(n);

  return {
    simulationMode,
    n,
    g,
    lengths: sanitizeSeries(raw.lengths, n, defaultLengths),
    masses: sanitizeSeries(raw.masses, n, defaultMasses),
    initialAngles: sanitizeSeries(raw.initialAngles, n, defaultAngles),
  };
};

const serializeArray = (values) => values.map((value) => Number(value).toString()).join(',');

const server = app.listen(port, () => {
  console.log(`Node API Server listening on port ${port}`);
  console.log(`C++ Engine Path: ${enginePath}`);
});

startEngine();

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('Client connected to WebSocket.');

  if (engineUnavailableReason) {
    sendBackendError(engineUnavailableReason, ws);
  } else {
    ws.send(JSON.stringify({ type: 'ready' }));
  }

  ws.on('message', (message) => {
    try {
      const payload = JSON.parse(message);

      if (payload.type === 'configure') {
        const config = normalizeConfig(payload.data ?? {});
        sendEngineCommand(
          [
            'CONFIG',
            config.simulationMode,
            config.n,
            config.g,
            serializeArray(config.lengths),
            serializeArray(config.masses),
            serializeArray(config.initialAngles),
            payload.data?.playing ? 1 : 0,
          ].join('\t'),
          ws,
        );
        return;
      }

      if (payload.type === 'set_playing') {
        sendEngineCommand(`PLAY\t${payload.data?.playing ? 1 : 0}`, ws);
        return;
      }

      if (payload.type === 'reset') {
        sendEngineCommand('RESET', ws);
        return;
      }

      if (payload.type === 'request_state') {
        sendEngineCommand('REQUEST_STATE', ws);
        return;
      }

      sendBackendError('Unknown message type.', ws);
    } catch (error) {
      console.error('Invalid message format:', message.toString());
      sendBackendError('Invalid message format. Send JSON.', ws);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log('Client disconnected.');
  });
});

const shutdownEngine = () => {
  if (!engineProcess || engineProcess.killed) {
    return;
  }

  engineProcess.kill();
};

process.on('SIGINT', () => {
  shutdownEngine();
  process.exit(0);
});

process.on('SIGTERM', () => {
  shutdownEngine();
  process.exit(0);
});
