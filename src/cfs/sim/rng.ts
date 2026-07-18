/**
 * Seeded pseudo-random number generation for the yard digital twin.
 *
 * Every stochastic draw in the simulator flows through a single `Rng` instance
 * created from the user-supplied seed. Given the same seed and the same config,
 * the entire 30-day run is bit-for-bit reproducible — which is the property the
 * demo advertises in the UI and the property the unit tests assert.
 *
 * Algorithm: mulberry32. Chosen because it is 32-bit, dependency-free, has a
 * 2^32 period (far beyond the ~10^4 draws a 30-day run needs) and passes
 * gjrand's basic test battery — adequate for queueing simulation, not for
 * cryptography.
 */

export class Rng {
  private s: number;

  constructor(seed: number) {
    // Force to uint32; seed 0 is degenerate for mulberry32, so nudge it.
    this.s = (seed >>> 0) || 0x9e3779b9;
  }

  /** Uniform on [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Standard normal via Box–Muller (polar form avoids trig). */
  normal(): number {
    let u = 0;
    let v = 0;
    let sq = 0;
    do {
      u = this.next() * 2 - 1;
      v = this.next() * 2 - 1;
      sq = u * u + v * v;
    } while (sq === 0 || sq >= 1);
    return u * Math.sqrt((-2 * Math.log(sq)) / sq);
  }

  /**
   * Log-normal with a specified arithmetic `mean` and log-space shape `sigma`.
   * mu is back-solved as ln(mean) − sigma²/2 so that E[X] === mean exactly.
   */
  logNormal(mean: number, sigma: number): number {
    const mu = Math.log(mean) - (sigma * sigma) / 2;
    return Math.exp(mu + sigma * this.normal());
  }

  /** Poisson count via Knuth's product method — fine for the small lambdas here. */
  poisson(lambda: number): number {
    if (lambda <= 0) return 0;
    const limit = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= this.next();
    } while (p > limit);
    return k - 1;
  }

  /** Pick an index from a weight vector (weights need not be normalised). */
  weightedIndex(weights: number[]): number {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r < 0) return i;
    }
    return weights.length - 1;
  }

  /** Deep copy, so a state snapshot can be advanced without disturbing the original. */
  clone(): Rng {
    const c = new Rng(1);
    c.s = this.s;
    return c;
  }
}
