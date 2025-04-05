/**
 * animations.js - Handles visual animations and effects over time.
 */

import { clamp, lerp } from './util.js'; // Make sure clamp and lerp are imported

// --- Collision Effects System ---

/**
 * Global array of collisionEffects.
 */
export let collisionEffects = [];

/**
 * Create a visual effect at a point, pushing to `collisionEffects`.
 * Moved from drawing.js
 */
export const createCollisionEffect = (
  // effects array is now the module-scoped collisionEffects
  x,
  y,
  intensity,
  elasticity,
  options = {}
) => {
  // --- Strict Input Validation --- START
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(intensity) ||
    !Number.isFinite(elasticity)
  ) {
    console.warn('createCollisionEffect called with non-finite numeric values:', {
      x,
      y,
      intensity,
      elasticity
    });
    return; // Do not create effect if inputs are invalid
  }
  // Prevent excessively large values which might cause issues downstream
  const maxIntensity = 1000; // Example limit
  const safeIntensity = Math.min(intensity, maxIntensity);
  // --- Strict Input Validation --- END

  const minIntensity = 0.2;
  if (safeIntensity < minIntensity) return; // Use safeIntensity

  const { duration: customDuration, color: customColor, type: customType } = options;
  const size = Math.min(30, 5 + safeIntensity * 3); // Use safeIntensity

  // Lifespan calculation
  const baseLifespan = Math.min(1.0, 0.3 + safeIntensity * 0.04 + elasticity * 0.2); // Use safeIntensity
  let calculatedLifespan = baseLifespan;
  if (customDuration !== undefined && Number.isFinite(customDuration) && customDuration > 0) {
    calculatedLifespan = customDuration;
  }
  if (!Number.isFinite(calculatedLifespan) || calculatedLifespan <= 0) {
    console.warn('Invalid lifespan calculated, using default:', calculatedLifespan);
    calculatedLifespan = 0.5;
  }
  const lifespan = calculatedLifespan;

  // Particle effect (common for "most" collisions)
  // --- OPTIMIZATION: Reduce particle count for performance ---
  // Original: const particleCount = Math.floor(3 + safeIntensity * 0.5);
  // Use a smaller multiplier to reduce the number of particles
  const particleCount = Math.floor(2 + safeIntensity * 0.3); 
  // --- END OPTIMIZATION ---
  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 2 * safeIntensity; // Use safeIntensity
    const particleSize = 2 + Math.random() * 3;
    const pLifetime = Math.max(0.01, lifespan * (0.5 + Math.random() * 0.5));
    // Push to the module-scoped array
    collisionEffects.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: particleSize,
      life: pLifetime,
      maxLife: pLifetime,
      type: 'particle',
      color: customColor
    });
  }

  // Ripple wave
  collisionEffects.push({
    x,
    y,
    // --- OPTIMIZATION: Reduce ripple size for performance ---
    // Original: size: size * 0.5, maxSize: size * 3
    // Use smaller multipliers to reduce the visual complexity
    size: size * 0.4,
    maxSize: size * 2.5,
    // --- END OPTIMIZATION ---
    life: lifespan,
    maxLife: lifespan,
    type: 'ripple',
    intensity: safeIntensity, // Store safeIntensity
    elasticity,
    color: customColor
  });

  // Flash
  collisionEffects.push({
    x,
    y,
    size,
    life: lifespan * 0.3,
    maxLife: lifespan * 0.3,
    type: 'flash',
    intensity: safeIntensity, // Store safeIntensity
    color: customColor
  });
};

/**
 * Update and draw collision effects.
 * Moved from drawing.js
 */
