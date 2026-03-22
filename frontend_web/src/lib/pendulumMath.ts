import type { Point, Viewport } from '../types';

export const INITIAL_N = 2;
export const DEFAULT_GRAVITY = 9.8;
export const TOTAL_DEFAULT_LENGTH = 1.12;
export const DEFAULT_MASS = 1.0;
export const DEFAULT_INITIAL_ANGLE = 0.6;
export const LINEAR_ANGLE_LIMIT = 0.35;
export const NONLINEAR_ANGLE_LIMIT = 2.8;
export const MAX_TRAIL_POINTS = 180;
export const DEFAULT_LENGTHS = [0.46, 0.76];
export const DEFAULT_MASSES = [1.35, 0.8];
export const DEFAULT_INITIAL_ANGLES = [0.95, -0.35];
export const COLOR_PALETTE = [
  '44, 95, 92',
  '91, 108, 140',
  '182, 111, 78',
  '128, 142, 95',
  '176, 142, 93',
  '143, 92, 111',
  '85, 132, 173',
  '188, 128, 119',
  '98, 120, 83',
  '205, 168, 109',
];

export const createFilledArray = (count: number, value: number) =>
  Array.from({ length: count }, () => value);

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

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
