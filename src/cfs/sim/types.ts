/** Domain types for the Shipmate Yard Digital Twin. Framework-free by design. */

export type ContainerSize = 20 | 40;

/** Cargo class. DPD boxes clear at the port and dwell far shorter than non-DPD. */
export type CargoType = "DPD" | "NONDPD" | "EXPORT";

/** Dwell bucket, derived from *predicted* dwell: <2d, 2–5d, >5d. */
export type Bucket = "short" | "medium" | "long";

export type PolicyId = "baseline" | "predictive";

export interface Container {
  id: string;
  size: ContainerSize;
  type: CargoType;
  /** Sim hour the box entered the gate. */
  arrivalHour: number;
  actualDwellHours: number;
  predictedDwellHours: number;
  /** Ground truth — drives departures identically in both yards. */
  departureHour: number;
  /** What the planner *believes* — the only dwell signal the predictive policy may read. */
  predictedDepartureHour: number;
  bucket: Bucket;
}

export interface Slot {
  /** 0..95, flat index across the yard. */
  index: number;
  /** 0..7 */
  block: number;
  /** 0..11 */
  slotInBlock: number;
  /** Slots are size-designated at build time; mixed-size stacking is never legal. */
  size: ContainerSize;
  /** [tier0 = ground, tier1 = top]. null === empty. */
  stack: [Container | null, Container | null];
}

export interface Yard {
  policy: PolicyId;
  slots: Slot[];
  /** Cumulative count of boxes shuffled to reach a buried box. */
  rehandles: number;
  /** Slot indices that took a rehandle during the step just executed (drives the red flash). */
  flashes: number[];
  /** Boxes that could not be placed this hour because the yard was full; retried next hour. */
  queue: Container[];
  placed: number;
  departed: number;
  /** Stacks made in violation of the LIFO rule because nothing better was free. */
  forcedStacks: number;
}

export interface SimConfig {
  seed: number;
  /** Poisson arrivals, containers per sim hour. */
  arrivalRatePerHour: number;
  /** Share of arrivals that are 40ft, 0..1. */
  fortyFootShare: number;
  /** Prediction accuracy, 0.50..0.95. Drives the magnitude of the dwell forecast error. */
  predictionAccuracy: number;
  /** Run length in sim days. */
  runDays: number;
}

export interface KpiSnapshot {
  rehandles: number;
  /** 4 min of reach-stacker time per rehandle. */
  moveMinutes: number;
  /** Occupied ground slots ÷ 96, as a percentage. */
  groundUtilizationPct: number;
  /** ₹450 per rehandle. */
  costRupees: number;
  occupied: number;
  twoHighStacks: number;
  queued: number;
  forcedStacks: number;
}

export interface HistoryPoint {
  hour: number;
  day: number;
  baseline: number;
  predictive: number;
}

export interface SimState {
  hour: number;
  config: SimConfig;
  rng: import("./rng").Rng;
  /** Monotonic counter behind container IDs. */
  seq: number;
  yards: Record<PolicyId, Yard>;
  history: HistoryPoint[];
  arrivalsTotal: number;
  done: boolean;
}