export const updateCollisionEffects = (ctx, timeStep) => {
   // Effects array is the module-scoped collisionEffects
  ctx.save(); // Save global context state

  // Loop backward for safe splicing
  for (let i = collisionEffects.length - 1; i >= 0; i--) {
    const effect = collisionEffects[i];

    // Basic check if effect object itself is valid before accessing properties
    if (!effect || typeof effect !== 'object') {
        console.warn('Invalid item found in effects array, removing:', effect);
        collisionEffects.splice(i, 1);
        continue;
    }

    // Check required properties exist before using them
    if (effect.life === undefined || effect.maxLife === undefined) {
         console.warn('Effect missing life/maxLife, removing:', effect);
         collisionEffects.splice(i, 1);
         continue;
    }

    effect.life -= timeStep;

    // Remove if expired
    if (effect.life <= 0) {
      collisionEffects.splice(i, 1);
      continue;
    }

    // Calculate fade factor based on remaining life
    const lifeFactor = clamp(effect.life / effect.maxLife, 0, 1);

    // --- Add validation for potentially missing properties used in updates/drawing --- START
    if (effect.type === 'particle') {
        if (!Number.isFinite(effect.x) || !Number.isFinite(effect.y) || !Number.isFinite(effect.vx) || !Number.isFinite(effect.vy)) {
            console.warn('Invalid particle state, removing:', effect);
            collisionEffects.splice(i, 1);
            continue;
        }
        effect.x += effect.vx * timeStep;
        effect.y += effect.vy * timeStep;
        // Apply simple drag/friction
        effect.vx *= 0.95;
        effect.vy *= 0.95;
    } else if (effect.type === 'ripple') {
        if (!Number.isFinite(effect.size) || !Number.isFinite(effect.maxSize)) {
            console.warn('Invalid ripple state, removing:', effect);
            collisionEffects.splice(i, 1);
            continue;
        }
        // Expand ripple towards max size
        effect.size += (effect.maxSize - effect.size) * timeStep * 3;
    } else if (effect.type === 'flash') {
         if (!Number.isFinite(effect.size)) {
            console.warn('Invalid flash state, removing:', effect);
            collisionEffects.splice(i, 1);
            continue;
        }
        // Flash doesn't have position/size updates in this loop
    } else {
        // Handle potential unknown types or types missing updates gracefully
        if (!Number.isFinite(effect.x) || !Number.isFinite(effect.y) || !Number.isFinite(effect.size)) {
             console.warn('Invalid unknown/fallback effect state, removing:', effect);
             collisionEffects.splice(i, 1);
             continue;
        }
    }
    // --- Add validation for potentially missing properties used in updates/drawing --- END

    // --- Start Drawing Specific Effect ---
    ctx.save(); // Save context for this specific effect

    // Set the base color (fallback to white if not specified)
    const effectColor = effect.color || 'white';

    // Apply global alpha based on lifeFactor (base fade)
    ctx.globalAlpha = lifeFactor;

    // Draw based on effect type
    switch (effect.type) {
      case 'particle': {
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, Math.max(0.5, effect.size * lifeFactor), 0, Math.PI * 2);
        ctx.fillStyle = effectColor;
        ctx.fill();
        break;
      }
      case 'ripple': {
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.size, 0, Math.PI * 2);
        ctx.strokeStyle = effectColor;
        ctx.globalAlpha = lifeFactor * 0.5;
        ctx.lineWidth = Math.max(0.5, 1.5);
        ctx.stroke();
        break;
      }
      case 'flash': {
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.size, 0, Math.PI * 2);
        ctx.globalAlpha = lifeFactor * lifeFactor; // Example: Fade quadratically
        ctx.fillStyle = effectColor;
        ctx.fill();
        break;
      }
      default: {
        console.warn('Unknown effect type:', effect.type);
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.size, 0, Math.PI * 2);
        ctx.fillStyle = effectColor;
        ctx.fill();
        break;
      }
    }

    ctx.restore(); // Restore context after drawing this effect
  }

  ctx.restore(); // Restore global context state
};

// --- Animation Helper Functions ---

/** Simple sine wave oscillation */
export const oscillate = (time, frequency = 1, amplitude = 1, phase = 0) => {
    return amplitude * Math.sin(time * frequency + phase);
};

/** Pulsating effect, often 0-1 range */
export const pulse = (time, frequency = 1, amplitude = 0.1, base = 1, phase = 0) => {
    return base + amplitude * Math.sin(time * frequency + phase);
};

/** Pulsating effect using squared sine (always positive) */
export const pulsePositive = (time, frequency = 1, amplitude = 0.1, base = 1, phase = 0) => {
    return base + amplitude * Math.sin(time * frequency + phase) ** 2;
};

/** Calculate crab breathing factor */
export const getCrabBreathingFactor = (time) => 1.0 + 0.03 * Math.sin(time * 0.8);

/** Calculate crab wobble factor */
export const getCrabWobbleFactor = (time) => 0.02 * Math.sin(time * 1.2);

/** Calculate crab body rotation offset */
export const getCrabBodyRotationOffset = (time) => 0.07 * Math.sin(time * 0.5);

