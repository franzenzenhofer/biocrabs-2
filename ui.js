import { getGene as utilGetGene, getFormattedGene as utilGetFormattedGene } from './util.js'; // Import helpers needed locally
import { triggerReproduction } from './reproduction.js';
import { clamp, rand } from './util.js';

// Module-scoped variables to store references
let canvasRef = null;
let populationRef = null;
let configRef = null;
let getGeneFn = null;
let getFormattedGeneFn = null;
let geneRef = null;

let initialHideTimeout = null; // Timeout ID to hide the panel initially

// Initialization function
export function initUI(canvas, population, config, getGene, getFormattedGene, geneEnum) {
    canvasRef = canvas;
    populationRef = population;
    configRef = config;
    getGeneFn = getGene;
    getFormattedGeneFn = getFormattedGene;
    geneRef = geneEnum;

    const info = document.getElementById('infoPanel');
    if (info) {
        // Set initial message and make visible
        info.textContent = 'Click crabs to select (min 2 to breed)';
        info.style.display = 'block'; 

        // Start timer to hide the panel after 7 seconds
        // Clear any previous timeout just in case initUI is called multiple times
        if (initialHideTimeout) clearTimeout(initialHideTimeout);
        initialHideTimeout = setTimeout(() => {
            // Only hide if no crabs are currently selected
            if (populationRef && populationRef.filter(c => c.selected).length === 0) {
                info.style.display = 'none';
            }
            initialHideTimeout = null; // Clear the ID
        }, 7000); // 7 seconds
    }
    // Initial call to set the correct initial UI state
    updateInfoPanel();
}

/***********************************************************************
* INTERACTION
***********************************************************************/
// No longer needs parameters, uses module-scoped refs
export function onCanvasClick(e) {
    if (!canvasRef || !populationRef || !configRef || !geneRef || !utilGetGene) return; // Guard, added utilGetGene check

    const rect = canvasRef.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let selectionChanged = false;
    for (const crab of populationRef) {
        const dx = mx - crab.x;
        const dy = my - crab.y;
        // Use gene-based radius for click detection
        const radius = utilGetGene(crab.genotype, geneRef.RADIUS);
        if (dx * dx + dy * dy <= radius * radius) { // Check against actual radius
            crab.selected = !crab.selected;
            selectionChanged = true;
            // If the user clicks during the initial 7s, cancel the auto-hide
            if (initialHideTimeout) {
                clearTimeout(initialHideTimeout);
                initialHideTimeout = null;
            }
            break; // Only select one crab per click
        }
    }
    if (selectionChanged) {
        updateInfoPanel(); // Update info panel directly
    }
}

