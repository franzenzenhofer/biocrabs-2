/**
 * reproduction.js - Reproduction, crossover, and genotype manipulation
 * Converted to modern ES6 module with arrow functions.
 */

import { clamp, rand, getGene } from './util.js';

// "crossover", "createRandomGenotype", "applyBodySymmetry", "applyMovementSymmetry",
// "getSymmetricGenotype", and the advanced "mutate" logic have been consolidated here.

/**
 * Create a child genotype by crossing over two parent genotypes.
 */
export const crossover = (a, b, GENE) => {
  const child = [];
  for (let i = 0; i < a.length; i++) {
    child[i] = Math.random() < 0.5 ? a[i] : b[i];
  }
  // Handle color genes separately
  child[GENE.COLOR_R] = Math.random() < 0.5 ? a[GENE.COLOR_R] : b[GENE.COLOR_R];
  child[GENE.COLOR_G] = Math.random() < 0.5 ? a[GENE.COLOR_G] : b[GENE.COLOR_G];
  child[GENE.COLOR_B] = Math.random() < 0.5 ? a[GENE.COLOR_B] : b[GENE.COLOR_B];
  return child;
};

/**
 * Create a random genotype with valid gene values.
 */
export const createRandomGenotype = (CONFIG, GENE) => {
  const LC = CONFIG.LIMB_COUNT;
  const g = [];
  const geneCount = 3 + LC * 5 + 2 + LC + 1 + 2 + 3 + 1 + 5;

  // Initialize array
  for (let i = 0; i < geneCount; i++) {
    g[i] = 0;
  }

  // Body genes
  g[GENE.RADIUS] = rand(15, 30);
  g[GENE.ELONGATION] = rand(0.7, 1.3);
  g[GENE.ORIENT] = rand(0, 2 * Math.PI);

  // Limb genes
  for (let i = 0; i < LC; i++) {
    const base = 3 + i * 5;
    g[base] = rand(0, 2 * Math.PI);
    g[base + 1] = rand(10, 40);
    g[base + 2] = rand(0.1, 0.7);
    g[base + 3] = rand(0.5, 0.9);
    g[base + 4] = rand(0, 2 * Math.PI);
  }

  // Frequency and amplitude
  g[GENE.FREQ] = rand(1, 3);
  g[GENE.AMP] = rand(0.2, 1);

  // Attach fraction
  for (let i = 0; i < LC; i++) {
    g[45 + i] = Math.random();
  }

  // Shape and symmetry
  g[GENE.SIDES] = Math.floor(rand(3, 9));
  g[GENE.BODY_SYM] = rand(0, 0.4);
  g[GENE.MOVE_SYM] = 0;

  // Color
  g[GENE.COLOR_R] = rand(0, 255);
  g[GENE.COLOR_G] = rand(0, 255);
  g[GENE.COLOR_B] = rand(0, 255);

  // Physical traits
  g[GENE.DRAG_MOD] = rand(0.5, 1.5);
  g[GENE.ROT_DRAG_MOD] = rand(0.7, 1.3);
  g[GENE.ELASTICITY] = rand(0.8, 1.2);
  g[GENE.TORQUE_EFF] = rand(0.8, 1.2);
  g[GENE.POWER_RATIO] = rand(0.8, 1.5);

  return g;
};

/**
 * Apply mutations to a genotype (Advanced logic).
 */
