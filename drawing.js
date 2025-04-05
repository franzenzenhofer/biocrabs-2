/**
 * drawing.js - All drawing functions + collision effects
 * Converted to modern ES6 module with arrow functions.
 */

import { clamp, getGene, getPolyVerts, getAttach, lerp } from './util.js'; // Re-added clamp import, Added lerp

import {
    oscillate,
    pulse,
    getCrabBreathingFactor,
    getCrabWobbleFactor,
    getCrabBodyRotationOffset,
    getCrabEyePulse,
    getSelectionPulseRate,
    getSelectionDashOffset,
    getGravityCenterPrimaryPulse,
    getGravityCenterSecondaryPulse,
    getGravityCenterLayerRotation,
    getGravityCenterWavyRadius,
    getGravityCenterHue,
    getNebulaRayIntensity,
    getNebulaWaveY,
    getNebulaParticleProps,
    getWaterCurrentParticleProps,
    drawPulsingHighlight
} from './animations.js';

/**
 * Start a polygon path from a set of vertices and close it.
 */
export const beginPolygonPath = (ctx, vertices) => {
  ctx.beginPath();
  ctx.moveTo(vertices[0].x, vertices[0].y);
  for (let i = 1; i < vertices.length; i++) {
    ctx.lineTo(vertices[i].x, vertices[i].y);
  }
  ctx.closePath();
};

/**
 * Create a radial gradient with an array of color stops.
 * Each stop: { offset: number, color: string }
 */
export const createRadialGradient = (ctx, x, y, innerR, outerR, stops) => {
  const grad = ctx.createRadialGradient(x, y, innerR, x, y, outerR);
  stops.forEach(stop => {
    grad.addColorStop(stop.offset, stop.color);
  });
  return grad;
};

/**
 * Fill an arc with a specified gradient.
 */
export const fillArcWithGradient = (ctx, x, y, radius, gradient) => {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
};

/**
 * Fill a polygon from the given vertices using a fillStyle.
 */
export const fillPolygon = (ctx, vertices, fillStyle) => {
  beginPolygonPath(ctx, vertices);
  ctx.fillStyle = fillStyle;
  ctx.fill();
};

/**
 * Stroke a polygon from the given vertices using a strokeStyle/lineWidth.
 */
export const strokePolygon = (ctx, vertices, strokeStyle, lineWidth = 1) => {
  beginPolygonPath(ctx, vertices);
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = strokeStyle;
  ctx.stroke();
};

/**
 * Create a visual effect at collision point, pushing to `collisionEffects`.
 */
