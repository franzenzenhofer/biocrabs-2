/**
 * util.js - Pure utility functions for BioCrabs simulation
 */
"use strict";

/**
 * Helper: Start a polygon path from a set of vertices 
 * and close it automatically.
 */
function beginPolygonPath(ctx, vertices) {
  ctx.beginPath();
  ctx.moveTo(vertices[0].x, vertices[0].y);
  for (let i = 1; i < vertices.length; i++) {
    ctx.lineTo(vertices[i].x, vertices[i].y);
  }
  ctx.closePath();
}

/**
 * Helper: Create a radial gradient with an array of color stops.
 * Each stop: { offset: number, color: string }
 */
function createRadialGradient(ctx, x, y, innerR, outerR, stops) {
  const grad = ctx.createRadialGradient(x, y, innerR, x, y, outerR);
  stops.forEach(stop => {
    grad.addColorStop(stop.offset, stop.color);
  });
  return grad;
}

/**
 * Helper: Fill an arc with a specified gradient.
 * This avoids repeating the same beginPath/arc/fill pattern.
 */
function fillArcWithGradient(ctx, x, y, radius, gradient) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
}

/**
 * Helper: Fill a polygon from the given vertices using a fillStyle.
 */
function fillPolygon(ctx, vertices, fillStyle) {
  beginPolygonPath(ctx, vertices);
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

/**
 * Helper: Stroke a polygon from the given vertices using a strokeStyle/lineWidth.
 */
function strokePolygon(ctx, vertices, strokeStyle, lineWidth = 1) {
  beginPolygonPath(ctx, vertices);
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = strokeStyle;
  ctx.stroke();
}

/**
 * Create a visual effect at collision point
 */
function createCollisionEffect(x, y, intensity, elasticity, options = {}) {
  // --- Validation for finite inputs (NEW) ---
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(intensity) || !Number.isFinite(elasticity)) { // Also check elasticity
    console.warn("createCollisionEffect called with non-finite values:", {x, y, intensity, elasticity});
    return; // Prevent creating effect with bad values
  }
  // --- End Validation ---

  const minIntensity = 0.2;
  // Intensity check needs to happen *after* validation
  if (intensity < minIntensity) return;

  // Extract options with defaults
  const { duration: customDuration, color: customColor, type: customType } = options;

  const size = Math.min(30, 5 + intensity * 3);
  
  // --- KISS: Calculate and Validate Lifespan (NEW) ---
  const baseLifespan = Math.min(1.0, 0.3 + intensity * 0.04 + elasticity * 0.2);
  let calculatedLifespan = baseLifespan;
  // Use customDuration only if it's a valid, positive number
  if (customDuration !== undefined && Number.isFinite(customDuration) && customDuration > 0) {
    calculatedLifespan = customDuration;
  } 
  // Final safety check for the lifespan value to be used
  if (!Number.isFinite(calculatedLifespan) || calculatedLifespan <= 0) {
      console.warn("Invalid lifespan calculated in createCollisionEffect, using default:", calculatedLifespan);
      calculatedLifespan = 0.5; // Use a reasonable default if calculation failed
  }
  const lifespan = calculatedLifespan;
  // --- End Lifespan Calculation/Validation ---

  // --- KISS: Handle dedicated effect types first ---
  if (customType === 'spawn') {
    collisionEffects.push({ 
      x, y, type: 'spawn', life: lifespan * 1.5, maxLife: lifespan * 1.5, // Longer duration
      size: 5, maxSize: 30, // Slightly larger max size
      color: customColor || 'rgba(100, 255, 100, 0.9)' 
    });
    return; // Handled specific type
  }
  if (customType === 'death') {
    collisionEffects.push({ 
      x, y, type: 'death', life: lifespan * 1.5, maxLife: lifespan * 1.5, // Longer duration
      size: 25, minSize: 2, // Slightly larger start size
      color: customColor || 'rgba(255, 100, 100, 0.8)'
    });
    return; // Handled specific type
  }
   if (customType === 'cull') {
    collisionEffects.push({ 
      x, y, type: 'cull', life: lifespan, maxLife: lifespan, size: 15,
      color: customColor || 'rgba(150, 150, 150, 0.7)' 
    });
    return; // Handled specific type
  }
  // --- End dedicated type handling ---

  // Particle effect (common to most OTHER collisions)
  if (customType !== 'death') { // Example: maybe skip particles on death?
      const particleCount = Math.floor(3 + intensity * 0.5);
      for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 2 * intensity;
        const particleSize = 2 + Math.random() * 3;
        const lifetime = Math.max(0.01, lifespan * (0.5 + Math.random() * 0.5));

        collisionEffects.push({ // Access global directly
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: particleSize,
          life: lifetime,
          maxLife: lifetime,
          type: 'particle',
          color: customColor // Allow particles to inherit color
        });
      }
  }

  // Ripple wave (adjust appearance based on type?)
  if (customType !== 'spawn') { // Example: maybe skip ripple on spawn?
      collisionEffects.push({ // Access global directly
        x, y,
        size: size * 0.5,
        maxSize: size * 3,
        life: lifespan, 
        maxLife: lifespan,
        type: 'ripple',
        intensity, 
        elasticity,
        color: customColor
      });
  }

  // Flash (adjust appearance based on type?)
  collisionEffects.push({ // Access global directly
    x, y,
    size, 
    life: lifespan * 0.3, 
    maxLife: lifespan * 0.3,
    type: 'flash',
    intensity,
    color: customColor
  });
}