export const mutate = (g, CONFIG, GENE) => {
  const LC = CONFIG.LIMB_COUNT;
  const mutationRate = CONFIG.MUTATION_RATE;

  for (let i = 0; i < g.length; i++) {
    if (Math.random() < mutationRate) {
      // Color genes can change more dramatically
      if (i === GENE.COLOR_R || i === GENE.COLOR_G || i === GENE.COLOR_B) {
        g[i] += rand(-50, 50);
      } else {
        g[i] *= 1 + rand(-0.2, 0.2);
      }
    }
  }

  // Clamps
  g[GENE.SIDES] = clamp(Math.round(g[GENE.SIDES]), 3, 8);
  g[GENE.BODY_SYM] = clamp(g[GENE.BODY_SYM], 0, 1);
  g[GENE.MOVE_SYM] = clamp(g[GENE.MOVE_SYM], 0, 1);
  g[GENE.COLOR_R] = clamp(g[GENE.COLOR_R], 0, 255);
  g[GENE.COLOR_G] = clamp(g[GENE.COLOR_G], 0, 255);
  g[GENE.COLOR_B] = clamp(g[GENE.COLOR_B], 0, 255);

  g[GENE.DRAG_MOD] = clamp(g[GENE.DRAG_MOD], 0.5, 1.5);
  g[GENE.ROT_DRAG_MOD] = clamp(g[GENE.ROT_DRAG_MOD], 0.7, 1.3);
  g[GENE.ELASTICITY] = clamp(g[GENE.ELASTICITY], 0.8, 1.2);
  g[GENE.TORQUE_EFF] = clamp(g[GENE.TORQUE_EFF], 0.8, 1.2);
  g[GENE.POWER_RATIO] = clamp(g[GENE.POWER_RATIO], 0.8, 1.5);

  g[GENE.FREQ] = Math.max(g[GENE.FREQ], 1);
  g[GENE.AMP] = Math.max(g[GENE.AMP], 0.5);

  for (let i = 0; i < LC; i++) {
    const base = 3 + i * 5;
    g[base + 1] = Math.max(g[base + 1], 1);
    g[base + 2] = clamp(g[base + 2], 0.05, 1);
    g[base + 3] = clamp(g[base + 3], 0.1, 0.95);
  }

  return g; // Return the mutated genotype
};

/**
 * Apply body symmetry to a genotype.
 */
export const applyBodySymmetry = (g, CONFIG, GENE) => {
  const LC = CONFIG.LIMB_COUNT;
  const sf = clamp(g[GENE.BODY_SYM], 0, 1);
  if (sf <= 0) return g;

  const half = LC / 2;
  for (let i = 0; i < half; i++) {
    const L = 3 + i * 5;
    const R = 3 + (i + half) * 5;
    const lAng = g[L];
    const lLen = g[L + 1];
    const lBrA = g[L + 2];
    const lRat = g[L + 3];
    const rAng = g[R];
    const rLen = g[R + 1];
    const rBrA = g[R + 2];
    const rRat = g[R + 3];
    const lMir = -lAng;

    g[R] = sf * lMir + (1 - sf) * rAng;
    g[R + 1] = sf * lLen + (1 - sf) * rLen;
    g[R + 2] = sf * lBrA + (1 - sf) * rBrA;
    g[R + 3] = sf * lRat + (1 - sf) * rRat;

    const la = g[45 + i];
    const ra = g[45 + (i + half)];
    const laMir = 1 - la;
    g[45 + (i + half)] = sf * laMir + (1 - sf) * ra;
  }
  return g;
};

/**
 * Apply movement symmetry to a genotype.
 */
export const applyMovementSymmetry = (g, CONFIG, GENE) => {
  const LC = CONFIG.LIMB_COUNT;
  const msf = clamp(g[GENE.MOVE_SYM], 0, 1);
  if (msf <= 0) return g;

  const half = LC / 2;
  for (let i = 0; i < half; i++) {
    const L = 3 + i * 5;
    const R = 3 + (i + half) * 5;
    const lPh = g[L + 4];
    const rPh = g[R + 4];
    g[R + 4] = msf * lPh + (1 - msf) * rPh;
  }
  return g;
};

/**
 * Get a symmetric version of a genotype.
 */
export const getSymmetricGenotype = (orig, CONFIG, GENE) => {
  const copy = orig.slice();
  applyBodySymmetry(copy, CONFIG, GENE);
  applyMovementSymmetry(copy, CONFIG, GENE);
  return copy;
};

/**
 * Handles the creation of offspring after successful reproduction check.
 * Called from collision logic in main code.
 * Uses dynamic energy (0-100 scale).
 */
