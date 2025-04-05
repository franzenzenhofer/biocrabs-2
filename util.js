/**
 * util.js - Pure utility and math/geometry functions for BioCrabs simulation
 * Converted to modern ES6 module with arrow functions.
 */

export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export const rand = (min = 0, max = 1) => Math.random() * (max - min) + min;

/**
 * Generate polygon vertices in a regular pattern.
 */
export const getPolyVerts = (n, r, elong, orient) => {
  const arr = [];
  for (let i = 0; i < n; i++) {
    const angle = orient + (2 * Math.PI * i) / n;
    arr.push({
      x: r * Math.cos(angle),
      y: r * Math.sin(angle) * elong
    });
  }
  return arr;
};

/**
 * Find an attachment point on polygon edges given a fractional position.
 */
export const getAttach = (verts, frac) => {
  const edges = [];
  let total = 0;
  for (let i = 0; i < verts.length; i++) {
    const v1 = verts[i];
    const v2 = verts[(i + 1) % verts.length];
    const dx = v2.x - v1.x;
    const dy = v2.y - v1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    edges.push({ v1, v2, dist });
    total += dist;
  }
  const targ = frac * total;
  let acc = 0;
  for (const e of edges) {
    if (acc + e.dist >= targ) {
      const leftover = targ - acc;
      const portion = leftover / e.dist;
      return {
        x: e.v1.x + portion * (e.v2.x - e.v1.x),
        y: e.v1.y + portion * (e.v2.y - e.v1.y)
      };
    }
    acc += e.dist;
  }
  return verts[0];
};

/**
 * Get a gene value from a genotype with a fallback.
 * Ensures the returned value is a valid number.
 */
export const getGene = (genotype, gene, fallback = 1.0) => {
  const value = genotype?.[gene]; // Use optional chaining
  // Check if value exists, is a number, and is not NaN
  if (value !== undefined && typeof value === 'number' && !isNaN(value)) {
    return value;
  }
  // Otherwise, return the provided fallback value
  // Ensure fallback itself is a number, default to 0 if not
  return typeof fallback === 'number' && !isNaN(fallback) ? fallback : 0;
};

/**
 * Get a formatted gene value (rounded to 2 decimal places).
 */
export const getFormattedGene = (genotype, gene, fallback = 1.0) => {
  const value = getGene(genotype, gene, fallback);
  return Math.round(value * 100) / 100;
};

/** Pulsating effect using squared sine (always positive) */
export const pulsePositive = (time, frequency = 1, amplitude = 0.1, base = 1, phase = 0) => {
    return base + amplitude * Math.sin(time * frequency + phase) ** 2;
};

/** Smooth interpolation (e.g., for fading) - linear */
export const lerp = (start, end, factor) => {
    // Ensure factor is clamped between 0 and 1 before interpolating
    const clampedFactor = Math.max(0, Math.min(1, factor));
    return start + (end - start) * clampedFactor;
};

/** Calculate crab breathing factor */
export const getCrabBreathingFactor = (time) => 1.0 + 0.03 * Math.sin(time * 0.8);