/** Calculate crab eye pulse factor */
export const getCrabEyePulse = (time) => 1 + 0.15 * Math.sin(time * 2);

/** Calculate selection highlight pulse rate */
export const getSelectionPulseRate = (time) => 0.7 + 0.3 * Math.sin(time * 2);

/** Calculate selection highlight dash offset */
export const getSelectionDashOffset = (time, dashLength, dashGap) => {
    return (time * 30) % (dashLength + dashGap);
};

/** Calculate gravity center primary pulse */
export const getGravityCenterPrimaryPulse = (time, visualPulseConfig) => 1 + 0.12 * Math.sin(time * visualPulseConfig);

/** Calculate gravity center secondary pulse */
export const getGravityCenterSecondaryPulse = (time, visualPulseConfig) => 1 + 0.08 * Math.sin(time * visualPulseConfig * 1.5);

/** Calculate gravity center layer rotation offset */
export const getGravityCenterLayerRotation = (time, layerIndex) => time * 0.05 * (layerIndex % 2 === 0 ? 1 : -1);

/** Calculate gravity center wavy radius */
export const getGravityCenterWavyRadius = (baseRadius, angle, time) => baseRadius * (1 + 0.04 * Math.sin(angle * 6 + time * 0.2));

/** Calculate gravity center core hue */
export const getGravityCenterHue = (time) => 220 + Math.sin(time * 0.1) * 15;

/** Calculate nebula ray intensity */
export const getNebulaRayIntensity = (time, rayIndex) => 0.02 + 0.015 * Math.sin(time * 0.1 + rayIndex);

/** Calculate nebula wave y-offset */
export const getNebulaWaveY = (x, W, time) => {
    const primaryWave = 10 * Math.sin((x / W) * Math.PI * 6 + time * 0.5);
    const secondaryWave = 5 * Math.sin((x / W) * Math.PI * 12 + time * 0.7);
    return primaryWave + secondaryWave;
};

/** Calculate nebula floating particle properties */
export const getNebulaParticleProps = (index, count, W, H, time) => {
    const x = W * ((index / count) + 0.2 * Math.sin(time * 0.02 + index));
    const y = H * ((index % 5) / 5 + 0.1 * Math.cos(time * 0.03 + index * 2));
    const size = Math.max(0.5, 1.5 + Math.sin(x * 0.01) + Math.cos(y * 0.01));
    const alpha = 0.02 + 0.01 * Math.sin(time * 0.1 + index);
    return { x, y, size, alpha };
};

/** Calculate water current particle properties */
export const getWaterCurrentParticleProps = (index, count, time, maxRadius) => {
    const orbitSpeed = 0.1 + (index % 5) * 0.02;
    const angle = (index / count) * Math.PI * 2 + time * orbitSpeed;
    const minRadius = maxRadius * 0.2;
    const radiusRange = maxRadius * 0.8;
    const orbitRadius =
      minRadius +
      radiusRange * ((Math.sin(time * 0.1 + index * 0.2) + 1) / 2);
    const wobble = Math.sin(time * 0.5 + index) * 5;
    const x = Math.cos(angle) * (orbitRadius + wobble);
    const y = Math.sin(angle) * (orbitRadius + wobble);
    const baseSize = 0.8 + Math.sin(time * 0.4 + index) * 0.5;
    const size = baseSize * (1 - (orbitRadius / maxRadius) * 0.5);
    const hue = (200 + (index * 10 + time * 5)) % 360;
    const alpha = 0.4 - (orbitRadius / maxRadius) * 0.3;
    return { x, y, size, hue, alpha };
};

// --- Life Cycle Effects System --- START OF BLOCK ---

/**
 * Global array for birth/death visual effects.
 */
export let lifeCycleEffects = [];

/**
 * Creates a visual effect signifying a crab birth (Reusing selection highlight).
 */
export const createBirthEffect = (x, y, radius, options = {}) => {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius) || radius <= 0) {
        console.warn('createBirthEffect called with invalid position or radius:', { x, y, radius });
        return;
    }

    const { duration = 2.5 } = options; // Increased duration to 2.5 seconds

    lifeCycleEffects.push({
        type: 'birth_highlight',
        x, y,
        radius: radius * 1.2, // Match the scaling used in selection
        life: duration,
        maxLife: duration,
        // Colors defined in updateLifeCycleEffects function (yellowish/white)
    });
};