/**
 * Update and draw collision effects
 */
function updateCollisionEffects(ctx, timeStep) { // Removed collisionEffects argument
  // --- Pre-loop setup --- 
  ctx.save(); // Save context state once before looping

  for (let i = collisionEffects.length - 1; i >= 0; i--) {
    const effect = collisionEffects[i]; // Access global directly
    effect.life -= timeStep;
    
    if (effect.life <= 0) {
      collisionEffects.splice(i, 1);
      continue;
    }
    
    if (effect.type === 'particle') {
      effect.x += effect.vx * timeStep;
      effect.y += effect.vy * timeStep;
      effect.vx *= 0.95;
      effect.vy *= 0.95;
    } 
    if (effect.type === 'ripple') {
      effect.size += (effect.maxSize - effect.size) * timeStep * 3;
    }

    // --- KISS: Validate effect properties before drawing (NEW) ---
    if (!Number.isFinite(effect.x) || !Number.isFinite(effect.y) || !Number.isFinite(effect.size)) {
        // console.warn("Skipping drawing effect with non-finite properties:", effect); // Optional: for debugging
        continue; // Skip this effect entirely if position or size is invalid
    }
    // --- End Validation ---

    const lifeFactor = effect.life / effect.maxLife;

    // --- KISS: Validate lifeFactor before drawing (NEW) ---
    if (!Number.isFinite(lifeFactor) || lifeFactor < 0 || lifeFactor > 1) { // Added range check
        // console.warn("Skipping drawing effect with invalid lifeFactor:", lifeFactor, effect);
        collisionEffects.splice(i, 1); // Remove invalid effect
        continue; // Skip if life calculation is invalid
    }
    // --- End Validation ---

    const effectColor = effect.color || 'rgba(255, 255, 255, 1)'; // Default to white if no color
    
    // --- KISS: Handle Dedicated Effect Types ---
    if (effect.type === 'spawn') {
        const currentSize = effect.size + (effect.maxSize - effect.size) * (1 - lifeFactor); // Expands
        const alpha = lifeFactor;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, currentSize, 0, Math.PI * 2);
        ctx.strokeStyle = effect.color.replace(/,[^,)]+\)$/, `, ${alpha})`); // Use base color with fading alpha
        ctx.lineWidth = 4 * lifeFactor; // Thicker line
        ctx.stroke();
    } else if (effect.type === 'death') {
        const currentSize = effect.minSize + (effect.size - effect.minSize) * lifeFactor; // Shrinks
        const alpha = lifeFactor;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, currentSize, 0, Math.PI * 2);
        ctx.fillStyle = effect.color.replace(/,[^,)]+\)$/, `, ${alpha * 0.7})`); // Use base color with fading alpha (slightly transparent fill)
        ctx.fill();
        ctx.strokeStyle = effect.color.replace(/,[^,)]+\)$/, `, ${alpha})`); 
        ctx.lineWidth = 3; // Thicker line
        ctx.stroke();
    } else if (effect.type === 'cull') {
         const alpha = lifeFactor;
         ctx.beginPath();
         ctx.arc(effect.x, effect.y, effect.size * lifeFactor, 0, Math.PI * 2); // Fades and shrinks slightly
         ctx.fillStyle = effect.color.replace(/,[^,)]+\)$/, `, ${alpha * 0.5})`); 
         ctx.fill();
    } 
    // --- Handle Generic Collision Effects (Particles, Ripple, Flash) ---
    else if (effect.type === 'particle') {
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, effect.size * lifeFactor, 0, Math.PI * 2);
      // Use effectColor for particles, adjusting alpha
      const particleAlpha = lifeFactor * (effectColor.startsWith('rgba') ? parseFloat(effectColor.split(',')[3] || '1') : 0.7);
      const particleColor = effectColor.startsWith('rgba') ? effectColor.replace(/,\s*[^,)]+\)$/, `, ${particleAlpha})`) : `rgba(255,255,255, ${particleAlpha})`;
      ctx.fillStyle = particleColor;
      ctx.fill();
    } 
    else if (effect.type === 'ripple') {
      const gradient = ctx.createRadialGradient(
        effect.x, effect.y, 0,
        effect.x, effect.y, effect.size
      );
      // Use effectColor for ripple if available, otherwise default hue logic
      if (effect.color) {
          const [r, g, b, baseA] = effect.color.match(/\d+|\.\d+/g).map(Number);
          const alpha = lifeFactor * (baseA !== undefined ? baseA : 0.3);
          gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
          gradient.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, ${alpha * 0.6})`);
          gradient.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, ${alpha * 0.3})`);
          gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      } else {
          const hue = 180 + 40 * (effect.elasticity - 1);
          gradient.addColorStop(0, `hsla(${hue}, 80%, 70%, 0)`);
          gradient.addColorStop(0.3, `hsla(${hue}, 80%, 70%, ${lifeFactor * 0.2})`);
          gradient.addColorStop(0.7, `hsla(${hue}, 70%, 60%, ${lifeFactor * 0.1})`);
          gradient.addColorStop(1, `hsla(${hue}, 60%, 50%, 0)`);
      }
      
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, effect.size, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Stroke using similar color logic
      if (effect.color) {
         const [r, g, b, baseA] = effect.color.match(/\d+|\.\d+/g).map(Number);
         const strokeAlpha = lifeFactor * (baseA !== undefined ? baseA : 0.3);
         ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${strokeAlpha})`;
      } else {
         const hue = 180 + 40 * (effect.elasticity - 1);
         ctx.strokeStyle = `hsla(${hue}, 80%, 70%, ${lifeFactor * 0.3})`;
      }
      ctx.lineWidth = 1;
      ctx.stroke();
    } 
    else if (effect.type === 'flash') {
      const gradient = ctx.createRadialGradient(
        effect.x, effect.y, 0,
        effect.x, effect.y, effect.size
      );
      // Use effectColor for flash if available
      if (effect.color) {
          const [r, g, b, baseA] = effect.color.match(/\d+|\.\d+/g).map(Number);
          const alpha = lifeFactor * (baseA !== undefined ? baseA : 0.8);
          gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
          gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${alpha * 0.5})`);
          gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      } else {
          gradient.addColorStop(0, `rgba(255, 255, 255, ${lifeFactor * 0.8})`);
          gradient.addColorStop(0.5, `rgba(200, 220, 255, ${lifeFactor * 0.4})`);
          gradient.addColorStop(1, `rgba(150, 180, 255, 0)`);
      }

      ctx.beginPath();
      ctx.arc(effect.x, effect.y, effect.size, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    }
  }
  ctx.restore(); // Restore context state once after looping
}