export const triggerReproduction = (parentA, parentB, CONFIG, GENE, /* REMOVED population, */ W, H, clampFn, randFn, ctx) => {
  // Returns: { offspring: newCrab || null, indicesToRemove: Set<number> }

  // --- NEW Energy Logic (Closed System) --- START ---
  const childMaxEnergy = CONFIG.MAX_ENERGY; // e.g., 100
  const intendedCostPerParent = childMaxEnergy / 2; // Ideal contribution from each parent (e.g., 50)

  // Determine how much each parent can actually contribute
  const parentA_contribution = Math.max(0, Math.min(parentA.energy, intendedCostPerParent));
  const parentB_contribution = Math.max(0, Math.min(parentB.energy, intendedCostPerParent));

  // Calculate the total energy the offspring will receive
  const totalEnergyFromParents = parentA_contribution + parentB_contribution;
  const finalChildEnergy = Math.min(totalEnergyFromParents, childMaxEnergy);

  // Optional: Add a minimum threshold check if desired
  /*
  const MINIMUM_ENERGY_FOR_BIRTH = 10; // Example threshold
  if (finalChildEnergy < MINIMUM_ENERGY_FOR_BIRTH) {
      // Not enough energy transferred, abort birth
      // No energy deduction needed as it hasn't happened yet
      return { offspring: null, indicesToRemove: new Set() };
  }
  */

  // Now, deduct the actual contributed amounts from parents
  parentA.energy -= parentA_contribution;
  parentB.energy -= parentB_contribution;

  // If a parent's energy dropped below zero *after* contribution, they will die naturally
  // (Handled by handleDeathsAndCulling based on their new energy level)
  // No need to check for death *here* specifically to prevent offspring creation,
  // as the contribution logic ensures they only give what they have.

  // --- NEW Energy Logic (Closed System) --- END ---


  // --- REMOVED Old/Previous Energy Logic ---
  /*
  // 1. Energy cost for parents
  // parentA.energy -= CONFIG.REPRODUCTION_ENERGY_COST; // Original fixed cost
  // parentB.energy -= CONFIG.REPRODUCTION_ENERGY_COST; // Original fixed cost
  const offspringEnergyCost = CONFIG.MAX_ENERGY / 2; // Previous dynamic cost per parent
  parentA.energy -= offspringEnergyCost;
  parentB.energy -= offspringEnergyCost;
  // If either parent died from the cost, skip offspring creation
  // (They will be removed by handleDeathsAndCulling)
  if (parentA.energy <= 0 || parentB.energy <= 0) {
    return { offspring: null, indicesToRemove: new Set() }; // Return null offspring, empty set
  }
  */
  // --- END REMOVED --- 

  let offspring = null;

  try { // <-- Add try block for safety (Keep this safety check)
    // 2. Offspring creation (Genotype and Position)
    const childGeno = crossover(parentA.genotype, parentB.genotype, GENE); // No energy gene
    mutate(childGeno, CONFIG, GENE); // No energy gene mutation
    applyBodySymmetry(childGeno, CONFIG, GENE);
    applyMovementSymmetry(childGeno, CONFIG, GENE);

    let childX = (parentA.x + parentB.x) / 2 + randFn(-15, 15);
    let childY = (parentA.y + parentB.y) / 2 + randFn(-15, 15);
    childX = clampFn(childX, 0, W);
    childY = clampFn(childY, 0, H);

    offspring = {
      genotype: childGeno,
      x: childX,
      y: childY,
      vx: 0, vy: 0,
      orientation: Math.random() * 2 * Math.PI,
      omega: 0,
      selected: false,
      // energy: CONFIG.MAX_ENERGY, // Previous: Start with full energy
      energy: finalChildEnergy, // NEW: Start with energy actually transferred from parents
      markedForCulling: false,
      // *******************************************************
      // ***** BEGIN ROOT CAUSE FIX *****
      // Initialize physics cache properties for the new offspring
      _fx: 0,
      _fy: 0,
      _torque: 0,
      _inertia: 1, // Default inertia, will be recalculated later
      _currentThrust: 0 // CRITICAL: Initialize thrust to prevent NaN
      // ***** END ROOT CAUSE FIX *****
      // *******************************************************
    };

    // --- REMOVED Initialization from here, it's now inside the object literal ---
    /*
    // ADD Initialization of physics cache properties for the new offspring
    offspring._fx = 0;
    offspring._fy = 0;
    offspring._torque = 0;
    offspring._inertia = 1; // Will be recalculated later, but initialize
    offspring._currentThrust = 0;
    */

  } catch (error) {
      console.error("Error during offspring creation:", error, "Parents:", parentA, parentB);
      // IMPORTANT: If offspring creation fails AFTER energy deduction, we need to restore parent energy
      // Restore the energy that was deducted
      parentA.energy += parentA_contribution;
      parentB.energy += parentB_contribution;
      return { offspring: null, indicesToRemove: new Set() }; // Exit if creation failed
  }

  // Return the created offspring (or null if try/catch failed before assignment)
  return { offspring, indicesToRemove: new Set() }; // Return offspring
};