/**
 * Creates a visual effect signifying a crab death (Grayscale Fade).
 * Needs the crab object itself to capture its state at the moment of death.
 */
export const createDeathEffect = (crab, GENE, getGene, options = {}) => {
    // --- Basic Crab Validation ---
    if (!crab || typeof crab !== 'object' || !crab.genotype || !Number.isFinite(crab.x) || !Number.isFinite(crab.y) || !GENE || !getGene) {
        console.warn('createDeathEffect called with invalid crab object or missing dependencies:', crab);
        return;
    }
    // --- Basic Crab Validation --- END

    const { duration = 10.0, fadeColor = 'rgba(100, 100, 100, 0.5)' } = options;

    // Get radius safely using the passed getGene function
    const radius = getGene(crab.genotype, GENE.RADIUS, 20); // Default 20 if gene access fails

    // Store necessary crab state for drawing the fading body
    lifeCycleEffects.push({
        type: 'death_fade',
        x: crab.x,
        y: crab.y,
        orientation: crab.orientation,
        genotype: [...crab.genotype], // Copy genotype
        life: duration,
        maxLife: duration,
        color: fadeColor, // Target fade color/alpha (Not directly used in draw, controls gray interpolation)
    });

     // Optional: Add subtle dissolving particles
    const particleCount = 8;
     for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 5 + Math.random() * 5; // Slow drift
        const particleSize = 0.5 + Math.random() * 1;
        const pLifetime = Math.max(0.1, duration * (0.4 + Math.random() * 0.4));
         lifeCycleEffects.push({
            type: 'death_particle',
            x: crab.x + Math.cos(angle) * radius * Math.random() * 0.5,
            y: crab.y + Math.sin(angle) * radius * Math.random() * 0.5,
            vx: Math.cos(angle) * speed * 0.5, // Slower speed
            vy: Math.sin(angle) * speed * 0.5,
            size: particleSize,
            life: pLifetime,
            maxLife: pLifetime,
            color: 'rgba(150, 150, 150, 0.6)', // Grayish particles
         });
     }
};

/**
 * Update and draw birth/death effects.
 */
