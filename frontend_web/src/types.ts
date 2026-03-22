export type SimulationMode = 'nonlinear' | 'linear';
export type DistributionMode = 'equal' | 'independent';

export interface SimulationData {
  n: number;
  lengths: number[];
  masses: number[];
  g: number;
  frequencies: number[];
  modal_shapes: number[][];
  inverse_modal_shapes: number[][];
}

export interface Point {
  x: number;
  y: number;
}

export interface StateDerivative {
  angleRates: number[];
  velocityRates: number[];
}

export interface NonlinearState {
  angles: number[];
  velocities: number[];
}

export interface Viewport {
  scale: number;
  offsetX: number;
  offsetY: number;
}
