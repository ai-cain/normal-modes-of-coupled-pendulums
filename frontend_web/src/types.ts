export type SimulationMode = 'nonlinear' | 'linear';
export type DistributionMode = 'equal' | 'independent';

export interface Point {
  x: number;
  y: number;
}

export interface EngineSnapshot {
  mode: SimulationMode;
  revision: number;
  n: number;
  g: number;
  time: number;
  playing: boolean;
  lengths: number[];
  masses: number[];
  initial_angles: number[];
  angles: number[];
  velocities: number[];
  positions: Point[];
  frequencies: number[];
}

export interface Viewport {
  scale: number;
  offsetX: number;
  offsetY: number;
}
