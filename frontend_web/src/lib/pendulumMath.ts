import type {
  NonlinearState,
  Point,
  StateDerivative,
  Viewport,
} from '../types';

export const INITIAL_N = 2;
export const DEFAULT_GRAVITY = 9.8;
export const TOTAL_DEFAULT_LENGTH = 1.12;
export const DEFAULT_MASS = 1.0;
export const DEFAULT_INITIAL_ANGLE = 0.6;
export const LINEAR_ANGLE_LIMIT = 0.35;
export const NONLINEAR_ANGLE_LIMIT = 2.8;
export const MAX_SUBSTEP = 1 / 240;
export const MAX_TRAIL_POINTS = 180;
export const DEFAULT_LENGTHS = [0.46, 0.76];
export const DEFAULT_MASSES = [1.35, 0.8];
export const DEFAULT_INITIAL_ANGLES = [0.95, -0.35];
export const COLOR_PALETTE = [
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

export const createFilledArray = (count: number, value: number) =>
  Array.from({ length: count }, () => value);

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const wrapAngle = (angle: number) => {
  const period = Math.PI * 2;
  let wrapped = (angle + Math.PI) % period;

  if (wrapped < 0) {
    wrapped += period;
  }

  return wrapped - Math.PI;
};

export const buildSuffixMasses = (masses: number[]) => {
  const suffix = new Array(masses.length).fill(0);

  for (let i = masses.length - 1; i >= 0; i -= 1) {
    suffix[i] = masses[i] + (suffix[i + 1] ?? 0);
  }

  return suffix;
};

export const solveLinearSystem = (matrix: number[][], rhs: number[]) => {
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

export const computeNonlinearAccelerations = (
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

export const evaluateDerivative = (
  angles: number[],
  velocities: number[],
  lengths: number[],
  masses: number[],
  gravity: number,
): StateDerivative => ({
  angleRates: [...velocities],
  velocityRates: computeNonlinearAccelerations(angles, velocities, lengths, masses, gravity),
});

export const rk4Step = (
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

export const computeChainPositions = (angles: number[], lengths: number[]) => {
  let currentX = 0;
  let currentY = 0;
  const positions: Point[] = [];

  for (let i = 0; i < angles.length; i += 1) {
    currentX += lengths[i] * Math.sin(angles[i]);
    currentY += lengths[i] * Math.cos(angles[i]);
    positions.push({ x: currentX, y: currentY });
  }

  return positions;
};

export const computeViewport = (
  points: Point[],
  width: number,
  height: number,
): Viewport => {
  const sidePadding = 42;
  const topPadding = 60;
  const bottomPadding = 34;
  const anchorX = width / 2;
  const anchorY = topPadding;

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);

  const maxAbsX = Math.max(...xs.map((value) => Math.abs(value)), 1e-6);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const horizontalCapacity = Math.max(anchorX - sidePadding, 1e-6);
  const upwardCapacity = Math.max(anchorY - 18, 1e-6);
  const downwardCapacity = Math.max(height - anchorY - bottomPadding, 1e-6);

  const scaleX = horizontalCapacity / maxAbsX;
  const scaleUp = upwardCapacity / Math.max(Math.abs(minY), 1e-6);
  const scaleDown = downwardCapacity / Math.max(maxY, 1e-6);
  const scale = Math.min(scaleX, scaleUp, scaleDown);

  const offsetX = anchorX;
  const offsetY = anchorY;

  return { scale, offsetX, offsetY };
};

export const toCanvasPoint = (point: Point, viewport: Viewport): Point => ({
  x: point.x * viewport.scale + viewport.offsetX,
  y: point.y * viewport.scale + viewport.offsetY,
});
