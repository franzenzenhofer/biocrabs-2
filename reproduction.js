"use strict";

// Extracted Mutate function
function mutate(genotype, config, geneConstants) {
  for (let i = 0; i < genotype.length; i++) {
    if (Math.random() < config.MUTATION_RATE) {
      let geneRange = 1.0; // Default range
      // Apply specific ranges or constraints based on gene index if needed
      // Example: if (i === geneConstants.RADIUS) geneRange = config.CRAB_RADIUS * 0.5;
      let mutationAmount = (Math.random() * 2 - 1) * geneRange * 0.2; // Smaller mutation magnitude
      genotype[i] += mutationAmount;
      // Add clamping or validation if necessary for specific genes
      // -- Removed example comment --
    }
  }
  // Ensure key structural genes remain somewhat symmetrical if desired
  if (Math.random() < config.MUTATION_RATE * 0.5) { // Lower chance for symmetry mutation
    Utils.applyBodySymmetry(genotype, config, geneConstants);
  }
}

// Handles the creation of offspring after successful reproduction check
function triggerReproduction(parentA, parentB) {
  // Assumes access to globals: CONFIG, GENE, Utils, W, H, population, 
  // createCrabPattern, createCollisionEffect, collisionEffects

  // 1. Energy Cost
  parentA.energy -= CONFIG.REPRODUCTION_ENERGY_COST;
  parentB.energy -= CONFIG.REPRODUCTION_ENERGY_COST;

  // Safety check: Ensure parents didn't die immediately from cost
  if (parentA.energy <= 0 || parentB.energy <= 0) {
    // Optional: Could add a small effect here, but main death check handles removal
    return; 
  }

  // 2. Offspring Creation
  let childGeno = Utils.crossover(parentA.genotype, parentB.genotype, GENE);
  mutate(childGeno, CONFIG, GENE); // Apply mutation (Call directly within the same file)

  let childX = (parentA.x + parentB.x) / 2 + Utils.rand(-15, 15);
  let childY = (parentA.y + parentB.y) / 2 + Utils.rand(-15, 15);
  childX = Utils.clamp(childX, 0, W); // Keep in bounds
  childY = Utils.clamp(childY, 0, H);

  let offspring = {
    genotype: childGeno,
    x: childX,
    y: childY,
    vx: 0, vy: 0,
    orientation: Math.random() * 2 * Math.PI,
    omega: 0,
    selected: false, 
    energy: CONFIG.OFFSPRING_START_ENERGY, // Start with defined energy
    markedForCulling: false // Initialize flag
  };

  // --- DEBUG: Check offspring state before adding ---
  if (!Number.isFinite(offspring.x) || !Number.isFinite(offspring.y) || !Number.isFinite(offspring.energy)) {
      console.error('Invalid offspring state BEFORE adding:', {
          x: offspring.x, y: offspring.y, energy: offspring.energy,
          parentA_idx: population.indexOf(parentA), parentB_idx: population.indexOf(parentB)
      });
      // Attempt recovery: Clamp position, maybe default energy?
      offspring.x = Utils.clamp(offspring.x, 0, W);
      offspring.y = Utils.clamp(offspring.y, 0, H);
      if (!Number.isFinite(offspring.energy)) offspring.energy = CONFIG.OFFSPRING_START_ENERGY; // Reset energy if invalid
  }

  createCrabPattern(offspring);
  population.push(offspring);
  // Add spawn animation effect (NEW)
  if (Number.isFinite(childX) && Number.isFinite(childY)) { // KISS: Check coords before creating effect
      // Use simplified call for spawn
      createCollisionEffect(childX, childY, 1.5, 1.2, { type: 'spawn' }); 
  }

  // 4. Population Control (Culling) - MARKING phase (Optimized)
  let potentialOffspringCount = 1; // Currently, we only add one offspring per trigger
  let overflow = (population.length + potentialOffspringCount) - CONFIG.POP_SIZE;

  if (overflow > 0) {
      // Find the indices of the weakest 'overflow' crabs currently alive and not already marked
      let weakestIndices = [];
      let weakestEnergies = [];

      for (let i = 0; i < population.length; i++) {
          const crab = population[i];
          // Consider only living, unmarked crabs for culling
          if (crab.energy > 0 && !crab.markedForCulling) { 
              // If we haven't found enough weak candidates yet
              if (weakestIndices.length < overflow) {
                  weakestIndices.push(i);
                  weakestEnergies.push(crab.energy);
              } else {
                  // Find the strongest energy among the current weak candidates
                  let maxWeakEnergy = -Infinity;
                  let maxWeakIndexInCandidates = -1;
                  for (let j = 0; j < weakestEnergies.length; j++) {
                      if (weakestEnergies[j] > maxWeakEnergy) {
                          maxWeakEnergy = weakestEnergies[j];
                          maxWeakIndexInCandidates = j;
                      }
                  }

                  // If the current crab is weaker than the strongest of the weak candidates,
                  // replace the strongest weak candidate with the current crab.
                  if (crab.energy < maxWeakEnergy) {
                      weakestIndices[maxWeakIndexInCandidates] = i;
                      weakestEnergies[maxWeakIndexInCandidates] = crab.energy;
                  }
              }
          }
      }

      // Mark the actual crabs identified as the weakest
      for (const index of weakestIndices) {
          population[index].markedForCulling = true;
          // Optional: Visual effect for marking
          const cullX = population[index].x;
          const cullY = population[index].y;
          if (Number.isFinite(cullX) && Number.isFinite(cullY)) {
              // Use simplified call for culling marker
              createCollisionEffect(cullX, cullY, 0.6, 0.5, { type: 'cull' }); 
          }
      }
  }
  /* OLD SORTING LOGIC - REMOVED
  while (population.length > CONFIG.POP_SIZE) {
    let weakestCrabIndex = -1;
    let lowestEnergy = Infinity;
// ... existing code ...
    }
  }
  */
}

// Export functions needed externally (e.g., by index.html)
if (typeof window !== 'undefined') {
  // Ensure Utils exists (created by util.js)
  window.Utils = window.Utils || {}; 
  window.Utils.mutate = mutate; 
  // triggerReproduction is only called internally by handleCrabCollision
} 