// No longer needs parameters, uses module-scoped refs
export function updateInfoPanel() { // Renamed from updateBreedButton
    if (!populationRef || !configRef || !getGeneFn || !getFormattedGeneFn || !geneRef) return; // Guard

    const info = document.getElementById('infoPanel');
    // --- Add Null Check --- START
    if (!info) {
        console.error("#infoPanel element not found!");
        return; // Cannot update UI if panel doesn't exist
    }
    // --- Add Null Check --- END

    const sel = populationRef.filter(c => c.selected).length;
  
    // Ensure button animation style exists (do this once)
    // REMOVED - Style is now in index.html
    /*
    if (!document.getElementById('pulseButtonStyle')) {
        const styleSheet = document.createElement('style');
        styleSheet.id = 'pulseButtonStyle';
        styleSheet.textContent = `
          @keyframes pulseButton {
            0%, 100% { transform: translateX(-50%) scale(1); box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
            50% { transform: translateX(-50%) scale(1.05); box-shadow: 0 6px 20px rgba(75,108,183,0.5); }
          }
        `;
        document.head.appendChild(styleSheet);
    }
    */

    if (sel >= 2) {
      info.style.display = 'block'; // Show panel
      info.textContent = `Selected ${sel} crabs - Ready to breed!`;

      // --- Auto-reproduction Trigger --- START
      // Clear any existing timeout to prevent multiple triggers
      if (autoReproTimeout) {
          clearTimeout(autoReproTimeout);
      }
      // Set a new timeout
      autoReproTimeout = setTimeout(() => {
          triggerManualReproduction();
          autoReproTimeout = null; // Clear the ID after execution
      }, 1500); // 1.5 seconds
      // --- Auto-reproduction Trigger --- END

    } else if (sel === 1) {
      info.style.display = 'block'; // Show panel
      const crab = populationRef.find(c => c.selected);
      if (crab) {
        // Simplify display to show current energy percentage
        const energyPercent = Math.round((crab.energy / configRef.MAX_ENERGY) * 100);
        let energyColor = '#8eff8e'; // Default green
        if (energyPercent <= 30) energyColor = '#ffcf8e'; // Orange
        if (energyPercent <= 10) energyColor = '#ff9e8e'; // Red

        info.innerHTML = `
          <div style="font-weight:bold;margin-bottom:5px;color:#8CD5FF">Selected Crab</div>
          <div style="font-size:1.1em;margin-bottom:5px">
            Energy: <span style="color:${energyColor};font-weight:bold">${energyPercent}%</span>
          </div>
          <div style="font-size:0.8em;opacity:0.8">
            (${Math.round(crab.energy)} / ${configRef.MAX_ENERGY})
          </div>
          <hr style="border:none;border-top:1px solid rgba(255,255,255,0.2);margin:8px 0">
          <div style="font-size:0.8em;margin-top:5px;opacity:0.8">
            Select one more crab to breed
          </div>
        `;
  
        // Clear auto-repro timeout if selection drops below 2
        if (autoReproTimeout) {
          clearTimeout(autoReproTimeout);
          autoReproTimeout = null;
        }
      } else {
        info.style.display = 'none'; // Hide if selected crab not found
        // Clear auto-repro timeout if selection drops below 2
        if (autoReproTimeout) {
          clearTimeout(autoReproTimeout);
          autoReproTimeout = null;
        }
      }
    } else { // sel === 0
      // Hide panel if no crabs are selected (after initial timeout logic handles the first 7s)
      if (!initialHideTimeout) { // Only hide if the initial timer isn't running
        info.style.display = 'none'; 
      }
      // Clear auto-repro timeout if selection drops below 2
      if (autoReproTimeout) {
          clearTimeout(autoReproTimeout);
          autoReproTimeout = null;
      }
    }
  }

// --- Auto Reproduction Logic --- START
let autoReproTimeout = null; // Timeout ID for delayed reproduction

// New function to handle the reproduction logic previously in breedNextGeneration
// This needs access to populationRef, W, H, ctx, configRef, GENE, etc.
function triggerManualReproduction() {
    if (!populationRef || !configRef || !geneRef || !canvasRef) return; // Guards

    const chosen = populationRef.filter(c => c.selected);
    if (chosen.length < 2) return; // Should not happen if called via timeout, but check anyway

    // Basic reproduction between the first two selected crabs
    // Using the existing triggerReproduction logic, but it needs population access
    // For simplicity, let's directly call the core logic here or refactor reproduction.js further.

    // We need a way to add offspring back. Let's mimic the deferred update
    let newOffspring = [];
    const parentA = chosen[0];
    const parentB = chosen[1];

    // Force reproduction - call triggerReproduction directly
    const reproResult = triggerReproduction(
        parentA,
        parentB,
        configRef,
        geneRef,
        canvasRef.width, // W
        canvasRef.height, // H
        clamp, // Need clamp from util
        rand, // Need rand from util
        canvasRef.getContext('2d') // ctx
    );
    if (reproResult.offspring) {
        newOffspring.push(reproResult.offspring); // Add to temporary array
        // Optional effect
        // createCollisionEffect(...);
    }

    // Add the offspring to the main population (if any were created)
    if (newOffspring.length > 0) {
        populationRef.push(...newOffspring);
    }

    // Deselect all crabs after reproduction
    populationRef.forEach(crab => crab.selected = false);
    updateInfoPanel(); // Update UI to reflect deselection
}
// --- Auto Reproduction Logic --- END