// Pass dependencies explicitly: GENE enum, getGene function, getPolyVerts function
export const updateLifeCycleEffects = (ctx, timeStep, GENE, getGeneFn, getPolyVertsFn) => {
    // Use the passed functions (getGeneFn, getPolyVertsFn) instead of direct imports here
    if (!ctx || !Number.isFinite(timeStep) || !GENE || !getGeneFn || !getPolyVertsFn) {
        // console.warn("updateLifeCycleEffects called with missing dependencies."); // Avoid console spam
        return;
    }

    ctx.save(); // Save global state once

    // const globalTime = timeStep; // HACK: Need actual globalTime passed in ideally // Removed previous HACK
    // const globalTime = Date.now() / 1000; // Approximation if real globalTime isn't available // Removed fallback, rely on timeAlive for now

    for (let i = lifeCycleEffects.length - 1; i >= 0; i--) {
        const effect = lifeCycleEffects[i];

        // Basic validation
        // if (!effect || typeof effect !== 'object' || effect.life === undefined || effect.maxLife === undefined) { // Original check
        if (!effect || typeof effect !== 'object' || !Number.isFinite(effect.life) || !Number.isFinite(effect.maxLife)) { // Enhanced check
            // console.warn('Invalid item in lifeCycleEffects, removing:', effect); // Keep console spam low
            lifeCycleEffects.splice(i, 1);
            continue;
        }

        effect.life -= timeStep;

        if (effect.life <= 0) {
            lifeCycleEffects.splice(i, 1);
            continue;
        }

        const lifeFactor = clamp(effect.life / effect.maxLife, 0, 1); // 1 -> 0
        const timeAlive = effect.maxLife - effect.life; // Time elapsed for this effect

        ctx.save(); // Save context for this specific effect

        try { // Add try-catch around drawing logic for safety
            switch (effect.type) {
                // --- Birth Effects ---
                case 'birth_highlight': {
                    // if (!Number.isFinite(effect.x) || !Number.isFinite(effect.y) || !Number.isFinite(effect.radius)) { // Original check
                    if (!Number.isFinite(effect.x) || !Number.isFinite(effect.y) || !Number.isFinite(effect.radius) || effect.radius <= 0) { // Added radius > 0 check
                        console.warn('Invalid birth_highlight state, removing:', effect);
                        lifeCycleEffects.splice(i, 1);
                        break; // Go to ctx.restore()
                    }

                    // Define birth colors (e.g., yellowish/white)
                    const birthColors = {
                        glowInner: 'rgba(255, 255, 180, 0.5)', // Yellowish glow
                        glowMid: 'rgba(255, 255, 200, 0.3)',
                        glowOuter: 'rgba(255, 255, 220, 0)',
                        dashOuter: 'rgba(255, 255, 240, 0.9)', // White dashes
                        dashInner: 'rgba(255, 255, 255, 0.7)'
                    };

                    // Fade the effect out using globalAlpha
                    // ctx.globalAlpha = lifeFactor; // Original fade
                    ctx.globalAlpha = lifeFactor * lifeFactor; // Fade out faster maybe? Adjusted from just lifeFactor

                    // Call the reusable drawing function
                    // Pass globalTime for consistent pulse/dash animation
                    // Note: We don't have direct access to the main loop's globalTime here.
                    // Passing timeAlive instead will make pulse relative to effect start.
                    // Let's pass timeAlive for now, might need to refactor later if sync is crucial.
                    // Using timeAlive for pulse. If sync with global time is essential, globalTime needs to be passed down.
                    drawPulsingHighlight(ctx, effect.x, effect.y, effect.radius, timeAlive, birthColors);

                    // Reset globalAlpha potentially affected by drawPulsingHighlight if needed, though it uses save/restore
                    // ctx.globalAlpha = 1.0; // Unlikely needed due to save/restore in helper

                    break;
                }

                // --- Death Effects ---
                case 'death_fade': {
                    // --- Enhanced Validation --- START
                    // Validate necessary properties for drawing the crab shape
                    // if (!Number.isFinite(effect.x) || !Number.isFinite(effect.y) || !Number.isFinite(effect.orientation) || !effect.genotype || !Array.isArray(effect.genotype)) { // Original check
                    if (!Number.isFinite(effect.x) || !Number.isFinite(effect.y) || !Number.isFinite(effect.orientation) || !effect.genotype || !Array.isArray(effect.genotype)) {
                         console.warn('Invalid death_fade state (basic props), removing:', effect);
                         lifeCycleEffects.splice(i, 1);
                         break; // Go to ctx.restore()
                     }
                     // Check dependencies passed to outer function are available here
                     // if (!GENE || !getGene || !getPolyVerts) { // Original check
                     if (!GENE || !getGeneFn || !getPolyVertsFn) { // Check passed functions
                         console.warn('Invalid death_fade state (missing drawing utils), removing:', effect);
                         lifeCycleEffects.splice(i, 1);
                         break; // Go to ctx.restore()
                     }

                    const fadeProgress = 1 - lifeFactor; // 0 -> 1
                    ctx.globalAlpha = lifeFactor * lifeFactor; // Fade out the whole drawing (faster fade)

                    ctx.translate(effect.x, effect.y);
                    ctx.rotate(effect.orientation);

                    const g = effect.genotype;
                    // Safely get genes using the passed function
                    // Use passed getGeneFn
                    // const rad = getGene(g, GENE.RADIUS, 20); // Original
                    const rad = getGeneFn(g, GENE.RADIUS, 0); // Default to 0 if invalid
                    // const el = getGene(g, GENE.ELONGATION, 1); // Original
                    const el = getGeneFn(g, GENE.ELONGATION, 1);
                    // const ornt = getGene(g, GENE.ORIENT, 0); // Original
                    const ornt = getGeneFn(g, GENE.ORIENT, 0);
                    // const sides = clamp(Math.round(getGene(g, GENE.SIDES, 6)), 3, 8); // Original
                    const sides = clamp(Math.round(getGeneFn(g, GENE.SIDES, 0)), 3, 8); // Default to 0 sides if invalid gene
                    // const colR = clamp(Math.round(getGene(g, GENE.COLOR_R, 128)), 0, 255); // Original
                    const colR = clamp(Math.round(getGeneFn(g, GENE.COLOR_R, 128)), 0, 255);
                    // const colG = clamp(Math.round(getGene(g, GENE.COLOR_G, 128)), 0, 255); // Original
                    const colG = clamp(Math.round(getGeneFn(g, GENE.COLOR_G, 128)), 0, 255);
                    // const colB = clamp(Math.round(getGene(g, GENE.COLOR_B, 128)), 0, 255); // Original
                    const colB = clamp(Math.round(getGeneFn(g, GENE.COLOR_B, 128)), 0, 255);

                    // Check crucial values AFTER getting them
                    if (!Number.isFinite(rad) || !Number.isFinite(el) || !Number.isFinite(ornt) || rad <= 0 || sides < 3) {
                         console.warn('Invalid death_fade state (invalid gene values for shape), removing:', {rad, el, ornt, sides}, effect);
                         lifeCycleEffects.splice(i, 1);
                         break;
                    }
                    // --- Enhanced Validation --- END // Note: moved validation check above fadeProgress calculation

                    // const fadeProgress = 1 - lifeFactor; // 0 -> 1 // Moved up
                    // ctx.globalAlpha = lifeFactor * lifeFactor; // Fade out faster // Moved up

                    // ctx.translate(effect.x, effect.y); // Moved up
                    // ctx.rotate(effect.orientation); // Moved up

                    // Calculate grayscale based on original color (luminance approximation)
                    const grayVal = Math.round(0.299 * colR + 0.587 * colG + 0.114 * colB);
                    const finalGray = 70; // Target gray value
                    const currentGray = lerp(grayVal, finalGray, fadeProgress); // Interpolate to gray

                    // --- Validate calculated color --- START
                    if (!Number.isFinite(currentGray)) {
                         console.warn('Invalid death_fade state (NaN gray value), removing:', {currentGray, grayVal, fadeProgress}, effect);
                         lifeCycleEffects.splice(i, 1);
                         break;
                    }
                    // const bodyColor = `rgb(${currentGray},${currentGray},${currentGray})`; // Original
                    const bodyColor = `rgb(${Math.round(currentGray)},${Math.round(currentGray)},${Math.round(currentGray)})`; // Ensure integer values
                    // --- Validate calculated color --- END

                    // Use passed getPolyVertsFn
                    // const verts = getPolyVerts(sides, rad, el, ornt); // Original
                    const verts = getPolyVertsFn(sides, rad, el, ornt);

                    // --- Validate vertices --- START
                    if (!Array.isArray(verts) || verts.length < 3) {
                        console.warn('Invalid death_fade state (getPolyVerts failed), removing:', {verts}, effect);
                        lifeCycleEffects.splice(i, 1);
                        break;
                    }
                    // --- Validate vertices --- END

                    // Simplified drawing: Just fill the body shape
                    ctx.beginPath();
                    ctx.moveTo(verts[0].x, verts[0].y);
                    for (let k = 1; k < verts.length; k++) {
                         // Check individual vertex validity before drawing (optional but safest)
                         if (!verts[k] || !Number.isFinite(verts[k].x) || !Number.isFinite(verts[k].y)) {
                            console.warn(`Invalid vertex data at index ${k} in death_fade, skipping point.`, effect);
                            continue; // Skip this point, might distort shape but avoids crash
                         }
                        ctx.lineTo(verts[k].x, verts[k].y);
                    }
                    ctx.closePath();
                    ctx.fillStyle = bodyColor;
                    ctx.fill();
                    break;
                }

                case 'death_particle': {
                    if (!Number.isFinite(effect.x) || !Number.isFinite(effect.y) || !Number.isFinite(effect.vx) || !Number.isFinite(effect.vy) || !Number.isFinite(effect.size)) {
                        console.warn('Invalid death_particle state, removing:', effect);
                        lifeCycleEffects.splice(i, 1);
                        break; // Go to ctx.restore()
                    }
                    effect.x += effect.vx * timeStep;
                    effect.y += effect.vy * timeStep;
                    effect.vx *= 0.96; // Slow down
                    effect.vy *= 0.96;
                    // ctx.globalAlpha = lifeFactor * lifeFactor; // Fade faster // Original
                    // ctx.beginPath(); // Original
                    // ctx.arc(effect.x, effect.y, Math.max(0.1, effect.size * lifeFactor), 0, Math.PI * 2); // Shrink // Original
                    // ctx.fillStyle = effect.color || 'rgba(150, 150, 150, 0.6)'; // Original
                    // ctx.fill(); // Original

                    const particleAlpha = lifeFactor * lifeFactor; // Fade faster
                    const particleSize = Math.max(0.1, effect.size * lifeFactor); // Shrink

                    // Added validation for calculated values before drawing
                    if (!Number.isFinite(particleAlpha) || !Number.isFinite(particleSize) || particleSize <=0 || particleAlpha <=0) {
                        // Skip drawing if invisible or invalid size/alpha
                         // console.warn('Skipping draw for invalid death_particle size/alpha', {particleSize, particleAlpha}); // Optional log
                         lifeCycleEffects.splice(i, 1); // Also remove if invalid
                         break; // Go to ctx.restore()
                    }

                    ctx.globalAlpha = particleAlpha;
                    ctx.beginPath();
                    ctx.arc(effect.x, effect.y, particleSize, 0, Math.PI * 2);
                    ctx.fillStyle = effect.color || 'rgba(150, 150, 150, 0.6)';
                    ctx.fill();
                    break;
                }

                default:
                    // lifeCycleEffects.splice(i, 1); // Remove unknown types // Original
                    console.warn('Unknown life cycle effect type, removing:', effect.type); // Added warning
                    lifeCycleEffects.splice(i, 1);
                    break;
            }
        } catch (drawError) {
            console.error("Error drawing life cycle effect:", effect.type, drawError, effect);
            lifeCycleEffects.splice(i, 1); // Remove effect that caused error
        } finally {
            ctx.restore(); // Restore context after drawing attempt
        }
    }

    ctx.restore(); // Restore global context state saved at the beginning
};

