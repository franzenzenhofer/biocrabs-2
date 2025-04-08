import { getGene as utilGetGene, getFormattedGene as utilGetFormattedGene, clamp, rand } from './util.js';
import { triggerReproduction, mutate, createRandomGenotype, applyBodySymmetry, applyMovementSymmetry } from './reproduction.js';
import { createBirthEffect } from './animations.js'; // Need birth effect

// Module-scoped variables
let canvasRef = null;
let populationRef = null;
let configRef = null;
let getGeneFn = null; // Still needed if external calls expect it
let geneRef = null;
let globalUpdateFunctionsRef = null; // Ref to main loop's update functions if needed
let requestCrabCreationFn = null; // Function passed from index.html to request creation

let initialHideTimeout = null;
let hammerInstance = null; // Hammer.js instance

// Initialization function - Needs more refs now
export function initUI(canvas, population, config, geneEnum, globalUpdateFunctions) {
    canvasRef = canvas;
    populationRef = population;
    configRef = config;
    geneRef = geneEnum;
    globalUpdateFunctionsRef = globalUpdateFunctions; // Store ref
    requestCrabCreationFn = globalUpdateFunctions.requestCrabCreation; // Store the request function from globalUpdateFunctions (or similar structure)

    getGeneFn = utilGetGene; // Use local util function directly

    const info = document.getElementById('infoPanel');
    if (info) {
        // Define initial info content with close button
        info.innerHTML = `
            <button id="closeInfoButton" class="info-close-button">&times;</button>
            <div><strong>Controls:</strong></div>
            <div>Tap a crab: Select/Deselect</div>
            <div>Selected crabs can be cloned, mutated, or deleted.</div>
            <div>Double-tap empty space: Create Crab</div>
        `;
        info.classList.add('initial-info'); // Add class for specific styling
        info.style.display = 'block';

        // Add close button functionality
        const closeButton = document.getElementById('closeInfoButton');
        if (closeButton) {
            closeButton.onclick = () => {
                info.style.display = 'none';
                if (initialHideTimeout) {
                    clearTimeout(initialHideTimeout);
                    initialHideTimeout = null;
                }
            };
        }

        // Auto-hide logic remains
        if (initialHideTimeout) clearTimeout(initialHideTimeout);
        initialHideTimeout = setTimeout(() => {
            // Only hide if no crabs are selected (panel content hasn't changed)
            if (populationRef && populationRef.filter(c => c.selected).length === 0) {
                // Check if the close button still exists - if so, means the initial panel is still showing
                if (document.getElementById('closeInfoButton')) {
                    info.style.display = 'none';
                }
            }
            initialHideTimeout = null;
        }, 7000); // 7 seconds
    }

    // Setup Hammer.js
    if (hammerInstance) {
        hammerInstance.destroy(); // Clean up previous instance if re-initializing
    }
    hammerInstance = new Hammer(canvasRef, {
        // Explicitly recognize double tap along with single tap
        recognizers: [
            [Hammer.Tap, { event: 'doubletap', taps: 2 }],
            [Hammer.Tap, { event: 'tap' }] // Single tap
        ]
    });
    // Prevent single taps from firing when a double tap is possible
    hammerInstance.get('doubletap').recognizeWith('tap');
    hammerInstance.get('tap').requireFailure('doubletap');

    // Event Listeners using Hammer
    hammerInstance.on('tap', handleTap);
    hammerInstance.on('doubletap', handleDoubleTap); // Add double tap listener

    // Initial UI update
    updateInfoPanel();
}

// --- Hammer.js Event Handlers ---