export const createCollisionEffect = (
  effects,
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

  // --- Validation for finite inputs --- // <-- Keep this block for now, might catch other issues
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(safeIntensity) || // Check safeIntensity
    !Number.isFinite(elasticity)
  ) {
    console.warn('createCollisionEffect had non-finite values after initial check:', {
      x,
      y,
      safeIntensity,
      elasticity
    });
    return;
  }
  // --- End Validation ---

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
  const particleCount = Math.floor(3 + safeIntensity * 0.5); // Use safeIntensity
  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 2 * safeIntensity; // Use safeIntensity
    const particleSize = 2 + Math.random() * 3;
    const pLifetime = Math.max(0.01, lifespan * (0.5 + Math.random() * 0.5));
    effects.push({
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
  effects.push({
    x,
    y,
    size: size * 0.5,
    maxSize: size * 3,
    life: lifespan,
    maxLife: lifespan,
    type: 'ripple',
    intensity: safeIntensity, // Store safeIntensity
    elasticity,
    color: customColor
  });

  // Flash
  effects.push({
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
 * Update and draw collision effects in `effects`.
 */
export const updateCollisionEffects = (ctx, effects, timeStep) => {
  ctx.save(); // Save global context state

  // Loop backward for safe splicing
  for (let i = effects.length - 1; i >= 0; i--) {
    const effect = effects[i];

    // Basic check if effect object itself is valid before accessing properties
    if (!effect || typeof effect !== 'object') {
        console.warn('Invalid item found in effects array, removing:', effect);
        effects.splice(i, 1);
        continue;
    }

    // Check required properties exist before using them
    if (effect.life === undefined || effect.maxLife === undefined) {
         console.warn('Effect missing life/maxLife, removing:', effect);
         effects.splice(i, 1);
         continue;
    }

    effect.life -= timeStep;

    // Remove if expired
    if (effect.life <= 0) {
      effects.splice(i, 1);
      continue;
    }

    // Calculate fade factor based on remaining life
    const lifeFactor = clamp(effect.life / effect.maxLife, 0, 1);

    // Validate state before proceeding - REMOVED as validation is now in createCollisionEffect
    /*
    if (
      !Number.isFinite(effect.x) ||
      !Number.isFinite(effect.y) ||
      !Number.isFinite(effect.size) ||
      !Number.isFinite(lifeFactor) // Check lifeFactor too
    ) {
      console.warn('Invalid effect state, removing:', effect);
      effects.splice(i, 1);
      continue;
    }
    */

    // --- Add validation for potentially missing properties used in updates/drawing --- START
    if (effect.type === 'particle') {
        if (!Number.isFinite(effect.x) || !Number.isFinite(effect.y) || !Number.isFinite(effect.vx) || !Number.isFinite(effect.vy)) {
            console.warn('Invalid particle state, removing:', effect);
            effects.splice(i, 1);
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
            effects.splice(i, 1);
            continue;
        }
        // Expand ripple towards max size
        effect.size += (effect.maxSize - effect.size) * timeStep * 3;
    } else if (effect.type === 'flash') {
         if (!Number.isFinite(effect.size)) {
            console.warn('Invalid flash state, removing:', effect);
            effects.splice(i, 1);
            continue;
        }
        // Flash doesn't have position/size updates in this loop
    } else {
        // Handle potential unknown types or types missing updates gracefully
        if (!Number.isFinite(effect.x) || !Number.isFinite(effect.y) || !Number.isFinite(effect.size)) {
             console.warn('Invalid unknown/fallback effect state, removing:', effect);
             effects.splice(i, 1);
             continue;
        }
    }
    // --- Add validation for potentially missing properties used in updates/drawing --- END

    // --- Start Drawing Specific Effect ---
    ctx.save(); // Save context for this specific effect

    // Set the base color (fallback to white if not specified)
    const effectColor = effect.color || 'white';

    // Apply global alpha based on lifeFactor (base fade)
    // Specific effect types might modify this further if needed
    ctx.globalAlpha = lifeFactor;

    // Draw based on effect type
    switch (effect.type) {
      case 'particle': {
        // Small, shrinking, fading particle
        ctx.beginPath();
        // Size shrinks with life
        ctx.arc(effect.x, effect.y, Math.max(0.5, effect.size * lifeFactor), 0, Math.PI * 2);
        ctx.fillStyle = effectColor;
        ctx.fill();
        break;
      }
      case 'ripple': {
        // Expanding, fading ring
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.size, 0, Math.PI * 2);
        ctx.strokeStyle = effectColor;
        // Adjust alpha for ripple effect (e.g., make it fainter)
        ctx.globalAlpha = lifeFactor * 0.5;
        ctx.lineWidth = Math.max(0.5, 1.5); // Constant or fading width
        ctx.stroke();
        break;
      }
      case 'flash': {
        // Fading filled circle (like a brief glow)
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.size, 0, Math.PI * 2);
        // Flash often has a stronger initial alpha, fading quickly
        ctx.globalAlpha = lifeFactor * lifeFactor; // Example: Fade quadratically
        ctx.fillStyle = effectColor;
        ctx.fill();
        break;
      }
      default: {
        // Fallback for unknown types: simple fading circle
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

export function drawNebulaBackground(ctx, W, H, time) {
    ctx.save();
    const deepWaterGradient = ctx.createLinearGradient(0, 0, 0, H);
    deepWaterGradient.addColorStop(0, 'rgba(30, 100, 180, 0.02)');
    deepWaterGradient.addColorStop(0.7, 'rgba(10, 60, 120, 0.04)');
    deepWaterGradient.addColorStop(1, 'rgba(5, 30, 80, 0.06)');
    ctx.fillStyle = deepWaterGradient;
    ctx.fillRect(0, 0, W, H);
  
    const rayCount = 5;
    const rayWidth = W / rayCount;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < rayCount; i++) {
      const xPos = W * (i / rayCount) + W / (rayCount * 2);
      const rayHeight = H * 0.7;
      const topWidth = rayWidth * 0.2;
      const bottomWidth = rayWidth * 0.7;
      const rayIntensity = getNebulaRayIntensity(time, i);
      const rayGradient = ctx.createLinearGradient(xPos, 0, xPos, rayHeight);
      rayGradient.addColorStop(0, `rgba(255, 255, 255, ${rayIntensity})`);
      rayGradient.addColorStop(0.7, `rgba(180, 220, 255, ${rayIntensity * 0.5})`);
      rayGradient.addColorStop(1, 'rgba(100, 150, 200, 0)');
      ctx.beginPath();
      ctx.moveTo(xPos - topWidth, 0);
      ctx.lineTo(xPos + topWidth, 0);
      ctx.lineTo(xPos + bottomWidth, rayHeight);
      ctx.lineTo(xPos - bottomWidth, rayHeight);
      ctx.closePath();
      ctx.fillStyle = rayGradient;
      ctx.fill();
    }
  
    const waveCount = 3;
    for (let i = 0; i < waveCount; i++) {
      const waveTime = time * 0.03 + i * Math.PI;
      const yBase = H * (0.3 + i * 0.25);
      ctx.beginPath();
      ctx.moveTo(0, yBase);
      for (let x = 0; x < W; x += 20) {
        const yOffset = getNebulaWaveY(x, W, waveTime);
        const y = yBase + yOffset;
        ctx.lineTo(x, y);
      }
      const waveGradient = ctx.createLinearGradient(0, yBase - 15, 0, yBase + 15);
      waveGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
      waveGradient.addColorStop(0.5, `rgba(255, 255, 255, ${0.03 - i * 0.005})`);
      waveGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.strokeStyle = waveGradient;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  
    const floatingParticleCount = 20;
    for (let i = 0; i < floatingParticleCount; i++) {
      const props = getNebulaParticleProps(i, floatingParticleCount, W, H, time);
      ctx.beginPath();
      ctx.arc(props.x, props.y, props.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${props.alpha})`;
      ctx.fill();
    }
    ctx.restore();
  }

/***********************************************************************
 * DRAWING LOGIC (Still inside index.html, the "higher-level" scene)
 ***********************************************************************/
export function drawWorld(
  ctx,
  W,
  H,
  CONFIG,
  GENE,
  globalTime,
  foodPellets,
  population
) {
  // Clear canvas - REMOVED FROM HERE
  // ctx.clearRect(0, 0, W, H);

  // Background
  drawNebulaBackground(ctx, W, H, globalTime);
  drawWaterCurrents(ctx, W / 2, H / 2, Math.max(W, H) * 0.7, globalTime);

  // Center point
  drawGravityCenter(ctx, W, H, CONFIG, globalTime);

  // Draw Food pellets
  ctx.save();
  ctx.fillStyle = 'rgba(100, 255, 100, 0.85)';
  ctx.shadowColor = 'rgba(180, 255, 180, 0.6)';
  ctx.shadowBlur = 5;
  for (const food of foodPellets) {
    // Basic check for valid food object
    if (food && typeof food.x === 'number' && typeof food.y === 'number') {
        ctx.beginPath();
        ctx.arc(food.x, food.y, CONFIG.FOOD_RADIUS, 0, Math.PI * 2);
        ctx.fill();
    } else {
        console.warn("Attempted to draw invalid food pellet:", food);
    }
  }
  ctx.restore();

  for (const crab of population) {
    // --- Guard Clause --- START
    // Enhanced check: ensure genotype and pattern exist, and coords are valid numbers
    if (
      !crab ||
      !crab.genotype ||
      typeof crab.x !== 'number' ||
      typeof crab.y !== 'number' ||
      typeof crab.orientation !== 'number' ||
      isNaN(crab.x) || isNaN(crab.y) || isNaN(crab.orientation) // Explicit NaN check
    ) {
      console.warn('Attempted to draw invalid/incomplete crab object:', crab);
      continue; // Skip drawing this invalid entry
    }
    // --- Guard Clause --- END

    ctx.save();
    ctx.translate(crab.x, crab.y);
    ctx.rotate(crab.orientation);
  
    // highlight if selected
    if (crab.selected) {
      const radius = getGene(crab.genotype, GENE.RADIUS, 20); // Get base radius safely
      const selectionColors = {
          glowInner: 'rgba(100, 255, 100, 0.4)',
          glowMid: 'rgba(100, 255, 100, 0.2)',
          glowOuter: 'rgba(100, 255, 100, 0)',
          dashOuter: 'rgba(120, 255, 120, 0.9)',
          dashInner: 'rgba(180, 255, 180, 0.7)'
      };
      // Call the reusable function, passing 0, 0 because we are already translated
      drawPulsingHighlight(ctx, 0, 0, radius * 1.2, globalTime, selectionColors);
    }
  
    drawCrab(ctx, crab.genotype, globalTime, crab.x, crab.y, W, H, CONFIG, GENE, crab);
    ctx.restore();
  }
}
  
export  function drawCrab(ctx, g, time, crabX, crabY, W, H, CONFIG, GENE, crab) {
  // --- Early Exit / Defensive Check --- START
  if (!g || !Array.isArray(g) || g.length === 0 || !crab || typeof crabX !== 'number' || typeof crabY !== 'number' || isNaN(crabX) || isNaN(crabY)) {
      console.warn("drawCrab called with invalid parameters:", { genotype: g, crabObject: crab, x: crabX, y: crabY });
      return; // Do not attempt to draw if essential data is missing/invalid
  }
  // --- Early Exit / Defensive Check --- END

  const LC = CONFIG.LIMB_COUNT;
  // Wrap gene access in try-catch or add checks if getGene can fail
  let rad, el, ornt, freq, amp, sides, colR, colG, colB, dragMod, elasticity, torqueEff, powerRatio;
  try {
      rad = getGene(g, GENE.RADIUS);
      el = getGene(g, GENE.ELONGATION);
      ornt = getGene(g, GENE.ORIENT);
      freq = getGene(g, GENE.FREQ);
      amp = getGene(g, GENE.AMP);
      sides = clamp(Math.round(getGene(g, GENE.SIDES)), 3, 8);
      colR = clamp(Math.round(getGene(g, GENE.COLOR_R)), 0, 255);
      colG = clamp(Math.round(getGene(g, GENE.COLOR_G)), 0, 255);
      colB = clamp(Math.round(getGene(g, GENE.COLOR_B)), 0, 255);
      dragMod = getGene(g, GENE.DRAG_MOD);
      elasticity = getGene(g, GENE.ELASTICITY);
      torqueEff = getGene(g, GENE.TORQUE_EFF);
      powerRatio = getGene(g, GENE.POWER_RATIO);
  } catch (error) {
      console.error("Error accessing genes in drawCrab:", error, "Genotype:", g);
      return; // Cannot draw without genes
  }

  const color = `rgb(${colR},${colG},${colB})`;
  
  const breathingFactor = getCrabBreathingFactor(time);
  const wobbleFactor = getCrabWobbleFactor(time);
  const bodyRotation = ornt + getCrabBodyRotationOffset(time);
  
  const dx = W / 2 - crabX;
  const dy = H / 2 - crabY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  let glowIntensity = 0;
  if (dist < CONFIG.GRAVITY_FALLOFF) {
    glowIntensity = 0.4 * (1 - dist / CONFIG.GRAVITY_FALLOFF);
  }
  
  const elongation = el * (0.8 + 0.4 * (1 - dragMod)) * breathingFactor;
  const verts = getPolyVerts(sides, rad, elongation, bodyRotation);
  
  // Wobble
  for (let i = 0; i < verts.length; i++) {
    const angle = bodyRotation + (2 * Math.PI * i) / sides;
    verts[i].x *= 1 + wobbleFactor * Math.sin(angle * sides);
    verts[i].y *= 1 + wobbleFactor * Math.cos(angle * sides);
  }
  
  // Shadow
  ctx.save();
  ctx.translate(3, 3);
  fillPolygon(ctx, verts, 'rgba(0,0,0,0.25)');
  ctx.shadowColor = 'rgba(0,0,0,0.1)';
  ctx.shadowBlur = 5;
  ctx.restore();
  
  // Gravity reflection
  if (glowIntensity > 0) {
    ctx.save();
    beginPolygonPath(ctx, verts);
    const reflectionColor = `rgba(255, 255, 255, ${glowIntensity * 0.5})`;
    ctx.shadowColor = reflectionColor;
    ctx.shadowBlur = 8;
    ctx.fillStyle = reflectionColor;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fill();
  
    const rippleCount = Math.floor(3 * glowIntensity);
    for (let i = 0; i < rippleCount; i++) {
      const rippleRadius = rad * (1.2 + 0.5 * i);
      const rippleOpacity = 0.1 * glowIntensity * (1 - i / rippleCount);
      ctx.beginPath();
      ctx.arc(0, 0, rippleRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 255, 255, ${rippleOpacity})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }
  
  // Body fill
  ctx.save();
  beginPolygonPath(ctx, verts);
  ctx.fillStyle = color;
  ctx.fill();
  
  const gradientOverlay = ctx.createRadialGradient(0, 0, 0, 0, 0, rad * 1.5);
  gradientOverlay.addColorStop(0, `rgba(${colR}, ${colG}, ${colB}, 0.4)`);
  gradientOverlay.addColorStop(0.7, `rgba(${colR}, ${colG}, ${colB}, 0.1)`);
  gradientOverlay.addColorStop(1, 'rgba(0, 0, 0, 0)');
  beginPolygonPath(ctx, verts);
  ctx.fillStyle = gradientOverlay;
  ctx.fill();
  
  strokePolygon(ctx, verts, 'rgba(20, 30, 40, 0.8)', 1.5 * (0.8 + 0.4 * dragMod));
  strokePolygon(
    ctx,
    verts,
    `rgba(${colR * 0.5}, ${colG * 0.5}, ${colB * 0.5}, 0.3)`,
    1.5 * 0.5 * (0.8 + 0.4 * dragMod)
  );
  ctx.restore();
  
  // --- Draw Energy Ring --- START
  const safeEnergy = (crab && typeof crab.energy === 'number' && !isNaN(crab.energy)) ? crab.energy : 0;
  const energyFraction = clamp(safeEnergy / CONFIG.MAX_ENERGY, 0, 1);

  if (energyFraction > 0 && !isNaN(energyFraction)) { // Only draw if there's energy and value is valid
      // Make ring smaller and place it further inside
      const ringOuterRadius = rad * 0.25; // e.g., 25% of crab radius
      const outlineWidth = rad * 0.12;  // Make outline thicker (e.g., 12%)
      const barWidth = rad * 0.05;    // Keep energy bar width the same (e.g., 5%)

      // Center radius of the bar
      const ringCenterRadius = ringOuterRadius - outlineWidth / 2;

      const startAngle = -Math.PI / 2; // Start at the top
      const endAngle = startAngle + (Math.PI * 2 * energyFraction);

      // --- New Neon Color Logic: Green -> Orange -> Red --- START
      let hue, saturation, lightness;
      saturation = '100%';
      lightness = '55%'; // Consistent bright lightness

      if (energyFraction > 0.5) { // High energy: Neon Green
          hue = 120; // Green
      } else if (energyFraction > 0.2) { // Medium energy: Neon Orange
          hue = 35; // Orange
      } else { // Low energy: Neon Red
          hue = 0; // Red
      }
      // --- New Neon Color Logic --- END

      const neonColor = `hsl(${hue}, ${saturation}, ${lightness})`;

      ctx.save();

      // 1. Draw the black outline (full circle)
      ctx.beginPath();
      ctx.arc(0, 0, ringCenterRadius, 0, Math.PI * 2);
      ctx.lineWidth = outlineWidth; // Use the thicker outline width
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)'; // Outline color
      ctx.stroke();

      // 2. Draw the depleted part (dark bar on top of outline)
      ctx.beginPath();
      ctx.arc(0, 0, ringCenterRadius, endAngle, startAngle + Math.PI * 2);
      ctx.lineWidth = barWidth; // Use the thinner bar width
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)'; // Darker/dim color for depleted part
      ctx.stroke();

      // 3. Draw the neon energy arc (colored bar on top of outline)
      ctx.save(); // Save before applying glow
      // Apply Neon Glow Effect ONLY to the colored part
      ctx.shadowColor = neonColor;
      ctx.shadowBlur = 6 + 3 * energyFraction; // Slightly reduce glow intensity
      ctx.beginPath();
      ctx.arc(0, 0, ringCenterRadius, startAngle, endAngle);
      ctx.lineWidth = barWidth; // Use the thinner bar width
      ctx.strokeStyle = neonColor;
      ctx.stroke();
      ctx.restore(); // Restore after applying glow

      ctx.restore();
  }
  // --- Draw Energy Ring --- END
  
  // Limbs
  const geneInfo = { torqueEff, dragMod, elasticity, powerRatio };
  for (let i = 0; i < LC; i++) {
    let base, bAng, bLen, brA, lRat, ph, aFrac;
    try {
        base = 3 + i * 5;
        // Check if indices are within bounds
        if (base + 4 >= g.length || 45 + i >= g.length) {
            console.warn(`Gene index out of bounds in drawCrab limb loop (i=${i}, base=${base}, g.length=${g.length})`);
            continue; // Skip this limb
        }
        bAng = g[base];
        bLen = g[base + 1];
        brA = g[base + 2];
        lRat = g[base + 3];
        ph = g[base + 4];
        aFrac = g[45 + i];
        // Basic check for NaN/undefined values
        if ([bAng, bLen, brA, lRat, ph, aFrac].some(val => typeof val !== 'number' || isNaN(val))) {
            console.warn(`Invalid gene value encountered in limb loop (i=${i}):`, {bAng, bLen, brA, lRat, ph, aFrac});
            continue; // Skip this limb
        }
    } catch (error) {
        console.error(`Error accessing limb genes (i=${i}):`, error, "Genotype:", g);
        continue; // Skip this limb if genes can't be accessed
    }

    const cyc = freq * time + ph;
    const swing = amp * Math.sin(cyc);
    const att = getAttach(verts, aFrac);
    const dx = att.x;
    const dy_attach = att.y; // Rename to avoid conflict
    const angleC = Math.atan2(dy_attach, dx);
    let rawAngle = angleC + bAng + swing; 
    let delta = rawAngle - angleC; 
    // Clamp delta
    delta = clamp(delta, -CONFIG.LIMB_ANGLE_LIMIT, CONFIG.LIMB_ANGLE_LIMIT);
    const finalA = angleC + delta;
  
    ctx.save();
    ctx.translate(dx, dy_attach);
    ctx.rotate(finalA);
    if (Math.abs(swing) > 0.1) {
      const disturbIntensity = Math.min(
        0.2,
        0.05 + Math.abs(swing) * 0.15 * powerRatio
      );
      ctx.shadowColor = `rgba(255, 255, 255, ${disturbIntensity})`;
      ctx.shadowBlur = 4;
    }
    drawBranch(ctx, bLen, brA, lRat, CONFIG.BRANCH_DEPTH, geneInfo, time);
    ctx.restore();
  }
  
  // Eyes
  if (sides >= 5) {
    const eyeDistance = rad * 0.6;
    const eyeSize = rad * 0.1;
    const eyeAngle = bodyRotation + Math.PI * 0.12;
    const leftEyeX = Math.cos(eyeAngle) * eyeDistance;
    const leftEyeY = Math.sin(eyeAngle) * eyeDistance * elongation;
    const rightEyeX = Math.cos(-eyeAngle) * eyeDistance;
    const rightEyeY = Math.sin(-eyeAngle) * eyeDistance * elongation;
    const eyePulse = getCrabEyePulse(time);
    // Use crab.energy safely
    const safeEnergy = (crab && typeof crab.energy === 'number' && !isNaN(crab.energy)) ? crab.energy : 0;
    const eyeIntensity = 0.5 + 0.5 * (clamp(safeEnergy, 0, CONFIG.MAX_ENERGY) / CONFIG.MAX_ENERGY);
    const eyeR = 20 + 40 * eyeIntensity;
    const eyeG = 80 + 60 * eyeIntensity;
    const eyeB = 120 + 80 * eyeIntensity;
  
    const drawEye = (x, y) => {
      ctx.beginPath();
      ctx.arc(x, y, eyeSize * eyePulse, 0, Math.PI * 2);
      const eyeGradient = ctx.createRadialGradient(x, y, 0, x, y, eyeSize * 2);
      eyeGradient.addColorStop(0, `rgba(${eyeR}, ${eyeG}, ${eyeB}, 0.8)`);
      eyeGradient.addColorStop(0.5, `rgba(${eyeR}, ${eyeG}, ${eyeB}, 0.3)`);
      eyeGradient.addColorStop(1, 'rgba(0, 100, 200, 0)');
      ctx.fillStyle = eyeGradient;
      ctx.fill();
  
      ctx.beginPath();
      ctx.arc(x, y, eyeSize * 0.4 * eyePulse, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(10, 20, 30, 0.9)';
      ctx.fill();
    };
    drawEye(leftEyeX, leftEyeY);
    drawEye(rightEyeX, rightEyeY);
  }
}
  
export  function drawBranch(ctx, length, angle, ratio, depth, geneInfo, time) {
    const { torqueEff, dragMod, powerRatio } = geneInfo || {};
    if (depth < 1 || length < 2) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      const cp1x = length * 0.3;
      const cp1y = oscillate(time, 1, length * 0.05, depth);
      const cp2x = length * 0.7;
      const cp2y = oscillate(time, 0.8, length * 0.03, depth);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, length, 0);
      const alpha = 0.8 - depth * 0.1;
      ctx.strokeStyle = `rgba(30, 40, 50, ${alpha})`;
      ctx.stroke();
  
      ctx.beginPath();
      ctx.arc(length, 0, Math.max(0.3, length * 0.03), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(40, 50, 60, ${alpha})`;
      ctx.fill();
  
      ctx.translate(length, 0);
      return;
    }
    const limbGradient = ctx.createLinearGradient(0, 0, length, 0);
    limbGradient.addColorStop(0, `rgba(40, 50, 60, 0.9)`);
    limbGradient.addColorStop(1, `rgba(30, 40, 50, 0.7)`);
    ctx.beginPath();
    ctx.lineWidth = Math.max(1, 2 * (1 + 0.3 * (torqueEff || 1)));
    const cpOffset = oscillate(time, 0.3, length * 0.05);
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(length * 0.3, cpOffset, length * 0.7, cpOffset, length, 0);
    ctx.strokeStyle = limbGradient;
    ctx.stroke();
  
    ctx.beginPath();
    const jointSize = Math.max(0.5, length * 0.04 * (dragMod || 1));
    ctx.arc(length, 0, jointSize, 0, Math.PI * 2);
    const jointR = 40 + (powerRatio ? Math.min(30, powerRatio * 20) : 0);
    const jointG = 50 + (powerRatio ? Math.min(20, powerRatio * 15) : 0);
    ctx.fillStyle = `rgb(${jointR}, ${jointG}, 60)`;
    ctx.fill();
  
    ctx.translate(length, 0);
    ctx.save();
    ctx.rotate(angle);
    drawBranch(ctx, length * ratio, angle, ratio, depth - 1, geneInfo, time);
    ctx.restore();
  
    ctx.save();
    ctx.rotate(-angle);
    drawBranch(ctx, length * ratio, angle, ratio, depth - 1, geneInfo, time);
    ctx.restore();
  }
  
export function drawGravityCenter(ctx, W, H, CONFIG, time) {
    const centerX = W / 2;
    const centerY = H / 2;
    const radius = CONFIG.GRAVITY_RADIUS;
    const primaryPulse = getGravityCenterPrimaryPulse(time, CONFIG.GRAVITY_VISUAL_PULSE);
    const secondaryPulse = getGravityCenterSecondaryPulse(time, CONFIG.GRAVITY_VISUAL_PULSE);
    const pulseRadius = radius * primaryPulse;
  
    for (let i = 1; i <= 5; i++) {
      const layerOpacity = 0.15 / i;
      const layerWidth = 1 + (i === 1 ? 1.2 : 0);
      const layerRadius = pulseRadius * i * (1.1 + i * 0.05);
      const rotationOffset = getGravityCenterLayerRotation(time, i);
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotationOffset);
  
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 2; a += 0.1) {
        const wavyRadius = getGravityCenterWavyRadius(layerRadius, a, time);
        const x = Math.cos(a) * wavyRadius;
        const y = Math.sin(a) * wavyRadius;
        if (a === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(255, 255, 255, ${layerOpacity})`;
      ctx.lineWidth = layerWidth;
      ctx.stroke();
      ctx.restore();
    }
  
    const glowSize = pulseRadius * 1.5 * secondaryPulse;
    const hue = getGravityCenterHue(time);
    const gradientInner = createRadialGradient(ctx, centerX, centerY, 0, glowSize, [
      { offset: 0, color: `hsla(${hue}, 80%, 80%, 0.5)` },
      { offset: 0.3, color: `hsla(${hue}, 70%, 60%, 0.3)` },
      { offset: 0.7, color: `hsla(${hue - 20}, 60%, 40%, 0.15)` },
      { offset: 1, color: 'rgba(150, 200, 255, 0)' }
    ]);
    fillArcWithGradient(ctx, centerX, centerY, glowSize, gradientInner);
  
    const coreSize = pulseRadius * 0.6;
    const coreGradient = createRadialGradient(ctx, centerX, centerY, 0, coreSize, [
      { offset: 0, color: 'rgba(255, 255, 255, 0.8)' },
      { offset: 0.6, color: 'rgba(200, 220, 255, 0.5)' },
      { offset: 1, color: 'rgba(150, 180, 255, 0)' }
    ]);
    fillArcWithGradient(ctx, centerX, centerY, coreSize, coreGradient);
  
    drawWaterCurrents(ctx, centerX, centerY, pulseRadius * 3, time);
  }
  
export function drawWaterCurrents(ctx, centerX, centerY, maxRadius, time) {
    const particleCount = 40;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < particleCount; i++) {
      const props = getWaterCurrentParticleProps(i, particleCount, time, maxRadius);
      const px = centerX + props.x;
      const py = centerY + props.y;
      const particleGradient = createRadialGradient(
        ctx,
        px,
        py,
        0,
        props.size * 2,
        [
          {
            offset: 0,
            color: `hsla(${props.hue}, 80%, 80%, ${props.alpha})`
          },
          { offset: 1, color: 'rgba(255, 255, 255, 0)' }
        ]
      );
      fillArcWithGradient(ctx, px, py, props.size * 2, particleGradient);
      if (props.size > 1) {
        ctx.beginPath();
        ctx.arc(px, py, props.size * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fill();
      }
    }
    ctx.restore();
  }
  
  
  
  
  