// --- END OF Life Cycle Effects System BLOCK --- 

/**
 * Draws a pulsing, dashed selection/birth highlight effect around a center point.
 */
export function drawPulsingHighlight(ctx, centerX, centerY, baseRadius, time, colorInfo) {
    // Ensure baseRadius is valid
    const radius = Number.isFinite(baseRadius) && baseRadius > 0 ? baseRadius : 30; // Use fallback if invalid

    const pulseRate = getSelectionPulseRate(time); // From animations.js
    const glowRadius = radius * pulseRate;

    // Define colors based on colorInfo object
    const glowInner = colorInfo.glowInner || 'rgba(100, 255, 100, 0.4)';
    const glowMid = colorInfo.glowMid || 'rgba(100, 255, 100, 0.2)';
    const glowOuter = colorInfo.glowOuter || 'rgba(100, 255, 100, 0)';
    const dashOuterColor = colorInfo.dashOuter || 'rgba(120, 255, 120, 0.9)';
    const dashInnerColor = colorInfo.dashInner || 'rgba(180, 255, 180, 0.7)';

    // --- Defensive Check for Gradient ---
    if (!Number.isFinite(glowRadius) || glowRadius <= 0) {
        console.warn("Non-finite/invalid glowRadius for highlight effect, skipping.", { baseRadius, glowRadius });
        // Optionally draw a simpler fallback circle?
        ctx.save();
        ctx.strokeStyle = dashOuterColor; // Use primary dash color as fallback
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2); // Use non-pulsing radius
        ctx.stroke();
        ctx.restore();
        return; // Exit if radius is invalid
    }
    // --- End Defensive Check ---

    ctx.save(); // Save context before applying effects

    // Apply translation if needed (drawing is relative to 0,0 if called within translated context)
    // If called from global context, use centerX, centerY directly
    // ctx.translate(centerX, centerY); // Only uncomment if calling from non-translated context

    // --- Glow Gradient ---
    const glowGradient = ctx.createRadialGradient(
        0, 0, // Relative to current translation (centerX, centerY)
        radius * 0.5,
        0, 0,
        glowRadius * 1.5
    );
    glowGradient.addColorStop(0, glowInner);
    glowGradient.addColorStop(0.5, glowMid);
    glowGradient.addColorStop(1, glowOuter);
    ctx.beginPath();
    ctx.arc(0, 0, glowRadius * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = glowGradient;
    ctx.fill();

    // --- Dashed Lines ---
    const dashLength = 15;
    const dashGap = 10;
    const dashOffset = getSelectionDashOffset(time, dashLength, dashGap); // From animations.js

    // Outer dash
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.setLineDash([dashLength, dashGap]);
    ctx.lineDashOffset = -dashOffset;
    ctx.strokeStyle = dashOuterColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Inner dash
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.85, 0, Math.PI * 2);
    ctx.setLineDash([dashLength * 0.7, dashGap * 0.7]);
    ctx.lineDashOffset = dashOffset; // Opposite direction
    ctx.strokeStyle = dashInnerColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Reset dashes
    ctx.setLineDash([]);

    ctx.restore(); // Restore context state
} 