function handleTap(e) {
    if (!canvasRef || !populationRef || !configRef || !geneRef) return;

    // Prevent hiding panel if user interacts
    if (initialHideTimeout) {
        clearTimeout(initialHideTimeout);
        initialHideTimeout = null;
    }

    const { x, y } = getCanvasCoordinates(e);
    let selectionChanged = false;
    let clickedCrab = null;

    // Find the crab that was clicked (if any)
    for (const crab of populationRef) {
        const visualRadius = utilGetGene(crab.genotype, geneRef.RADIUS);
        const selectionRadius = visualRadius * 1.5; // Increase clickable radius by 50%
        const dx = x - crab.x;
        const dy = y - crab.y;

        if (dx * dx + dy * dy <= selectionRadius * selectionRadius) { // Use selectionRadius here
            clickedCrab = crab;
            break;
        }
    }

    const selectedCrabs = populationRef.filter(c => c.selected);
    const selCount = selectedCrabs.length;

    if (clickedCrab) {
        // --- Case 1: Tapped on a crab ---
        selectionChanged = true; // Assume change unless it's a 3rd selection

        if (clickedCrab.selected) {
            // Tapped an already selected crab: Deselect it
            clickedCrab.selected = false;
        } else {
            // Tapped an unselected crab
            if (selCount < 2) {
                // If 0 or 1 crabs are selected, select this one
                clickedCrab.selected = true;
            } else {
                // If 2+ crabs are selected, deselect all others and select this one
                populationRef.forEach(c => c.selected = false);
                clickedCrab.selected = true;
            }
        }
    } else {
        // --- Case 2: Tapped empty space ---
        if (selCount > 0) {
            // If any crabs were selected, deselect all
            populationRef.forEach(c => c.selected = false);
            selectionChanged = true;
        }
        // If no crabs were selected, tapping empty space does nothing
    }

    // Trigger UI update if the selection state changed
    if (selectionChanged) {
        updateInfoPanel();
    }
}

function handleDoubleTap(e) {
    if (!canvasRef || !populationRef || !configRef || !geneRef || !requestCrabCreationFn) return;

    // Prevent hiding panel if user interacts
    if (initialHideTimeout) {
        clearTimeout(initialHideTimeout);
        initialHideTimeout = null;
    }

    const { x, y } = getCanvasCoordinates(e);
    let clickedOnCrab = false;

    // Check if the double tap landed on an existing crab
    for (const crab of populationRef) {
        const radius = utilGetGene(crab.genotype, geneRef.RADIUS);
        const dx = x - crab.x;
        const dy = y - crab.y;
        if (dx * dx + dy * dy <= radius * radius) {
            clickedOnCrab = true;
            break;
        }
    }

    // If double tapped empty space, request crab creation
    if (!clickedOnCrab) {
        console.log("Requesting crab creation at:", x.toFixed(0), y.toFixed(0));
        requestCrabCreationFn(x, y);
        // Maybe provide quick feedback?
        // updateInfoPanelWithMessage("Creating crab...", 500);
    } else {
        // Optional: Handle double tap on a crab differently? (e.g., select and focus?)
        // For now, do nothing if double tap is on a crab.
        console.log("Double tap on existing crab ignored for creation.");
    }
}

// --- Helper Functions ---

function getCanvasCoordinates(event) {
    const rect = canvasRef.getBoundingClientRect();
    // Use Hammer's center point for press/tap events
    const x = event.center.x - rect.left;
    const y = event.center.y - rect.top;
    return { x, y };
}