/**
 * Utility functions collection
 */
const Utils = {
  /**
   * Clamp a value between a minimum and maximum
   */
  clamp(x, lo, hi) { 
    return Math.max(lo, Math.min(hi, x)); 
  },
  
  /**
   * Generate a random number between min and max
   */
  rand(min = 0, max = 1) { 
    return Math.random() * (max - min) + min; 
  },
  
  /**
   * Create a child genotype by crossing over two parent genotypes
   */
  crossover(a, b, GENE) { 
    let child = [];
    for (let i = 0; i < a.length; i++) {
      child[i] = Math.random() < 0.5 ? a[i] : b[i];
    }
    // Handle color genes separately
    child[GENE.COLOR_R] = Math.random() < 0.5 ? a[GENE.COLOR_R] : b[GENE.COLOR_R];
    child[GENE.COLOR_G] = Math.random() < 0.5 ? a[GENE.COLOR_G] : b[GENE.COLOR_G];
    child[GENE.COLOR_B] = Math.random() < 0.5 ? a[GENE.COLOR_B] : b[GENE.COLOR_B];
    return child;
  },

  /**
   * Generate polygon vertices in a regular pattern
   */
  getPolyVerts(n, r, elong, orient) {
    let arr = [];
    for (let i = 0; i < n; i++) {
      let angle = orient + 2 * Math.PI * (i / n);
      arr.push({ 
        x: r * Math.cos(angle), 
        y: r * Math.sin(angle) * elong 
      });
    }
    return arr;
  },
  
  /**
   * Find an attachment point on polygon edges given a fractional position
   */
  getAttach(verts, frac) {
    let edges = [], total = 0;
    for (let i = 0; i < verts.length; i++) {
      let v1 = verts[i], v2 = verts[(i + 1) % verts.length];
      let dx = v2.x - v1.x, dy = v2.y - v1.y;
      let dist = Math.sqrt(dx * dx + dy * dy);
      edges.push({v1, v2, dist});
      total += dist;
    }
    let targ = frac * total, acc = 0;
    for (let e of edges) {
      if (acc + e.dist >= targ) {
        let leftover = targ - acc;
        let portion = leftover / e.dist;
        return {
          x: e.v1.x + portion * (e.v2.x - e.v1.x),
          y: e.v1.y + portion * (e.v2.y - e.v1.y)
        };
      }
      acc += e.dist;
    }
    return verts[0];
  },
  
  /**
   * Get a gene value from a genotype with fallback value
   */
  getGene(genotype, gene, fallback = 1.0) {
    return genotype[gene] !== undefined ? genotype[gene] : fallback;
  },
  
  /**
   * Get a formatted gene value (rounded to 2 decimal places)
   */
  getFormattedGene(genotype, gene, fallback = 1.0) {
    const value = this.getGene(genotype, gene, fallback);
    return Math.round(value * 100) / 100;
  }
};