function mutateGeneRandomly(crab) {
     if (!crab || !crab.genotype || !configRef || !geneRef) return;

     const numMutations = 3; // Mutate multiple genes for a stronger effect
     console.log(`Applying ${numMutations} mutations to crab:`, crab);

     for (let i = 0; i < numMutations; i++) {
         const geneIndex = Math.floor(Math.random() * crab.genotype.length);
         const oldValue = crab.genotype[geneIndex];

         // Apply a stronger mutation
         if (geneIndex === geneRef.COLOR_R || geneIndex === geneRef.COLOR_G || geneIndex === geneRef.COLOR_B) {
             crab.genotype[geneIndex] += rand(-100, 100); // Increased range
         } else if (geneIndex === geneRef.SIDES) {
              // Sides mutation should be additive integer change
              crab.genotype[geneIndex] += rand(-2, 2); // Change by +/- 1 or 2
         } else {
             crab.genotype[geneIndex] *= 1 + rand(-0.4, 0.4); // Increased range
         }

         // Log the specific mutation
         console.log(`  Mutated gene ${geneIndex} from ${oldValue.toFixed(2)} to ${crab.genotype[geneIndex].toFixed(2)}`);
     }

     // --- Additive Color Mutation for Visibility --- START
     const colorGenes = [geneRef.COLOR_R, geneRef.COLOR_G, geneRef.COLOR_B];
     const colorGeneToMutate = colorGenes[Math.floor(Math.random() * colorGenes.length)];
     const oldColorValue = crab.genotype[colorGeneToMutate];
     crab.genotype[colorGeneToMutate] += rand(-100, 100);
     console.log(`  + Visibly mutated color gene ${colorGeneToMutate} from ${oldColorValue.toFixed(0)} to ${crab.genotype[colorGeneToMutate].toFixed(0)} (pre-clamp)`);
     // --- Additive Color Mutation for Visibility --- END

     // Apply comprehensive clamps after all mutations
      crab.genotype[geneRef.SIDES] = clamp(Math.round(crab.genotype[geneRef.SIDES]), 3, 8);

      // Example: Add more clamps based on genes defined in gene.js (assuming structure)
      // These need to align with your GENE enum and expected ranges
      crab.genotype[geneRef.RADIUS] = clamp(crab.genotype[geneRef.RADIUS], 5, 50);
      crab.genotype[geneRef.ELONGATION] = clamp(crab.genotype[geneRef.ELONGATION], 0.5, 2.0);
      crab.genotype[geneRef.ORIENT] = crab.genotype[geneRef.ORIENT]; // Orientation might not need clamp, depends on usage
      crab.genotype[geneRef.TURN_SPEED] = clamp(crab.genotype[geneRef.TURN_SPEED], 0.1, 5.0);
      crab.genotype[geneRef.THRUST_POWER] = clamp(crab.genotype[geneRef.THRUST_POWER], 10, 500);
      crab.genotype[geneRef.THRUST_DURATION] = clamp(crab.genotype[geneRef.THRUST_DURATION], 0.1, 2.0);
      crab.genotype[geneRef.THRUST_COOLDOWN] = clamp(crab.genotype[geneRef.THRUST_COOLDOWN], 0.2, 5.0);

      // Color clamps (keep these)
       crab.genotype[geneRef.COLOR_R] = clamp(Math.round(crab.genotype[geneRef.COLOR_R]), 0, 255);
       crab.genotype[geneRef.COLOR_G] = clamp(Math.round(crab.genotype[geneRef.COLOR_G]), 0, 255);
       crab.genotype[geneRef.COLOR_B] = clamp(Math.round(crab.genotype[geneRef.COLOR_B]), 0, 255);

       // Add clamps for any other genes you have (e.g., EYE_*, LEG_*, etc.)
       // crab.genotype[geneRef.EYE_ANGLE] = clamp(crab.genotype[geneRef.EYE_ANGLE], ...);

      // Clear the gene cache for this crab as its genotype changed
      crab._geneCache = {};

      // Optional: Visual feedback for mutation? (e.g., small flash)
 }

// --- Info Panel Update ---

export function updateInfoPanel() {
    if (!populationRef || !configRef || !geneRef) return;

    const info = document.getElementById('infoPanel');
    if (!info) {
        console.error("#infoPanel element not found!");
        return;
    }

    const selectedCrabs = populationRef.filter(c => c.selected);
    const selCount = selectedCrabs.length;

    // Add CSS for buttons if not already present
    addButtonStyleOnce();

    if (selCount === 1) {
        const crab = selectedCrabs[0];
        info.style.display = 'block';
        const energyPercent = Math.round((crab.energy / configRef.MAX_ENERGY) * 100);
        let energyColor = '#8eff8e'; // Green
        if (energyPercent <= 30) energyColor = '#ffcf8e'; // Orange
        if (energyPercent <= 10) energyColor = '#ff9e8e'; // Red

        // Show crab info and buttons
        info.innerHTML = `
          <div style="font-weight:bold;margin-bottom:5px;color:#8CD5FF">Selected Crab</div>
          <div style="font-size:1.1em;margin-bottom:5px">
            Energy: <span style="color:${energyColor};font-weight:bold">${energyPercent}%</span>
            <span style="font-size:0.8em;opacity:0.7"> (${Math.round(crab.energy)}/${configRef.MAX_ENERGY})</span>
          </div>
          <hr style="border:none;border-top:1px solid rgba(255,255,255,0.2);margin:8px 0">
          <div class="button-container">
            <button id="mutateButton" class="info-button mutate">Mutate</button>
            <button id="cloneButton" class="info-button">Clone</button>
            <button id="deleteButton" class="info-button delete">Delete</button>
          </div>
           <div style="font-size:0.8em;margin-top:8px;opacity:0.8">
            Tap empty space to deselect.
            Double tap empty space to create.
          </div>
        `;

        // Add event listeners for the buttons
        document.getElementById('mutateButton')?.addEventListener('click', () => mutateGeneRandomly(crab));
        document.getElementById('cloneButton')?.addEventListener('click', () => cloneCrab(crab));
        document.getElementById('deleteButton')?.addEventListener('click', () => deleteCrab(crab));
        clearAutoReproTimeout(); // Clear breed timeout if selection drops to 1

    } else if (selCount >= 2) {
        // Keep the auto-breed logic for 2+ selected (optional)
        info.style.display = 'block';
        info.innerHTML = `
         <div style="font-weight:bold;margin-bottom:5px;color:#8CD5FF">${selCount} Crabs Selected</div>
         <div style="font-size:0.9em;margin-bottom:8px;opacity:0.9">Auto-breeding soon...</div>
         <button id="cancelBreedButton" class="info-button cancel">Cancel</button>
          <div style="font-size:0.8em;margin-top:8px;opacity:0.8">
            Tap empty space to deselect all.
          </div>
        `;
        triggerAutoReproductionWithTimeout(selectedCrabs); // Start or reset timeout
        document.getElementById('cancelBreedButton')?.addEventListener('click', () => {
            populationRef.forEach(crab => crab.selected = false);
            updateInfoPanel();
        });

    } else { // sel === 0
        // Hide panel if no crabs are selected (and initial timeout finished)
        if (!initialHideTimeout) {
            info.style.display = 'none';
        }
        clearAutoReproTimeout(); // Clear breed timeout if selection drops to 0
        // Remove button listeners if panel is hidden? Not strictly necessary if innerHTML is cleared.
    }
}

// --- Button Action Functions ---

function cloneCrab(originalCrab) {
    if (!originalCrab || !populationRef || !configRef || !geneRef || !canvasRef) return;

    console.log("Cloning crab:", originalCrab);

    // Energy Cost - We still calculate it for the crab's starting energy, but don't block based on environment energy.
    const energyCost = configRef.BASE_ENERGY;
    // --- REMOVED ENVIRONMENT ENERGY CHECK --- START

    // if (environmentEnergyRef.value >= energyCost) {\n\
    //     environmentEnergyRef.value -= energyCost; // Deduct from wrapper\n\
    // } else {\n\
    //     console.warn(\"Not enough environment energy to clone crab.\");\n\
    //     updateInfoPanelWithMessage(\"Not enough energy to clone!\");\n\
    //     return;\n\
    // }\n\
    // --- REMOVED ENVIRONMENT ENERGY CHECK --- END

    const cloneGeno = [...originalCrab.genotype];
    const cloneRadius = utilGetGene(cloneGeno, geneRef.RADIUS);
    let cloneX, cloneY;
    let attempts = 0;
    const maxAttempts = 20;
    const minDistance = cloneRadius * 2.5;

    do {
        const angle = Math.random() * Math.PI * 2;
        const distance = minDistance + rand(0, 50);
        cloneX = originalCrab.x + Math.cos(angle) * distance;
        cloneY = originalCrab.y + Math.sin(angle) * distance;
        cloneX = clamp(cloneX, cloneRadius, canvasRef.width - cloneRadius);
        cloneY = clamp(cloneY, cloneRadius, canvasRef.height - cloneRadius);
        attempts++;
    } while (attempts < maxAttempts);

    const newCrab = {
        genotype: cloneGeno,
        x: cloneX, y: cloneY,
        vx: 0, vy: 0,
        orientation: originalCrab.orientation,
        omega: 0,
        selected: false,
        energy: energyCost,
        markedForCulling: false,
        _fx: 0, _fy: 0, _torque: 0, _inertia: 1, _currentThrust: 0,
        _geneCache: {},
    };

    populationRef.push(newCrab);
    createBirthEffect(newCrab.x, newCrab.y, cloneRadius);

    // Deselect original crab after cloning
    originalCrab.selected = false;
    updateInfoPanel(); // Update UI
}

function deleteCrab(crabToDelete) {
    if (!crabToDelete || !populationRef) return;
    console.log("Deleting crab:", crabToDelete);
    // Set energy to 0; the main loop's death check will handle removal and effect
    crabToDelete.energy = 0;
    crabToDelete.selected = false; // Deselect
    updateInfoPanel(); // Update UI
}


// --- Auto Reproduction Logic ---
let autoReproTimeoutId = null;

function clearAutoReproTimeout() {
    if (autoReproTimeoutId) {
        clearTimeout(autoReproTimeoutId);
        autoReproTimeoutId = null;
    }
}