/**
 * Create a random genotype with valid gene values
 */
function createRandomGenotype(CONFIG, GENE) {
  const LC = CONFIG.LIMB_COUNT;
  let g = [];
  const geneCount = 3 + (LC * 5) + 2 + LC + 1 + 2 + 3 + 1 + 5;

  // Initialize array
  for (let i = 0; i < geneCount; i++) {
    g[i] = 0;
  }

  // Body genes
  g[GENE.RADIUS] = Utils.rand(15, 30);
  g[GENE.ELONGATION] = Utils.rand(0.7, 1.3);
  g[GENE.ORIENT] = Utils.rand(0, 2 * Math.PI);

  // Limb genes
  for (let i = 0; i < LC; i++) {
    let base = 3 + i * 5;
    g[base] = Utils.rand(0, 2 * Math.PI);
    g[base + 1] = Utils.rand(10, 40);
    g[base + 2] = Utils.rand(0.1, 0.7);
    g[base + 3] = Utils.rand(0.5, 0.9);
    g[base + 4] = Utils.rand(0, 2 * Math.PI);
  }
  
  // Frequency and amplitude
  g[GENE.FREQ] = Utils.rand(1, 3);
  g[GENE.AMP] = Utils.rand(0.2, 1);

  // Attach fraction
  for (let i = 0; i < LC; i++) {
    g[45 + i] = Math.random();
  }
  
  // Shape and symmetry
  g[GENE.SIDES] = Math.floor(Utils.rand(3, 9));
  g[GENE.BODY_SYM] = Utils.rand(0, 0.4);
  g[GENE.MOVE_SYM] = 0;
  
  // Color
  g[GENE.COLOR_R] = Utils.rand(0, 255);
  g[GENE.COLOR_G] = Utils.rand(0, 255);
  g[GENE.COLOR_B] = Utils.rand(0, 255);
  
  // Energy
  g[GENE.ENERGY] = Utils.rand(0, 10);
  
  // Physical traits
  g[GENE.DRAG_MOD] = Utils.rand(0.5, 1.5);
  g[GENE.ROT_DRAG_MOD] = Utils.rand(0.7, 1.3);
  g[GENE.ELASTICITY] = Utils.rand(0.8, 1.2);
  g[GENE.TORQUE_EFF] = Utils.rand(0.8, 1.2);
  g[GENE.POWER_RATIO] = Utils.rand(0.8, 1.5);

  return g;
}