function triggerAutoReproductionWithTimeout(selectedCrabs) {
    clearAutoReproTimeout(); // Clear existing timeout first
    autoReproTimeoutId = setTimeout(() => {
        // Check if still >= 2 crabs selected before breeding
        if (populationRef.filter(c => c.selected).length >= 2) {
             // Use the first two selected for simplicity
            triggerManualReproductionBetween(selectedCrabs[0], selectedCrabs[1]);
        }
        autoReproTimeoutId = null; // Clear the ID after execution/check
    }, 1500); // 1.5 seconds delay
}


function triggerManualReproductionBetween(parentA, parentB) {
    if (!parentA || !parentB || !populationRef || !configRef || !geneRef || !canvasRef) return;

    // Call the centralized reproduction function
    const reproResult = triggerReproduction(
        parentA, parentB,
        configRef, geneRef,
        canvasRef.width, canvasRef.height,
        clamp, rand,
        canvasRef.getContext('2d') // Need context if repro function uses it (e.g., for effects)
    );

    if (reproResult.offspring) {
        populationRef.push(reproResult.offspring);
        // Optional: Add birth effect here if not handled by triggerReproduction
        // createBirthEffect(reproResult.offspring.x, reproResult.offspring.y, utilGetGene(reproResult.offspring.genotype, geneRef.RADIUS));
        console.log("Auto-reproduction successful.");
    } else {
        console.log("Auto-reproduction conditions not met or failed.");
        // Optionally provide feedback if reproduction failed (e.g., insufficient energy)
        // This would require triggerReproduction to return a reason for failure.
    }

    // Deselect all after attempt
    populationRef.forEach(crab => crab.selected = false);
    updateInfoPanel();
}

// --- UI Helpers ---
function addButtonStyleOnce() {
    const styleId = 'ui-dynamic-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
        /* Initial Info Panel Specific Styles */
        .initial-info {
            position: absolute; /* Or relative to its container */
            top: 10px;
            right: 10px;
            background-color: rgba(40, 40, 60, 0.85); /* Darker semi-transparent */
            color: #e0e0e0; /* Light text */
            padding: 10px 15px;
            border-radius: 6px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            font-size: 0.9em;
            line-height: 1.4;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            z-index: 1001; /* Ensure it's above canvas but below modals if any */
            max-width: 250px; /* Prevent it getting too wide */
        }
        .initial-info strong {
            color: #8CD5FF; /* Highlight color */
        }
        .info-close-button {
            position: absolute;
            top: 2px;
            right: 5px;
            background: none;
            border: none;
            color: #aaa; /* Lighter gray for X */
            font-size: 1.4em;
            font-weight: bold;
            cursor: pointer;
            padding: 0 2px;
            line-height: 1;
        }
        .info-close-button:hover {
            color: #fff; /* White on hover */
        }

        /* Existing Button Styles */
        .button-container {
            display: flex;
            gap: 8px; /* Spacing between buttons */
            margin-top: 8px;
        }
        .info-button {
            padding: 5px 10px;
            border: 1px solid rgba(255, 255, 255, 0.4);
            background-color: rgba(80, 80, 100, 0.7);
            color: #e0e0e0;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9em;
            transition: background-color 0.2s, border-color 0.2s;
            flex-grow: 1; /* Make buttons fill container */
            text-align: center;
        }
        .info-button:hover {
            background-color: rgba(100, 100, 120, 0.8);
            border-color: rgba(255, 255, 255, 0.6);
        }
        .info-button.mutate {
            background-color: rgba(100, 60, 140, 0.7); /* Purple */
        }
        .info-button.mutate:hover {
            background-color: rgba(120, 80, 160, 0.8);
        }
        .info-button.delete, .info-button.cancel {
            background-color: rgba(140, 60, 60, 0.7); /* Reddish */
        }
        .info-button.delete:hover, .info-button.cancel:hover {
            background-color: rgba(160, 80, 80, 0.8);
        }
    `;
    document.head.appendChild(style);
}

function updateInfoPanelWithMessage(message, duration = 2000) {
     const info = document.getElementById('infoPanel');
     if (!info) return;
     const originalContent = info.innerHTML;
     info.innerHTML = `<div style="padding: 5px; text-align: center; color: #ffcf8e;">${message}</div>`;
     info.style.display = 'block';
     setTimeout(() => {
         // Restore previous content ONLY if the selection state hasn't changed
         // For simplicity, we'll just call updateInfoPanel which handles current state
         updateInfoPanel();
     }, duration);
 }

// --- Remove Old Functions ---
// export function onCanvasClick(e) { ... } // Replaced by Hammer tap
// export function breedNextGeneration() { ... } // Logic moved into triggerManualReproduction