/**
 * Apply mutations to a genotype
 */
function mutate(g, CONFIG, GENE) {
  const LC = CONFIG.LIMB_COUNT;
  const mutationRate = CONFIG.MUTATION_RATE;
  
  for (let i = 0; i < g.length; i++) {
    if (Math.random() < mutationRate) {
      // Color genes can change more dramatically
      if (i === GENE.COLOR_R || i === GENE.COLOR_G || i === GENE.COLOR_B) {
        g[i] += Utils.rand(-50, 50);
      } else {
        g[i] *= (1 + Utils.rand(-0.2, 0.2));
      }
    }
  }
  
  // Clamps
  g[GENE.SIDES] = Utils.clamp(Math.round(g[GENE.SIDES]), 3, 8);
  g[GENE.BODY_SYM] = Utils.clamp(g[GENE.BODY_SYM], 0, 1);
  g[GENE.MOVE_SYM] = Utils.clamp(g[GENE.MOVE_SYM], 0, 1);
  g[GENE.COLOR_R] = Utils.clamp(g[GENE.COLOR_R], 0, 255);
  g[GENE.COLOR_G] = Utils.clamp(g[GENE.COLOR_G], 0, 255);
  g[GENE.COLOR_B] = Utils.clamp(g[GENE.COLOR_B], 0, 255);
  g[GENE.ENERGY] = Utils.clamp(g[GENE.ENERGY], 0, 10);
  
  g[GENE.DRAG_MOD] = Utils.clamp(g[GENE.DRAG_MOD], 0.5, 1.5);
  g[GENE.ROT_DRAG_MOD] = Utils.clamp(g[GENE.ROT_DRAG_MOD], 0.7, 1.3);
  g[GENE.ELASTICITY] = Utils.clamp(g[GENE.ELASTICITY], 0.8, 1.2);
  g[GENE.TORQUE_EFF] = Utils.clamp(g[GENE.TORQUE_EFF], 0.8, 1.2);
  g[GENE.POWER_RATIO] = Utils.clamp(g[GENE.POWER_RATIO], 0.8, 1.5);

  g[GENE.FREQ] = Math.max(g[GENE.FREQ], 1);
  g[GENE.AMP] = Math.max(g[GENE.AMP], 0.5);

  for (let i = 0; i < LC; i++) {
    let base = 3 + i * 5;
    g[base + 1] = Math.max(g[base + 1], 1);
    g[base + 2] = Utils.clamp(g[base + 2], 0.05, 1);
    g[base + 3] = Utils.clamp(g[base + 3], 0.1, 0.95);
  }
  
  return g; // Return the mutated genotype
}

/**
 * Apply body symmetry to a genotype
 */
function applyBodySymmetry(g, CONFIG, GENE) {
  const LC = CONFIG.LIMB_COUNT;
  let sf = Utils.clamp(g[GENE.BODY_SYM], 0, 1);
  if (sf <= 0) return g;
  
  let half = LC / 2;
  for (let i = 0; i < half; i++) {
    let L = 3 + i * 5, R = 3 + (i + half) * 5;
    let lAng = g[L];
    let lLen = g[L + 1];
    let lBrA = g[L + 2];
    let lRat = g[L + 3];
    let rAng = g[R];
    let rLen = g[R + 1];
    let rBrA = g[R + 2];
    let rRat = g[R + 3];
    let lMir = -lAng;
    
    g[R]   = sf * lMir + (1 - sf) * rAng;
    g[R+1] = sf * lLen + (1 - sf) * rLen;
    g[R+2] = sf * lBrA + (1 - sf) * rBrA;
    g[R+3] = sf * lRat + (1 - sf) * rRat;

    let la = g[45 + i], ra = g[45 + (i + half)];
    let laMir = 1 - la;
    g[45 + (i + half)] = sf * laMir + (1 - sf) * ra;
  }
  
  return g; // Return the modified genotype
}

/**
 * Apply movement symmetry to a genotype
 */
function applyMovementSymmetry(g, CONFIG, GENE) {
  const LC = CONFIG.LIMB_COUNT;
  let msf = Utils.clamp(g[GENE.MOVE_SYM], 0, 1);
  if (msf <= 0) return g;
  
  let half = LC / 2;
  for (let i = 0; i < half; i++) {
    let L = 3 + i * 5, R = 3 + (i + half) * 5;
    let lPh = g[L + 4], rPh = g[R + 4];
    g[R + 4] = msf * lPh + (1 - msf) * rPh;
  }
  
  return g; // Return the modified genotype
}

/**
 * Get a symmetric version of a genotype
 */
function getSymmetricGenotype(orig, CONFIG, GENE) {
  let copy = orig.slice();
  applyBodySymmetry(copy, CONFIG, GENE);
  applyMovementSymmetry(copy, CONFIG, GENE);
  return copy;
}

// Export all utilities for use in main file
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    beginPolygonPath,
    createRadialGradient,
    fillArcWithGradient,
    fillPolygon,
    strokePolygon,
    createCollisionEffect,
    updateCollisionEffects,
    Utils,
    createRandomGenotype,
    mutate,
    applyBodySymmetry,
    applyMovementSymmetry,
    getSymmetricGenotype
  };
} else {
  // Browser exports - consistently make functions available under the Utils namespace
  // Ensures Utils object exists (might be created by another script loaded earlier)
  window.Utils = window.Utils || Utils; 
  window.Utils.beginPolygonPath = beginPolygonPath;
  window.Utils.createRadialGradient = createRadialGradient;
  window.Utils.fillArcWithGradient = fillArcWithGradient;
  window.Utils.fillPolygon = fillPolygon;
  window.Utils.strokePolygon = strokePolygon;
  window.Utils.createCollisionEffect = createCollisionEffect; // Re-add export
  window.Utils.updateCollisionEffects = updateCollisionEffects;
  window.Utils.createRandomGenotype = createRandomGenotype;
  // Note: mutate is exported from reproduction.js
  window.Utils.applyBodySymmetry = applyBodySymmetry;
  window.Utils.applyMovementSymmetry = applyMovementSymmetry;
  window.Utils.getSymmetricGenotype = getSymmetricGenotype;
} 