let canvas = document.getElementById('antCanvas');
let ctx = canvas.getContext('2d');

let width, height;
const cellSize = 1; // Logical size of each cell (we zoom the canvas, not change this)
let grid; // Keep the declaration
const defaultColor = 0; // The color of an empty, unvisited cell (usually black)
let ants = []; // Array to hold multiple ants
let gridCols = 0, gridRows = 0; // These are still used for initial ant placement and camera reset
let intervalId = null;
let stepsPerTick; // Number of steps to run per interval tick
let isRunning = true; // Simulation starts running

// View transformation state
const initialScale = 8; // Define initial scale
let scale = initialScale; // Use constant for initial value
let offsetX = 0;
let offsetY = 0;
let lastMouseX = 0;
let lastMouseY = 0;
let isDragging = false;

// Zoom constraints
const minScale = 0.1;
const maxScale = 50;
const zoomFactor = 1.1;

// Speed configuration (Simplified)
const slowModeThreshold = 1000 / 16; // ~62.5 FPS threshold (using 16ms as a reference)

const directions = [
    { dx: 0, dy: -1 }, // North
    { dx: 1, dy: 0 },  // East
    { dx: 0, dy: 1 },  // South
    { dx: -1, dy: 0 }  // West
];

let currentIntervalId = null;
let currentIntervalDelay = 0;
let currentStepsPerTick = 1;
let timeoutId = null; // ID for setTimeout loop (replaced animationFrameId)

// --- Configuration ---
const minSimSpeed = 1;       // Min Steps/Sec at slider value 1
const midSimSpeed = 60;      // Steps/Sec at slider midpoint (50)
const maxSimSpeed = 100000;   // Max Target Steps/Sec at slider value 100 (Adjusted)
const maxStepsPerLoopIteration = 100000; // Safety limit

// Define neon cell colors (up to 12)
const cellColors = [
    '#000000', // 0: Black (Background)
    '#FFFFFF', // 1: White 
    '#FF00FF', // 2: Magenta/Fuchsia
    '#FFFF00', // 3: Yellow
    '#00FF00', // 4: Lime
    '#00FFFF', // 5: Cyan/Aqua
    '#FF0000', // 6: Red 
    '#FFA500', // 7: Orange
    '#0000FF', // 8: Blue
    '#FF69B4', // 9: Hot Pink
    '#DA70D6', // 10: Orchid
    '#8A2BE2'  // 11: BlueViolet
];
const maxPossibleColors = cellColors.length; // Should now be 12
// const numColors = cellColors.length; // Removed, numColors used is variable now

// --- Turmite Rule Definition (Mutable) ---
let rules = {}; // Initialize as empty

// --- State Storage for Discard --- 
let lastAppliedState = {};

// Function to generate random rules with variable states/colors
function generateRandomRules(numStates, numColorsToUse) {
    const newRules = {};
    const moveRelativeCheck = document.getElementById('moveRelativeCheck');
    const moveAbsoluteCheck = document.getElementById('moveAbsoluteCheck');
    const moveRandomCheck = document.getElementById('moveRandomCheck');

    const useRelative = moveRelativeCheck ? moveRelativeCheck.checked : true; // Default true
    const useAbsolute = moveAbsoluteCheck ? moveAbsoluteCheck.checked : false;
    const useRandom = moveRandomCheck ? moveRandomCheck.checked : false;

    let moveOptions = ['S']; // 'S' is always available
    if (useRelative) {
        moveOptions.push('L', 'R', 'N', 'U');
    }
    if (useAbsolute) {
        moveOptions.push('^', '>', 'v', '<');
    }
    if (useRandom) {
        moveOptions.push('?');
    }
    // Ensure there's at least one move option if all are unchecked (fallback to S, which is already there)
    if (moveOptions.length === 1 && moveOptions[0] === 'S' && !useRelative && !useAbsolute && !useRandom) {
        // If only S is present because all checkboxes were somehow unchecked (e.g. by dev tools)
        // and S was the only thing, let's add N as a minimal non-staying move.
        // However, S is always present by default, so this case might be rare unless S is removed above.
        // Let's ensure 'N' if options are truly empty otherwise.
        if(moveOptions.length === 0) moveOptions.push('N'); 
    }
    if (moveOptions.length === 0) moveOptions.push('N'); // Final fallback if list is empty

    for (let s = 0; s < numStates; s++) {
        newRules[s] = [];
        for (let c = 0; c < numColorsToUse; c++) {
            // Write one of the *used* colors (index 0 to numColorsToUse-1)
            const writeColor = Math.floor(Math.random() * numColorsToUse);
            const moveIndex = Math.floor(Math.random() * moveOptions.length);
            const move = moveOptions[moveIndex];
            const nextState = Math.floor(Math.random() * numStates);
            newRules[s].push({ writeColor, move, nextState });
        }
    }
    rules = newRules;
}

// Helper function to generate rules for a single ant
function generateRandomRulesForAnt(numStates, numColorsToUse) {
    const antSpecificRules = {};
    const moveRelativeCheck = document.getElementById('moveRelativeCheck');
    const moveAbsoluteCheck = document.getElementById('moveAbsoluteCheck');
    const moveRandomCheck = document.getElementById('moveRandomCheck');

    const useRelative = moveRelativeCheck ? moveRelativeCheck.checked : true;
    const useAbsolute = moveAbsoluteCheck ? moveAbsoluteCheck.checked : false;
    const useRandom = moveRandomCheck ? moveRandomCheck.checked : false;

    let moveOptions = ['S']; // 'S' is always available
    if (useRelative) {
        moveOptions.push('L', 'R', 'N', 'U');
    }
    if (useAbsolute) {
        moveOptions.push('^', '>', 'v', '<');
    }
    if (useRandom) {
        moveOptions.push('?');
    }
    if (moveOptions.length === 0) moveOptions.push('N'); // Fallback if all are somehow unchecked

    for (let s = 0; s < numStates; s++) {
        antSpecificRules[s] = [];
        for (let c = 0; c < numColorsToUse; c++) {
            const writeColor = Math.floor(Math.random() * numColorsToUse);
            const moveIndex = Math.floor(Math.random() * moveOptions.length);
            const move = moveOptions[moveIndex];
            const nextState = Math.floor(Math.random() * numStates);
            antSpecificRules[s].push({ writeColor, move, nextState });
        }
    }
    return antSpecificRules;
}

// --- State Variables ---
let simulationTimeoutId = null;   // ID for simulation setTimeout loop
let nextStepTime = 0;             // Target time for the next simulation step
let renderRequestId = null;       // ID for render requestAnimationFrame
let pauseTime = 0; // Added: Store time when paused
let cellsToUpdate = new Set(); // Combined set for all redraw locations
let needsFullRedraw = true; // Flag to trigger full grid redraw

// --- Mapping Function ---
function mapSliderToSpeed(sliderValue) {
    const sliderMin = 1;
    const sliderMax = 100;
    const sliderMid = 50;

    if (sliderValue == sliderMid) {
        return midSimSpeed;
    } else if (sliderValue < sliderMid) {
        // Linear mapping for the lower half: [1, 50) -> [minSimSpeed, midSimSpeed)
        const speed = minSimSpeed + (sliderValue - sliderMin) * (midSimSpeed - minSimSpeed) / (sliderMid - sliderMin);
        return Math.max(minSimSpeed, speed);
    } else { // sliderValue > sliderMid
        // Exponential mapping for the upper half: (50, 100] -> (midSimSpeed, maxSimSpeed]
        const power = 3; // Adjust power for desired curve (e.g., 2, 3, 4)
        const normalizedInput = (sliderValue - sliderMid) / (sliderMax - sliderMid);
        const scaledOutput = Math.pow(normalizedInput, power);
        const speed = midSimSpeed + scaledOutput * (maxSimSpeed - midSimSpeed);
        return Math.min(maxSimSpeed, speed); // Clamp at max
    }
}

function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;

    // Recalculate offset to re-center the *logical origin (0,0)* 
    // This keeps the view centered relative to where it was, approximately.
    // If specific centering on grid is needed, more complex logic involving gridCols/Rows
    // might be required, but let's keep it simple for now.
    // offsetX = width / 2 - ... (removed complex centering)
    // offsetY = height / 2 - ...
    // Simply adjusting canvas size usually doesn't require recentering if panning/zooming is used.
    // We *do* need to trigger a full redraw.

    setCanvasSmoothing(false);
    needsFullRedraw = true; // Flag for full redraw

    // Request a draw. If running, renderLoop will handle it.
    // If paused, this ensures the resized view is drawn.
    if (!renderRequestId && !isRunning) {
        requestAnimationFrame(draw);
    }
}

function setCanvasSmoothing(enabled) {
     if (!ctx) return; // Add check for context existence
     ctx.imageSmoothingEnabled = enabled;
     ctx.mozImageSmoothingEnabled = enabled;
     ctx.webkitImageSmoothingEnabled = enabled;
     ctx.msImageSmoothingEnabled = enabled;
}

// --- Helper Functions ---

/**
 * Initializes or resets the grid to an empty state (a new Map).
 */
function initGrid() {
    grid = new Map();
    cellsToUpdate.clear(); // Clear any pending updates
    needsFullRedraw = true; // Ensure a full redraw after grid reset
}

/**
 * Gets the color of a cell from the dynamic grid.
 * @param {number} x The x-coordinate.
 * @param {number} y The y-coordinate.
 * @returns {number} The color index of the cell.
 */
function getGridColor(x, y) {
    // If the map doesn't have the key, it's a default background cell.
    return grid.get(`${x},${y}`) ?? defaultColor;
}

/**
 * Sets the color of a cell in the dynamic grid.
 * Optimizes by removing cells that are set back to the default color.
 * @param {number} x The x-coordinate.
 * @param {number} y The y-coordinate.
 * @param {number} color The color index to set.
 */
function setGridColor(x, y, color) {
    const key = `${x},${y}`;
    if (color === defaultColor) {
        // Optimization: If writing the default color, remove from map to save memory.
        grid.delete(key);
    } else {
        grid.set(key, color);
    }
}

// Helper function to update visibility and state of Individual Rules controls
function updateIndividualRulesVisibility(antCount, rulesDisplayContainer, individualRulesContainer, individualRulesCheck, rulesDisplayPre) {
    const showIndividualOption = antCount > 1;

    // 1. Show/Hide the individual rules checkbox container
    if (individualRulesContainer) {
        individualRulesContainer.classList.toggle('hidden', !showIndividualOption);
    }

    // 2. Enable/Disable and Uncheck the checkbox if ant count is 1
    let isIndividualChecked = false;
    if (individualRulesCheck) {
        individualRulesCheck.disabled = !showIndividualOption;
        if (!showIndividualOption && individualRulesCheck.checked) {
            individualRulesCheck.checked = false;
            // If disabling the checkbox makes it unchecked, enable Apply button
            const applyBtn = document.getElementById('applyBtn');
             if (applyBtn) applyBtn.disabled = false; 
        }
        // Read the *final* state of the checkbox AFTER potential unchecking
        isIndividualChecked = individualRulesCheck.checked;
    }

    // 3. Show/Hide the entire rule section container based ONLY on checkbox state
    if (rulesDisplayContainer) {
        rulesDisplayContainer.classList.toggle('hidden', isIndividualChecked);
    }

    // 4. If the container is hidden (Individual Rules is ON),
    //    ensure the rule editor <pre> tag is also hidden.
    //    Otherwise, leave the <pre> tag's visibility alone (respect manual toggle).
    if (rulesDisplayPre && isIndividualChecked) {
        rulesDisplayPre.classList.add('hidden');
    }
    // NO 'else' block here - do not force visibility if container is shown.

    // Note: Apply button state related to rule text changes is handled by its own listener.
    // Apply button state related to ant count changes is handled by its listener.
}

function initAnts(preservedIndividualRules = null) {
    ants = [];
    cellsToUpdate.clear();
    if (gridCols <= 0 || gridRows <= 0) { return; }

    // Get controls needed for ant setup
    const antCountInput = document.getElementById('antCountInput');
    const startPositionSelect = document.getElementById('startPositionSelect');
    const startDirectionSelect = document.getElementById('startDirectionSelect'); // Get direction select
    const individualRulesCheck = document.getElementById('individualRulesCheck');
    const rulesDisplayPre = document.getElementById('rulesDisplay'); // Get the pre tag itself
    const saveRuleBtn = document.getElementById('saveRuleBtn'); // Get save button
    const loadRuleBtn = document.getElementById('loadRuleBtn'); // Get load button
    const presetSelect = document.getElementById('presetSelect'); // Get preset select
    const toggleRandomizeOptionsBtn = document.getElementById('toggleRandomizeOptionsBtn'); // New
    const randomizeOptionsContent = document.getElementById('randomizeOptionsContent'); // New
    const moveRelativeCheck = document.getElementById('moveRelativeCheck'); // New
    const moveAbsoluteCheck = document.getElementById('moveAbsoluteCheck'); // New
    const moveRandomCheck = document.getElementById('moveRandomCheck'); // New

    const startMode = startPositionSelect ? startPositionSelect.value : 'center';
    const startDirMode = startDirectionSelect ? startDirectionSelect.value : '0'; // Read direction mode
    const numAntsToCreate = antCountInput ? parseInt(antCountInput.value, 10) : 1;
    const validatedAntCount = Math.max(1, Math.min(1024, numAntsToCreate || 1));
    const useIndividualRules = individualRulesCheck ? individualRulesCheck.checked && validatedAntCount > 1 : false;

    // Read max states/colors for potential individual rule generation
    const possibleStatesInput = document.getElementById('possibleStatesInput');
    const possibleColorsInput = document.getElementById('possibleColorsInput');
    const maxStates = possibleStatesInput ? parseInt(possibleStatesInput.value, 10) : 2;
    const maxColors = possibleColorsInput ? parseInt(possibleColorsInput.value, 10) : 2;
    const validatedMaxStates = Math.max(1, Math.min(100, maxStates || 1));
    const validatedMaxColors = Math.max(2, Math.min(maxPossibleColors, maxColors || 2));

    const centerX = Math.floor(gridCols / 2);
    const centerY = Math.floor(gridRows / 2);
    const occupied = new Set(); // To track occupied spots for random/grid modes

    console.log(`Initializing ${validatedAntCount} ants. Mode: ${startMode}, Dir: ${startDirMode}, Indiv Rules: ${useIndividualRules}, Preserved Rules: ${preservedIndividualRules ? preservedIndividualRules.length : 'None'}`);

    for (let i = 0; i < validatedAntCount; i++) {
        let gridX, gridY;
        let attempts = 0;
        const MAX_ATTEMPTS = 2000;
        switch (startMode) {
            case 'random':
                do {
                    gridX = Math.floor(Math.random() * gridCols);
                    gridY = Math.floor(Math.random() * gridRows);
                    attempts++;
                } while (occupied.has(`${gridX},${gridY}`) && attempts < MAX_ATTEMPTS);
                if (attempts >= MAX_ATTEMPTS) {
                    console.warn("Could not find random unoccupied spot, placing potentially overlapping.");
                    // Fallback: place it anyway or skip?
                }
                break;

            case 'grid':
                // Basic grid logic: try to make it square-ish
                const gridRatio = gridCols / gridRows;
                let cols = Math.ceil(Math.sqrt(validatedAntCount * gridRatio));
                let rows = Math.ceil(validatedAntCount / cols);
                // Adjust cols/rows to ensure they fit within grid dimensions if needed
                cols = Math.min(cols, gridCols);
                rows = Math.min(rows, gridRows);
                // Recalculate if adjustment makes it too small
                if (cols * rows < validatedAntCount) {
                    rows = Math.ceil(validatedAntCount / cols);
                    if (cols * rows < validatedAntCount) { // If still too small, adjust cols
                         cols = Math.ceil(validatedAntCount / rows);
                    }
                }

                const spacingX = gridCols / (cols + 1);
                const spacingY = gridRows / (rows + 1);

                const colIndex = i % cols;
                const rowIndex = Math.floor(i / cols);

                gridX = Math.floor(spacingX * (colIndex + 1));
                gridY = Math.floor(spacingY * (rowIndex + 1));

                // Ensure it's within bounds (spacing calculation might push edge cases)
                gridX = Math.max(0, Math.min(gridCols - 1, gridX));
                gridY = Math.max(0, Math.min(gridRows - 1, gridY));

                // Check for overlap (unlikely with this grid logic, but possible)
                let originalGridX = gridX;
                let originalGridY = gridY;
                while(occupied.has(`${gridX},${gridY}`) && attempts < 100) {
                    gridX = (originalGridX + attempts) % gridCols;
                    gridY = originalGridY; // Simple fallback
                    attempts++;
                }
                break;

            case 'row':
                // Calculate width of the first row
                const rowWidth = Math.min(validatedAntCount, gridCols);
                // Calculate number of rows needed
                const numRows = Math.ceil(validatedAntCount / gridCols);

                // Calculate starting position for the top-left of the block
                const startX = Math.floor(centerX - rowWidth / 2);
                const startY = Math.floor(centerY - numRows / 2);

                const colOffset = i % gridCols; // Column within the current row
                const rowOffset = Math.floor(i / gridCols); // Which row we are on

                gridX = startX + colOffset;
                gridY = startY + rowOffset;

                // Check for overlap (extremely unlikely but possible if grid is tiny)
                if (occupied.has(`${gridX},${gridY}`)) {
                    console.warn(`Row placement overlap detected at ${gridX},${gridY}. Placing anyway.`);
                }
                break;

            case 'center': // Default / Fallback
            default:
                const clusterSize = Math.ceil(Math.sqrt(validatedAntCount));
                const offset = Math.floor(clusterSize / 2);
                gridX = centerX - offset + (i % clusterSize);
                gridY = centerY - offset + Math.floor(i / clusterSize);
                // Ensure within bounds, although less likely needed for center
                gridX = Math.max(0, Math.min(gridCols - 1, gridX));
                gridY = Math.max(0, Math.min(gridRows - 1, gridY));
                break;
        }

        // Ensure within bounds AFTER calculating specific position
        gridX = Math.max(0, Math.min(gridCols - 1, gridX || 0)); // Use || 0 as fallback if undefined
        gridY = Math.max(0, Math.min(gridRows - 1, gridY || 0));

        occupied.add(`${gridX},${gridY}`); // Mark as occupied

        let individualRule = null;
        // Check if using individual rules
        if (useIndividualRules) {
            // Prioritize using preserved rules if available for this index
            if (preservedIndividualRules && i < preservedIndividualRules.length && preservedIndividualRules[i]) {
                individualRule = preservedIndividualRules[i];
                // console.log(`Ant ${i}: Using preserved rule.`); // Optional log
            } else {
                // Otherwise, generate new random rules for this ant
                // console.log(`Ant ${i}: No preserved rule found or index out of bounds, generating new rule.`); // Optional log
                const antStates = Math.floor(Math.random() * validatedMaxStates) + 1;
                const antColors = Math.floor(Math.random() * (validatedMaxColors - 1)) + 2;
                individualRule = generateRandomRulesForAnt(antStates, antColors);
            }
        }
        // If not using individual rules, individualRule remains null, and the ant will use global rules

        // Determine initial direction
        let initialDir = 0; // Default North/Up
        if (startDirMode === 'random') {
            initialDir = Math.floor(Math.random() * 4);
        } else {
            const dirValue = parseInt(startDirMode, 10);
            if (!isNaN(dirValue) && dirValue >= 0 && dirValue < 4) {
                initialDir = dirValue;
            }
        }

        const newAnt = {
            x: gridX, y: gridY,
            dir: initialDir,
            state: 0,
            individualRule: individualRule // Assign preserved or newly generated rule
        };
        ants.push(newAnt);
        cellsToUpdate.add(`${gridX},${gridY}`);
    }
}

function resetCamera() {
    console.log("Resetting camera view to center initial grid...");
    scale = initialScale; // Reset scale

    // Calculate hypothetical grid dimensions based on initial scale
    const tempGridCols = Math.ceil(width / scale); 
    const tempGridRows = Math.ceil(height / scale);

    // Calculate the center of this hypothetical grid (in logical coordinates)
    const tempGridCenterX = tempGridCols / 2 * cellSize;
    const tempGridCenterY = tempGridRows / 2 * cellSize;

    // Calculate offset needed to place the grid center (scaled) at the viewport center
    offsetX = width / 2 - tempGridCenterX * scale;
    offsetY = height / 2 - tempGridCenterY * scale;

    console.log(`Reset Camera: Scale=${scale}, OffsetX=${offsetX.toFixed(1)}, OffsetY=${offsetY.toFixed(1)} based on grid ${tempGridCols}x${tempGridRows}`);

    setCanvasSmoothing(false);
    cellsToUpdate.clear();
    needsFullRedraw = true; // Trigger full redraw
    // No draw call needed here, render loop will pick it up
}

function initSimulation(randomize = false, numStates = 1, numColorsToUse = 2, wasRunning = true) {
    console.log(`initSimulation called. Randomize: ${randomize}, States: ${numStates}, Colors: ${numColorsToUse}, WasRunning: ${wasRunning}`);
    // Stop loops regardless of previous state to ensure clean reset
    stopSimulationLoop();
    stopRenderLoop();

    const individualRulesCheck = document.getElementById('individualRulesCheck');
    const useIndividual = individualRulesCheck ? individualRulesCheck.checked : false;
    const antCountInput = document.getElementById('antCountInput');
    const antCount = antCountInput ? parseInt(antCountInput.value, 10) : 1;

    // --- Preserve individual rules if resetting without randomizing ---
    let preservedIndividualRules = null;
    if (!randomize && useIndividual && antCount > 0 && ants.length > 0) {
        preservedIndividualRules = ants.map(ant => ant?.individualRule).filter(rule => rule); // Get existing rules
        console.log(`Preserving ${preservedIndividualRules.length} individual rules.`);
    }
    // --- End preservation ---

    if (randomize) {
        // Generate new global rules, even if individual is checked (provides a base)
        generateRandomRules(numStates, numColorsToUse);
    }
    // Load default global rules if none exist
    else if (Object.keys(rules).length === 0) {
        console.log("Generating default Langton's Ant rules (2 colors, 1 state).");
        numStates = 1; // Override defaults for Langton's
        numColorsToUse = 2;
        rules = {
             0: [
                 { writeColor: 1, move: 'R', nextState: 0 },
                 { writeColor: 0, move: 'L', nextState: 0 }
             ]
         };
     }

    // Reset dimensions, grid, ants
    width = window.innerWidth; height = window.innerHeight;
    if (!canvas) { console.error("Canvas missing!"); return; }
    canvas.width = width; canvas.height = height;

    // --- Grid Reset Logic --- 
    const originalScale = scale; // Store user's current scale
    scale = initialScale; // Temporarily set to initial scale for grid creation
    console.log(`Temporarily setting scale to ${initialScale} for grid init.`);
    initGrid(); // Uses the temporary initialScale
    // Pass preserved rules to initAnts
    initAnts(preservedIndividualRules); // Ants are placed relative to this initial grid
    scale = originalScale; // Restore user's original scale immediately after
    console.log(`Restored scale to ${scale}.`);
    // The current offsetX/offsetY are preserved, user's view doesn't jump.

    // Setup Controls & Display Rules
    const simSpeedSlider = document.getElementById('simSpeedSlider');
    const simSpeedValueSpan = document.getElementById('simSpeedValue');
    const rulesDisplay = document.getElementById('rulesDisplay');
    const applyBtn = document.getElementById('applyBtn');

    if (!simSpeedSlider || !simSpeedValueSpan || !rulesDisplay || !applyBtn) { return; }
    const initialSliderValue = parseInt(simSpeedSlider.value, 10);
    const initialSimSpeed = mapSliderToSpeed(initialSliderValue);
    simSpeedSlider.value = initialSliderValue;
    simSpeedValueSpan.textContent = Math.round(initialSimSpeed);

    // Calculate metadata *just before* use
    const numStatesInRules = Object.keys(rules).length;
    const numColorsInRules = rules[0] ? rules[0].length : 0;

    // Prepare rules display string with simplified metadata comments
    let rulesString = `// States: ${numStatesInRules}\n`;
    rulesString += `// Colors: ${numColorsInRules}\n`; // Just the count
    rulesString += `// Moves: L:Left, R:Right, U:U-Turn, N:No Turn (forward), S:Stay, ^>v<:Absolute Dirs, ?:Random\n\n`;
    try { rulesString += JSON.stringify(rules, null, 2); } catch (e) { rulesString = "Error stringifying rules.";}
    if (rulesDisplay) rulesDisplay.textContent = rulesString;
    
    // --- Ensure Apply and Discard buttons are disabled after any init ---
    if (applyBtn) applyBtn.disabled = true;
    const discardBtn = document.getElementById('discardBtn');
    if (discardBtn) discardBtn.disabled = true;

    setCanvasSmoothing(false);
    cellsToUpdate.clear();
    needsFullRedraw = true; // Trigger full redraw for initial state

    // Explicitly draw the initial full grid state
    // No clear needed here as drawGrid draws all cells
    drawGrid(); // This draws all cells, covering previous state

    isRunning = wasRunning;
    updateButtonText();
    pauseTime = 0;

    if (individualRulesCheck) {
        individualRulesCheck.disabled = (antCount <= 1);
        // If count becomes 1, uncheck and show main rules
        if (antCount <= 1 && individualRulesCheck.checked) {
            individualRulesCheck.checked = false;
        }
    }

    if (isRunning) {
        startSimulationLoop(); // Schedules steps
        startRenderLoop();     // Schedules calls to draw() -> drawUpdates
    } 
    // else: Paused state handled, initial draw already done.

    // --- Store the successfully applied state for potential discard --- 
    console.log("Storing current state as last applied state.");
    const currentAntCount = antCountInput ? antCountInput.value : '1';
    const currentStartPosition = startPositionSelect ? startPositionSelect.value : 'center';
    const currentStartDirection = startDirectionSelect ? startDirectionSelect.value : '0';
    const currentMaxStates = possibleStatesInput ? possibleStatesInput.value : '2';
    const currentMaxColors = possibleColorsInput ? possibleColorsInput.value : '2';
    const currentIndividualChecked = individualRulesCheck ? individualRulesCheck.checked : false;
    const currentRulesText = rulesDisplay ? rulesDisplay.textContent : '';

    lastAppliedState = {
        antCount: currentAntCount,
        startPosition: currentStartPosition,
        startDirection: currentStartDirection,
        maxStates: currentMaxStates,
        maxColors: currentMaxColors,
        individualChecked: currentIndividualChecked,
        rulesText: currentRulesText // Store the raw text content
    };
    // console.log("Stored State:", lastAppliedState); // Optional: Debug log
}

function startSimulation() {
    stopSimulation(); // Clear any existing timers/loops first
    if (currentIntervalId || timeoutId) { console.warn("startSimulation called while already running?"); return; }

    console.log("startSimulation called. Setting up timer/loop...");
    isRunning = true;
    updateButtonText();

    const fpsSlider = document.getElementById('fpsSlider');
    const stepsSlider = document.getElementById('stepsSlider');
    const targetFPS = fpsSlider ? parseInt(fpsSlider.value, 10) : 60;
    currentStepsPerTick = stepsSlider ? parseInt(stepsSlider.value, 10) : 1;
    currentStepsPerTick = Math.max(1, currentStepsPerTick);

    if (targetFPS >= 240) { // Check against new max value
        // Max Speed Mode: Use setTimeout loop
        currentIntervalDelay = 0; // Indicate no fixed interval
        console.log(`Starting MAX Speed Mode (setTimeout): Steps/Tick=${currentStepsPerTick}`);
        runMaxSpeedLoop(); // Start the loop
    } else if (targetFPS >= 1) {
        // Normal Mode: Calculate delay from FPS
        currentIntervalDelay = Math.round(1000 / targetFPS);
        console.log(`Starting Normal Mode: Target FPS=${targetFPS}, Interval=${currentIntervalDelay}ms, Steps/Tick=${currentStepsPerTick}`);
        currentIntervalId = setInterval(runSimulationTick, currentIntervalDelay);
        console.log(` -> intervalId set: ${currentIntervalId}`);
    } else {
        // Fallback
        currentIntervalDelay = 1000; // 1 FPS
        console.warn(`Invalid Target FPS (${targetFPS}), defaulting to 1 FPS.`);
        currentIntervalId = setInterval(runSimulationTick, currentIntervalDelay);
        console.log(` -> intervalId set (fallback): ${currentIntervalId}`);
    }
}

function stopSimulation() {
    if (currentIntervalId) {
        console.log(`Clearing intervalId: ${currentIntervalId}`);
        clearInterval(currentIntervalId);
        currentIntervalId = null;
    }
    if (timeoutId) {
        console.log(`Clearing timeoutId: ${timeoutId}`);
        clearTimeout(timeoutId);
        timeoutId = null;
    }
    console.log("Simulation timer/loop stopped.");
}

function updateButtonText() {
    const btn = document.getElementById('startStopBtn');
    // Use literal symbols for Play (▶ U+25B6) and Pause (❚❚)
    if (btn) btn.innerHTML = isRunning ? '❚❚' : '▶';
}

// Renamed and parameterized
function stepSingleAntLogic(ant) {
    if (!grid || !ant || ant.state === -1) return; // HALT state: do nothing further

    // The grid is now infinite, so no boundary wraparound or checks needed.

    const currentCellX = ant.x;
    const currentCellY = ant.y;
    const currentCellColor = getGridColor(currentCellX, currentCellY); // Use new getter function.
    const currentState = ant.state;

    const ruleSetToUse = ant.individualRule || rules;
    let rule;
    try { 
        if (ruleSetToUse[currentState] && ruleSetToUse[currentState][currentCellColor]) {
             rule = ruleSetToUse[currentState][currentCellColor];
        } else { 
             if (ruleSetToUse[currentState] && ruleSetToUse[currentState][0]) {
                 rule = ruleSetToUse[currentState][0];
             } else {
                rule = { writeColor: currentCellColor, move: 'N', nextState: 0 };
             }
        }
    } catch (e) { 
        console.error("Error in stepSingleAntLogic:", e);
        return; 
    }
    
    // --- Record change only if color is different ---
    if (rule.writeColor !== currentCellColor) {
        setGridColor(currentCellX, currentCellY, rule.writeColor); // Use new setter function. Corrected to (x,y)
        cellsToUpdate.add(`${currentCellX},${currentCellY}`);
    }

    let dx = 0, dy = 0;
    // --- Determine Direction Change --- 
    switch (rule.move) { // Use rule.move directly again
        // Relative moves
        case 'R': ant.dir = (ant.dir + 1) % 4; break;
        case 'L': ant.dir = (ant.dir - 1 + 4) % 4; break;
        case 'U': ant.dir = (ant.dir + 2) % 4; break;
        case 'S': break; // Stay - no direction change
        case 'N': break; // None - no direction change
        // Absolute moves
        case '^': ant.dir = 0; break; // North
        case '>': ant.dir = 1; break; // East
        case 'v': ant.dir = 2; break; // South
        case '<': ant.dir = 3; break; // West
        case '?': // Random absolute direction
            ant.dir = Math.floor(Math.random() * 4);
            break;
        default: break; // Treat any other unknown character like 'N'
    }
    // --- Determine Movement Delta (only if not 'S') ---
    if (rule.move !== 'S') { // Use rule.move directly again
        const moveOffset = directions[ant.dir];
        if (moveOffset) { 
            dx = moveOffset.dx;
            dy = moveOffset.dy;
        } else {
             console.error(`Invalid ant direction: ${ant.dir}`);
        }
    }
    // Update state
    ant.state = rule.nextState;
    // Apply movement
    ant.x += dx;
    ant.y += dy;
}

// Called by setInterval in Normal Mode
function runSimulationTick() {
    if (!isRunning) {
         if (currentIntervalId) clearInterval(currentIntervalId);
         currentIntervalId = null;
         return;
     }
    for (let i = 0; i < currentStepsPerTick; i++) {
        stepSingleAntLogic(ants[i]);
    }
    requestAnimationFrame(draw); // Use rAF for drawing
}

// Called recursively by setTimeout in Max Speed Mode
function runMaxSpeedLoop() {
    if (!isRunning) {
        timeoutId = null; // Ensure ID is cleared if stopped
        console.log("Max speed loop detected isRunning=false, stopping.");
        return; // Stop the loop
    }

    // Run the batch of steps
    for (let i = 0; i < currentStepsPerTick; i++) {
        stepSingleAntLogic(ants[i]);
    }

    // Draw the result of the batch
    // Using requestAnimationFrame here ensures drawing happens smoothly,
    // but the *next* simulation batch starts via setTimeout immediately after this call.
    requestAnimationFrame(draw);

    // Schedule the next batch immediately
    timeoutId = setTimeout(runMaxSpeedLoop, 0);
}

// --- Drawing ---
// ... (drawGrid cell drawing loop)

// Helper to draw ant shape
function drawAntShape(ant) {
     // Check if ant is within logical grid bounds
     if (ant.x < 0 || ant.x >= gridCols || ant.y < 0 || ant.y >= gridRows) return;

     // Calculate pixel positions
     const cellSize = 1;
     const antCenterX = offsetX + (ant.x + 0.5) * cellSize * scale;
     const antCenterY = offsetY + (ant.y + 0.5) * cellSize * scale;
     const antSize = (cellSize * scale) * 0.8; 
     const antRadius = antSize / 2.5; 

     // Visibility check
     if (!(antCenterX + antSize > 0 && antCenterX - antSize < width &&
           antCenterY + antSize > 0 && antCenterY - antSize < height)) {
         return;
     }

     ctx.fillStyle = 'red';
     ctx.beginPath();

     // --- Always draw a circle --- 
     ctx.arc(antCenterX, antCenterY, antRadius, 0, 2 * Math.PI);
     
     ctx.fill();
 }

function drawGrid() {
    if (!grid || !ctx) return;
    setCanvasSmoothing(false);

    // Calculate visible bounds (this logic is still useful!)
    const viewX1 = -offsetX / scale;
    const viewY1 = -offsetY / scale;
    const viewX2 = (width - offsetX) / scale;
    const viewY2 = (height - offsetY) / scale;
    const cellSize = 1;

    // NEW: Iterate over the map entries instead of a fixed 2D array
    for (const [coordString, colorIndex] of grid.entries()) {
        const [xStr, yStr] = coordString.split(',');
        const x = parseInt(xStr, 10);
        const y = parseInt(yStr, 10);

        // OPTIONAL but good: A quick check to see if the cell is even close to the viewport
        if (x < viewX1 - 1 || x > viewX2 + 1 || y < viewY1 - 1 || y > viewY2 + 1) {
            continue;
        }

        ctx.fillStyle = cellColors[colorIndex];
        const px = Math.floor(offsetX + x * cellSize * scale);
        const py = Math.floor(offsetY + y * cellSize * scale);
        const pw = Math.ceil(cellSize * scale);
        const ph = Math.ceil(cellSize * scale);

        // This check is now even more important!
        if (px + pw > 0 && px < width && py + ph > 0 && py < height) {
            ctx.fillRect(px, py, pw, ph);
        }
    }

    // --- Draw Ants (this part is unchanged) ---
    setCanvasSmoothing(true);
    for (const ant of ants) {
        if (ant) drawAntShape(ant);
    }
    setCanvasSmoothing(false);
}

// Function to draw updates efficiently
function drawUpdates() {
    if (!ctx) return;
    setCanvasSmoothing(false);
    const cellSize = 1;

    // --- Draw all cells marked for update --- 
    cellsToUpdate.forEach(coordString => {
        const [xStr, yStr] = coordString.split(',');
        const x = parseInt(xStr, 10);
        const y = parseInt(yStr, 10);

        // Ensure coordinate is valid
        if (isNaN(x) || isNaN(y)) return;

        const colorIndex = getGridColor(x, y); // Use the new getter
        if (colorIndex >= 0 && colorIndex < cellColors.length) {
             ctx.fillStyle = cellColors[colorIndex];
             const px = Math.floor(offsetX + x * cellSize * scale);
             const py = Math.floor(offsetY + y * cellSize * scale);
             const pw = Math.ceil(cellSize * scale);
             const ph = Math.ceil(cellSize * scale);
             if (px + pw > 0 && px < width && py + ph > 0 && py < height) {
                 ctx.fillRect(px, py, pw, ph);
             }
        }
    });

    // --- 3. Draw Ants in their NEW positions (Enable Smoothing) --- 
    setCanvasSmoothing(true); // Enable AA for shapes
    for (let i = 0; i < ants.length; i++) {
        if (ants[i]) drawAntShape(ants[i]); // Call without isFullRedraw
    }
    setCanvasSmoothing(false);

    // --- 4. Clear the update set for the next frame --- 
    cellsToUpdate.clear();
}

// Main draw function: NO clearing, just call drawUpdates
function draw() {
    if (!ctx) return;

    if (needsFullRedraw) {
        // console.log("Performing full redraw"); // Optional debug log
        // Clear background (important for full redraw)
        ctx.fillStyle = '#555555'; 
        ctx.fillRect(0, 0, width, height);
        drawGrid(); // Draw the entire grid
        needsFullRedraw = false; // Reset flag after drawing
    } else {
        // console.log("Performing partial update"); // Optional debug log
        drawUpdates(); // Draw only changes
    }
}

function handleZoom(event) {
    event.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Convert mouse screen coords to world coords (logical grid coords)
    const worldX = (mouseX - offsetX) / scale;
    const worldY = (mouseY - offsetY) / scale;

    let newScale;
    if (event.deltaY < 0) {
        // Zoom in
        newScale = Math.min(maxScale, scale * zoomFactor);
    } else {
        // Zoom out
        newScale = Math.max(minScale, scale / zoomFactor);
    }

    // Adjust offset to keep the world point under the mouse stationary
    offsetX = mouseX - worldX * newScale;
    offsetY = mouseY - worldY * newScale;
    scale = newScale;

    setCanvasSmoothing(false);
    needsFullRedraw = true; // View changed, need full redraw
    // Request animation frame, draw() will handle the rest
    if (!renderRequestId && !isRunning) requestAnimationFrame(draw);
}

function handleMouseDown(event) {
    isDragging = true;
    const rect = canvas.getBoundingClientRect();
    lastMouseX = event.clientX - rect.left;
    lastMouseY = event.clientY - rect.top;
    canvas.style.cursor = 'grabbing';
}

function handleMouseUp(event) {
    if (isDragging) {
        isDragging = false;
        canvas.style.cursor = 'grab';
    }
}

function handleMouseMove(event) {
    if (!isDragging) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    offsetX += mouseX - lastMouseX;
    offsetY += mouseY - lastMouseY;

    lastMouseX = mouseX;
    lastMouseY = mouseY;

    needsFullRedraw = true; // View changed, need full redraw
    // Request animation frame, draw() will handle the rest
    if (!renderRequestId && !isRunning) requestAnimationFrame(draw);
}

function handleMouseLeave(event) {
     if (isDragging) {
        isDragging = false; // Stop dragging if mouse leaves canvas
        canvas.style.cursor = 'grab';
    }
}

// Global Hotkey Listener
window.addEventListener('keydown', (event) => {
    // Ignore keys if user is typing in the rules editor
    if (event.target === document.getElementById('rulesDisplay')) {
        return;
    }

    // Check for Space bar (Start/Stop)
    if (event.code === 'Space') {
        event.preventDefault(); // Prevent default space bar scroll
        const btn = document.getElementById('startStopBtn');
        if (btn) btn.click(); // Simulate click
    }
    // Check for 'F' key (Randomize)
    else if (event.key === 'f' || event.key === 'F') {
        const btn = document.getElementById('randomizeBtn');
        if (btn) btn.click(); // Simulate click
    }
    // Check for 'R' key (Reset)
    else if (event.key === 'r' || event.key === 'R') {
        const btn = document.getElementById('resetBtn');
        if (btn) btn.click(); // Simulate click
    }
});

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded event fired.");
    if (!ctx) { console.error("Canvas context not found on DOMContentLoaded!"); return; }

    // Get elements and log immediately after each attempt
    const simSpeedSlider = document.getElementById('simSpeedSlider');
    console.log("simSpeedSlider:", simSpeedSlider);
    const simSpeedValueSpan = document.getElementById('simSpeedValue');
    console.log("simSpeedValueSpan:", simSpeedValueSpan);
    const startStopBtn = document.getElementById('startStopBtn');
    console.log("startStopBtn:", startStopBtn);
    const resetBtn = document.getElementById('resetBtn');
    console.log("resetBtn:", resetBtn);
    const resetViewBtn = document.getElementById('resetViewBtn');
    console.log("resetViewBtn:", resetViewBtn);
    const minimizeBtn = document.getElementById('minimizeBtn');
    console.log("minimizeBtn:", minimizeBtn);
    const maximizeBtn = document.getElementById('maximizeBtn');
    console.log("maximizeBtn:", maximizeBtn);
    const controlPanel = document.getElementById('controlPanel');
    console.log("controlPanel:", controlPanel);
    const rulesDisplay = document.getElementById('rulesDisplay');
    const applyBtn = document.getElementById('applyBtn');
    const randomizeBtn = document.getElementById('randomizeBtn');
    const antCountInput = document.getElementById('antCountInput'); // Get ant count input
    const startPositionSelect = document.getElementById('startPositionSelect'); // Get select
    const possibleStatesInput = document.getElementById('possibleStatesInput');
    const possibleColorsInput = document.getElementById('possibleColorsInput');
    const rulesDisplayContainer = document.getElementById('rulesDisplay')?.parentNode;
    const individualRulesCheck = document.getElementById('individualRulesCheck');
    const individualRulesContainer = document.querySelector('.individual-rules-container');
    const editRuleBtn = document.getElementById('editRuleBtn'); // Get edit button
    const ruleLabel = document.querySelector('.rules-display-container label'); // Get label
    const startDirectionSelect = document.getElementById('startDirectionSelect'); // Get direction select
    const rulesDisplayPre = document.getElementById('rulesDisplay'); // Get the pre tag itself
    const saveRuleBtn = document.getElementById('saveRuleBtn'); // Get save button
    const loadRuleBtn = document.getElementById('loadRuleBtn'); // Get load button
    const discardBtn = document.getElementById('discardBtn'); // Get discard button
    const presetSelect = document.getElementById('presetSelect'); // Get preset select
    const toggleRandomizeOptionsBtn = document.getElementById('toggleRandomizeOptionsBtn'); // New
    const randomizeOptionsContent = document.getElementById('randomizeOptionsContent'); // New
    const moveRelativeCheck = document.getElementById('moveRelativeCheck'); // New
    const moveAbsoluteCheck = document.getElementById('moveAbsoluteCheck'); // New
    const moveRandomCheck = document.getElementById('moveRandomCheck'); // New

    // Check all required elements rigorously
    if (!simSpeedSlider || !simSpeedValueSpan || !startStopBtn || !resetBtn || !resetViewBtn || !minimizeBtn || !maximizeBtn || !controlPanel || !rulesDisplay || !applyBtn || !randomizeBtn || !antCountInput || !startPositionSelect || !possibleStatesInput || !possibleColorsInput || !rulesDisplayContainer || !individualRulesCheck || !individualRulesContainer || !editRuleBtn || !ruleLabel || !startDirectionSelect || !rulesDisplayPre /* Add check */ || !saveRuleBtn || !loadRuleBtn || !discardBtn || !presetSelect || !toggleRandomizeOptionsBtn || !randomizeOptionsContent || !moveRelativeCheck || !moveAbsoluteCheck || !moveRandomCheck ) {
        console.error("One or more control panel elements were not found! Aborting setup.");
        // Optionally log which specific ones were null
        if (!simSpeedSlider) console.error("- simSpeedSlider is null");
        if (!simSpeedValueSpan) console.error("- simSpeedValueSpan is null");
        if (!startStopBtn) console.error("- startStopBtn is null");
        if (!resetBtn) console.error("- resetBtn is null");
        if (!resetViewBtn) console.error("- resetViewBtn is null");
        if (!minimizeBtn) console.error("- minimizeBtn is null");
        if (!maximizeBtn) console.error("- maximizeBtn is null");
        if (!controlPanel) console.error("- controlPanel is null");
        if (!rulesDisplay) console.error("- rulesDisplay is null");
        if (!applyBtn) console.error("- applyBtn is null");
        if (!randomizeBtn) console.error("- randomizeBtn is null");
        if (!antCountInput) console.error("- antCountInput is null");
        if (!startPositionSelect) console.error("- startPositionSelect is null");
        if (!possibleStatesInput) console.error("- possibleStatesInput is null");
        if (!possibleColorsInput) console.error("- possibleColorsInput is null");
        if (!rulesDisplayContainer) console.error("- rulesDisplayContainer is null");
        if (!individualRulesCheck) console.error("- individualRulesCheck is null");
        if (!individualRulesContainer) console.error("- individualRulesContainer is null");
        if (!editRuleBtn) console.error("- editRuleBtn is null");
        if (!ruleLabel) console.error("- ruleLabel is null");
        if (!startDirectionSelect) console.error("- startDirectionSelect is null");
        if (!rulesDisplayPre) console.error("- rulesDisplayPre is null"); // Add log for pre tag
        if (!saveRuleBtn) console.error("- saveRuleBtn is null"); // Add log for save button
        if (!loadRuleBtn) console.error("- loadRuleBtn is null"); // Add log for load button
        if (!discardBtn) console.error("- discardBtn is null"); // Add log for discard button
        if (!presetSelect) console.error("- presetSelect is null"); // Add log for preset select
        if (!toggleRandomizeOptionsBtn) console.error("- toggleRandomizeOptionsBtn is null");
        if (!randomizeOptionsContent) console.error("- randomizeOptionsContent is null");
        if (!moveRelativeCheck) console.error("- moveRelativeCheck is null");
        if (!moveAbsoluteCheck) console.error("- moveAbsoluteCheck is null");
        if (!moveRandomCheck) console.error("- moveRandomCheck is null");
        return; // Stop execution
    }

    console.log("All control panel elements found. Proceeding with listeners and init...");

    // --- Helper Function ---
    function markChangesPending(applyBtn, discardBtn, presetSelect) {
        if (applyBtn) applyBtn.disabled = false;
        if (discardBtn) discardBtn.disabled = false;
        if (presetSelect) presetSelect.value = 'custom';
    }

    // --- Initial State Setup ---
    if (antCountInput && rulesDisplayContainer && individualRulesContainer && individualRulesCheck && rulesDisplayPre) {
        updateIndividualRulesVisibility(
            parseInt(antCountInput.value, 10) || 0,
            rulesDisplayContainer,
            individualRulesContainer,
            individualRulesCheck,
            rulesDisplayPre // Pass pre tag
        );
    }
    // #rulesDisplay starts hidden via HTML class now, no need to add 'hidden' here.

    // --- Attach Listeners ---
    startStopBtn.addEventListener('click', () => {
        if (isRunning) {
            console.log("Pause button clicked");
            isRunning = false;
            stopSimulationLoop(); // Stops sim, records pauseTime
            stopRenderLoop();
        } else {
            console.log("Start button clicked");
            isRunning = true;
            startSimulationLoop(); // Resumes sim, adjusts nextStepTime
            startRenderLoop();
        }
        updateButtonText();
    });

    resetBtn.addEventListener('click', () => {
        const currentState = isRunning; // Check state *before* calling init
        // Call init without randomize, state/color counts (uses current rules)
        initSimulation(false, undefined, undefined, currentState);
        // Discard pending changes explicitly by disabling Apply button
        if (applyBtn) applyBtn.disabled = true;
        const discardBtn = document.getElementById('discardBtn');
        if (discardBtn) discardBtn.disabled = true;
         // Update visibility based on current state after reset
         if (antCountInput && rulesDisplayContainer && individualRulesContainer && individualRulesCheck && rulesDisplayPre) {
            updateIndividualRulesVisibility(
                parseInt(antCountInput.value, 10) || 0,
                rulesDisplayContainer,
                individualRulesContainer,
                individualRulesCheck,
                rulesDisplayPre
            );
        }
    });

    // Reset View Listener
    resetViewBtn.addEventListener('click', resetCamera);

    // Minimize Listener
    minimizeBtn.addEventListener('click', () => {
        controlPanel.classList.add('minimized');
    });

    // Maximize Listener
    maximizeBtn.addEventListener('click', () => {
        controlPanel.classList.remove('minimized');
    });

    simSpeedSlider.addEventListener('input', () => {
        const sliderValue = parseInt(simSpeedSlider.value, 10);
        const newSpeed = mapSliderToSpeed(sliderValue);
        // Display calculated speed, rounded
        simSpeedValueSpan.textContent = Math.round(newSpeed);
        // Loop reads slider value, no restart needed but could nudge time:
        // nextStepTime = Math.min(nextStepTime, performance.now() + 100);
    });

    // Ant Count Input Listener - Also enables/disables checkbox
    if (antCountInput) {
        antCountInput.addEventListener('input', () => {
            // Clamp value immediately in the UI if user types outside range
            const currentVal = parseInt(antCountInput.value, 10);
            const minVal = parseInt(antCountInput.min, 10);
            const maxVal = 1024; // Use literal max value for clamping check
            if (!isNaN(currentVal)) {
                 if (currentVal < minVal) antCountInput.value = minVal;
                 else if (currentVal > maxVal) antCountInput.value = maxVal;
            }
            const currentCount = parseInt(antCountInput.value, 10) || 0;
            // Call updated visibility function, passing pre tag
            if (rulesDisplayContainer && individualRulesContainer && individualRulesCheck && rulesDisplayPre) {
                 updateIndividualRulesVisibility(currentCount, rulesDisplayContainer, individualRulesContainer, individualRulesCheck, rulesDisplayPre);
            }
            markChangesPending(applyBtn, discardBtn, presetSelect);
            // If editor was open and count becomes 1 (which forces individual off),
            // it will be handled by updateIndividualRulesVisibility hiding the container.
            // No extra logic needed here.
        });
    }

    // Rules Display Listener (Input event)
    rulesDisplay.addEventListener('input', () => {
        markChangesPending(applyBtn, discardBtn, presetSelect);
    });

    // Individual Rules Checkbox Listener - Handles main rule visibility AND content update
    if (individualRulesCheck) {
        individualRulesCheck.addEventListener('change', () => {
            updateIndividualRulesVisibility(
                parseInt(document.getElementById('antCountInput').value, 10) || 0,
                rulesDisplayContainer,
                individualRulesContainer,
                individualRulesCheck,
                rulesDisplayPre // Pass pre tag
            );
            // If checked ON, the update function now handles hiding the <pre> tag if necessary.
            markChangesPending(applyBtn, discardBtn, presetSelect);
        });
    }

    // Apply Button Listener - Applies changes AND resets
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            console.log("Applying changes (rules and ant count) and resetting...");
            let rulesChanged = false;
            if (rulesDisplay) {
                try {
                    let rulesText = rulesDisplay.textContent;
                    const rulesWithoutComments = rulesText.replace(/^\s*\/\/.*$/gm, '').trim();
                    const parsedRules = JSON.parse(rulesWithoutComments);
                    if (typeof parsedRules !== 'object' || parsedRules === null) throw new Error("Invalid rules object.");
                    // Simple check: Has the stringified version changed? (Not perfect, but decent)
                    if (JSON.stringify(rules) !== JSON.stringify(parsedRules)) {
                        rules = parsedRules;
                        rulesChanged = true;
                        console.log("Rules updated.");
                    }
                } catch (e) {
                    console.error("Error parsing rules JSON:", e);
                    alert(`Error parsing rules: ${e.message}\nPlease correct the rules definition.`);
                    return; // Stop if rules are invalid
                }
            }

            // Reset simulation using potentially updated rules and current ant count input
            applyBtn.disabled = true; // Disable button after initiating apply/reset
            const discardBtn = document.getElementById('discardBtn');
            if (discardBtn) discardBtn.disabled = true; // Also disable discard
            const currentState = isRunning;
            console.log("Resetting simulation to apply changes.");
            initSimulation(false, undefined, undefined, currentState); // initSimulation reads ant count and uses current global 'rules'
             // Update visibility based on current state after apply/reset
            if (antCountInput && rulesDisplayContainer && individualRulesContainer && individualRulesCheck && rulesDisplayPre) {
                updateIndividualRulesVisibility(
                    parseInt(antCountInput.value, 10) || 0,
                    rulesDisplayContainer,
                    individualRulesContainer,
                    individualRulesCheck,
                    rulesDisplayPre
                );
            }
        });
    }

    // Randomize Listener - Reads new inputs
    if (randomizeBtn) {
        randomizeBtn.addEventListener('click', () => {
            console.log("Randomizing rules and resetting simulation...");
            const currentState = isRunning;
            // Read max states/colors from inputs
            const maxStates = possibleStatesInput ? parseInt(possibleStatesInput.value, 10) : 2;
            const maxColors = possibleColorsInput ? parseInt(possibleColorsInput.value, 10) : 2;
            
            // Validate inputs (using updated limits)
            const validatedMaxStates = Math.max(1, Math.min(1000, maxStates || 1)); // Use 1000
            const validatedMaxColors = Math.max(2, Math.min(maxPossibleColors, maxColors || 2)); // maxPossibleColors is now 12
            
            // Randomize *within* the max limits
            const randomStates = Math.floor(Math.random() * validatedMaxStates) + 1;
            const randomColors = Math.floor(Math.random() * (validatedMaxColors - 1)) + 2; 

            console.log(` -> Using random states: ${randomStates} (max ${validatedMaxStates}), random colors: ${randomColors} (max ${validatedMaxColors})`);

            // Generate rules THEN reset simulation
            initSimulation(true, randomStates, randomColors, currentState);
            if (applyBtn) applyBtn.disabled = true;
            const discardBtn = document.getElementById('discardBtn');
            if (discardBtn) discardBtn.disabled = true; // Also disable discard
             // Update visibility based on current state after randomize/reset
             if (antCountInput && rulesDisplayContainer && individualRulesContainer && individualRulesCheck && rulesDisplayPre) {
                updateIndividualRulesVisibility(
                    parseInt(antCountInput.value, 10) || 0,
                    rulesDisplayContainer,
                    individualRulesContainer,
                    individualRulesCheck,
                    rulesDisplayPre
                );
            }
        });
    }

    // Start Position Select Listener
    if (startPositionSelect) {
        startPositionSelect.addEventListener('input', () => {
            markChangesPending(applyBtn, discardBtn, presetSelect);
        });
    }

    // Start Direction Select Listener
    if (startDirectionSelect) {
        startDirectionSelect.addEventListener('input', () => {
            markChangesPending(applyBtn, discardBtn, presetSelect);
        });
    }

    // Random Movement Mode Select Listener
    if (toggleRandomizeOptionsBtn && randomizeOptionsContent) {
        // Hide by default
        randomizeOptionsContent.classList.add('hidden'); 
        toggleRandomizeOptionsBtn.addEventListener('click', () => {
            randomizeOptionsContent.classList.toggle('hidden');
        });
    }

    // --- Pan and Zoom Listeners ---
    if (canvas) { // Check if canvas exists before adding listeners
        canvas.addEventListener('wheel', handleZoom);
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseleave', handleMouseLeave);
        canvas.style.cursor = 'grab';
    } else {
        console.error("Canvas element not found for Pan/Zoom listeners!");
    }

    // Dynamically set max colors based on defined array
    if (possibleColorsInput) possibleColorsInput.max = maxPossibleColors;

    // Listener to toggle rule editor visibility
    const toggleRuleEditor = () => {
        // Get the pre tag itself
        const rulesEditorPre = document.getElementById('rulesDisplay');
        if (rulesEditorPre && !individualRulesCheck.checked) { // Only toggle if not in individual mode
            rulesEditorPre.classList.toggle('hidden');
        }
    };
    if (editRuleBtn) {
        editRuleBtn.addEventListener('click', toggleRuleEditor);
    }

    // Max States Input Listener
    if (possibleStatesInput) {
        possibleStatesInput.addEventListener('input', () => {
            const input = possibleStatesInput;
            const currentVal = parseInt(input.value, 10);
            const minVal = parseInt(input.min, 10);
            const maxVal = parseInt(input.max, 10);
            if (!isNaN(currentVal)) { 
                 if (currentVal < minVal) input.value = minVal;
                 else if (currentVal > maxVal) input.value = maxVal;
            }
            // markChangesPending(applyBtn, discardBtn, presetSelect); // Do not mark changes for these
        });
    }

    // Max Colors Input Listener
    if (possibleColorsInput) {
        possibleColorsInput.addEventListener('input', () => {
            const input = possibleColorsInput;
            const currentVal = parseInt(input.value, 10);
            const minVal = parseInt(input.min, 10);
            const maxVal = parseInt(input.max, 10);
            if (!isNaN(currentVal)) { 
                 if (currentVal < minVal) input.value = minVal;
                 else if (currentVal > maxVal) input.value = maxVal;
            }
            // markChangesPending(applyBtn, discardBtn, presetSelect); // Do not mark changes for these
        });
    }

    // Save Rule Button Listener
    if (saveRuleBtn) {
        saveRuleBtn.addEventListener('click', () => {
            const rulesEditor = document.getElementById('rulesDisplay');
            if (!rulesEditor) return;

            let rulesText = rulesEditor.textContent || "";
            // Remove comment lines
            const rulesWithoutComments = rulesText.replace(/^\s*\/\/.*$/gm, '').trim();

            if (!rulesWithoutComments) {
                alert("Rule editor is empty or contains only comments. Nothing to save.");
                return;
            }

            try {
                // Validate that the uncommented text is valid JSON
                const parsedRules = JSON.parse(rulesWithoutComments);
                // Re-stringify for consistent formatting in the saved file
                const jsonString = JSON.stringify(parsedRules, null, 2);
                
                const blob = new Blob([jsonString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'turmite_rule.json'; // Suggested filename
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url); // Clean up
                console.log("Rule saved successfully.");

            } catch (e) {
                console.error("Error processing rule for saving:", e);
                alert(`Could not save rule. The content (after removing comments) is not valid JSON:\n\n${e.message}`);
            }
        });
    }

    // Load Rule Button Listener
    if (loadRuleBtn) {
        loadRuleBtn.addEventListener('click', () => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.json,application/json'; // Accept .json files
            fileInput.style.display = 'none'; // Keep it hidden

            fileInput.addEventListener('change', (event) => {
                const file = event.target.files ? event.target.files[0] : null;
                if (!file) {
                    console.log("No file selected.");
                    return;
                }

                const reader = new FileReader();

                reader.onload = (e) => {
                    const content = e.target?.result;
                    const rulesEditor = document.getElementById('rulesDisplay');
                    const applyBtn = document.getElementById('applyBtn');
                    const discardBtn = document.getElementById('discardBtn'); // Get discard button here too
                    if (!rulesEditor || !applyBtn || !discardBtn) return;

                    try {
                        if (typeof content !== 'string') {
                             throw new Error("Failed to read file content as text.");
                        }
                        const parsedRules = JSON.parse(content);
                        
                        // Basic validation: Check if it's an object (could be more robust)
                        if (typeof parsedRules !== 'object' || parsedRules === null || Array.isArray(parsedRules)) {
                            throw new Error("Loaded JSON is not a valid rule object.");
                        }

                        // Format and add comments before displaying
                        const numStates = Object.keys(parsedRules).length;
                        const numColors = parsedRules[0] ? parsedRules[0].length : 0; // Assuming state 0 exists
                        let rulesString = "";
                        rulesString += `// States: ${numStates}\n`;
                        rulesString += `// Colors: ${numColors}\n`; 
                        rulesString += `// Moves: L:Left, R:Right, U:U-Turn, N:No Turn (forward), S:Stay, ^>v<:Absolute Dirs, ?:Random\n\n`;
                        rulesString += JSON.stringify(parsedRules, null, 2);

                        rulesEditor.textContent = rulesString;
                        applyBtn.disabled = false; // Enable Apply button
                        if (discardBtn) discardBtn.disabled = false; // Also enable discard
                        // Loading a file creates a custom state
                        if (presetSelect) presetSelect.value = 'custom'; // Set preset to Custom
                        console.log("Rule loaded successfully into editor.");

                    } catch (error) {
                        console.error("Error loading or parsing rule file:", error);
                        alert(`Failed to load rule: ${error.message}`);
                    }
                };

                reader.onerror = (e) => {
                    console.error("Error reading file:", e);
                    alert("An error occurred while trying to read the file.");
                };

                reader.readAsText(file); // Read the file as text
            });

            document.body.appendChild(fileInput); // Add to body to allow click
            fileInput.click();
            document.body.removeChild(fileInput); // Clean up immediately after click
        });
    }

    // Discard Button Listener
    if (discardBtn) {
        discardBtn.addEventListener('click', () => {
            console.log("Discarding unapplied changes...");
            
            // Check if there is a stored state
            if (Object.keys(lastAppliedState).length === 0) {
                console.warn("No last applied state found to discard to.");
                // Optionally disable buttons anyway?
                if (applyBtn) applyBtn.disabled = true;
                if (discardBtn) discardBtn.disabled = true;
                return;
            }

            // Restore controls from lastAppliedState
            if (antCountInput) antCountInput.value = lastAppliedState.antCount;
            if (startPositionSelect) startPositionSelect.value = lastAppliedState.startPosition;
            if (startDirectionSelect) startDirectionSelect.value = lastAppliedState.startDirection;
            if (possibleStatesInput) possibleStatesInput.value = lastAppliedState.maxStates;
            if (possibleColorsInput) possibleColorsInput.value = lastAppliedState.maxColors;
            if (individualRulesCheck) individualRulesCheck.checked = lastAppliedState.individualChecked;
            if (rulesDisplayPre) rulesDisplayPre.textContent = lastAppliedState.rulesText;

            // Update visibility based on restored state
            if (antCountInput && rulesDisplayContainer && individualRulesContainer && individualRulesCheck && rulesDisplayPre) {
                updateIndividualRulesVisibility(
                    parseInt(lastAppliedState.antCount, 10) || 0,
                    rulesDisplayContainer,
                    individualRulesContainer,
                    individualRulesCheck,
                    rulesDisplayPre
                );
            }

            // Disable Apply and Discard buttons
            if (applyBtn) applyBtn.disabled = true;
            if (discardBtn) discardBtn.disabled = true;
            console.log("Changes discarded.");
        });
    }

    // --- Preset Loading Logic --- 
    function loadPresetRule(presetValue) {
        const rulesEditor = document.getElementById('rulesDisplay');
        const applyBtn = document.getElementById('applyBtn');
        const discardBtn = document.getElementById('discardBtn');

        if (!rulesEditor || !applyBtn || !discardBtn) return;

        if (presetValue === 'custom') {
            // Do nothing if 'custom' selected, keep current editor content
            // Or, if you want 'custom' to clear the editor or load a default empty state:
            // rulesEditor.textContent = "// Custom rules - define your JSON here";
            // applyBtn.disabled = false; // Or true, depending on desired behavior
            // discardBtn.disabled = false;
            return; 
        }

        const selectedPreset = presetDefinitions[presetValue];

        if (selectedPreset) {
            const presetRules = selectedPreset.rules;
            const presetName = selectedPreset.name;
            try {
                const numStates = Object.keys(presetRules).length;
                const numColors = presetRules[0] ? presetRules[0].length : 0;
                let rulesString = `// Preset: ${presetName}\n`;
                rulesString += `// States: ${numStates}\n`;
                rulesString += `// Colors: ${numColors}\n`; 
                rulesString += `// Moves: L:Left, R:Right, U:U-Turn, N:No Turn (forward), S:Stay, ^>v<:Absolute Dirs, ?:Random\n\n`;
                rulesString += JSON.stringify(presetRules, null, 2);

                rulesEditor.textContent = rulesString;
                applyBtn.disabled = false; 
                discardBtn.disabled = false; 
                console.log(`Preset '${presetName}' loaded into editor.`);

            } catch (error) {
                console.error("Error formatting preset rule:", error);
                alert(`Failed to load preset '${presetName}': ${error.message}`);
            }
        } else {
            console.warn(`Preset with value '${presetValue}' not found in definitions.`);
            // Optionally, clear the editor or load a default if a preset is not found
            // rulesEditor.textContent = "// Selected preset not found";
        }
    }

    // Preset Select Listener
    if (presetSelect) {
        presetSelect.addEventListener('change', (event) => {
            loadPresetRule(event.target.value);
        });
    }

    // --- Populate Preset Select Dropdown Dynamically ---
    if (presetSelect && typeof presetDefinitions !== 'undefined') {
        presetSelect.innerHTML = ''; // Clear existing hardcoded options

        for (const key in presetDefinitions) {
            if (presetDefinitions.hasOwnProperty(key)) {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = presetDefinitions[key].name;
                presetSelect.appendChild(option);
            }
        }
        // Add the 'Custom' option and select it by default or select the first available preset
        const customOption = document.createElement('option');
        customOption.value = 'custom';
        customOption.textContent = 'Custom';
        presetSelect.appendChild(customOption);
        // presetSelect.value = 'custom'; // Default to custom
        // Or, to select the first actual preset if available:
        if (presetSelect.options.length > 1) { // Check if any presets were added besides custom
             presetSelect.value = presetSelect.options[0].value; 
        }

    } else {
        console.warn("presetSelect element or presetDefinitions not found. Dropdown will not be populated dynamically.");
    }
    // --- End Dynamic Population ---

    initSimulation(false, undefined, undefined, true); // Initial Load

    // Load the default preset AFTER the initial simulation setup
    // Ensure a valid preset is selected before calling loadPresetRule
    if (presetSelect.value) {
        loadPresetRule(presetSelect.value);
    } else if (presetSelect.options.length > 0) {
        // Fallback to the first option if no value is set (e.g. if 'custom' was the only one and we want to load first actual preset)
        presetSelect.value = presetSelect.options[0].value;
        loadPresetRule(presetSelect.value);
    }

    // --- Disable buttons immediately after initial preset load --- 
    if (applyBtn) applyBtn.disabled = true;
    if (discardBtn) discardBtn.disabled = true;
    console.log("Disabled Apply/Discard after initial preset load.");

    // Allow Random Move Checkbox Listener
    if (moveRelativeCheck) {
        moveRelativeCheck.addEventListener('change', () => {
            // No markChangesPending
        });
    }
    if (moveAbsoluteCheck) {
        moveAbsoluteCheck.addEventListener('change', () => {
            // No markChangesPending
        });
    }
    if (moveRandomCheck) {
        moveRandomCheck.addEventListener('change', () => {
            // No markChangesPending
        });
    }
});

// Global listeners like resize can often stay global
window.addEventListener('resize', resizeCanvas);

// --- Simulation Loop (Corrected Logic) ---
function simulationLoop() {
    if (!isRunning) {
        simulationTimeoutId = null; return;
    }
    const now = performance.now();
    let totalStepsExecutedThisLoop = 0;
    const slider = document.getElementById('simSpeedSlider');
    const targetSpeed = slider ? parseInt(slider.value, 10) : 50;
    const mappedSpeed = mapSliderToSpeed(targetSpeed);
    const stepDuration = (mappedSpeed > 0) ? 1000 / mappedSpeed : Infinity;

    // Determine how many full simulation ticks (all ants move once) should have passed
    while (now >= nextStepTime && totalStepsExecutedThisLoop < maxStepsPerLoopIteration) {
        for (let i = 0; i < ants.length; i++) {
            const ant = ants[i];
            if (!ant) continue;

            // 1. Record current location before stepping
            const prevX = ant.x;
            const prevY = ant.y;
            cellsToUpdate.add(`${prevX},${prevY}`);

            // 2. Execute step for this ant
            stepSingleAntLogic(ant);

            // 3. Record new location after stepping
            cellsToUpdate.add(`${ant.x},${ant.y}`);
        }

        nextStepTime += stepDuration;
        totalStepsExecutedThisLoop += ants.length;
        if (stepDuration <= 0 || !isFinite(stepDuration)) { /* ... */ break; }
    }

    if (totalStepsExecutedThisLoop >= maxStepsPerLoopIteration) {
        // console.warn(`Max steps (${maxStepsPerLoopIteration}) reached.`); // Removed warning
        // Reset nextStepTime based on current time to avoid huge future jumps
        // This allows the simulation to recover if it falls far behind.
        nextStepTime = performance.now() + stepDuration;
    }

    const timeToNext = Math.max(0, nextStepTime - performance.now());
    simulationTimeoutId = setTimeout(simulationLoop, timeToNext);
}

function startSimulationLoop() {
    if (simulationTimeoutId) return; // Already running

    console.log(`Starting/Resuming Simulation Loop...`);

    // Adjust nextStepTime if resuming from pause
    if (pauseTime > 0) {
        const elapsedPausedTime = performance.now() - pauseTime;
        nextStepTime += elapsedPausedTime; // Adjust schedule forward
        console.log(`Resumed after ${elapsedPausedTime.toFixed(0)}ms pause. Adjusted nextStepTime to ${nextStepTime.toFixed(0)}`);
        pauseTime = 0; // Reset pause time
    } else {
        // If starting fresh, initialize nextStepTime
        nextStepTime = performance.now();
        console.log(`Starting fresh. Initial nextStepTime ${nextStepTime.toFixed(0)}`);
    }

    // Schedule the first call based on adjusted/initial nextStepTime
    const timeToFirstCall = Math.max(0, nextStepTime - performance.now());
    simulationTimeoutId = setTimeout(simulationLoop, timeToFirstCall);
    console.log(`Scheduled first simulation check in ${timeToFirstCall.toFixed(0)}ms`);
}

function stopSimulationLoop() {
    if (simulationTimeoutId) {
        clearTimeout(simulationTimeoutId);
        simulationTimeoutId = null;
        pauseTime = performance.now(); // Record pause time
        console.log("Simulation Loop stopped.");
    }
}

// --- Render Loop ---
function renderLoop() {
    if (!isRunning) {
        renderRequestId = null; // Ensure ID is cleared
        return; // Don't draw or request next frame
    }
    draw(); // Calls draw -> drawChangedCellsAndAnts
    renderRequestId = requestAnimationFrame(renderLoop);
}

function startRenderLoop() {
    if (renderRequestId) return; // Already running
    console.log("Starting Render Loop.");
    renderRequestId = requestAnimationFrame(renderLoop);
}

function stopRenderLoop() {
    if (renderRequestId) {
        cancelAnimationFrame(renderRequestId);
        renderRequestId = null;
        console.log("Render Loop stopped.");
    }
}

function calculateSimDelay(targetStepsPerSec) {
    if (targetStepsPerSec <= 0) return 10000; // Avoid division by zero, very slow
    // Calculate delay, clamp between 0 (for max speed) and a reasonable max
    const delay = 1000 / targetStepsPerSec;
    return Math.max(0, Math.min(10000, delay)); // Clamp delay (0ms to 10s)
}

function runTests() {
    console.log("%c--- Running Turmite Tests ---", "color: yellow; font-size: 1.2em;");
    let allTestsPassed = true;

    function assert(condition, message) {
        if (condition) {
            console.log(`%c  ✅ PASS: ${message}`, "color: #8f8");
        } else {
            console.error(`%c  ❌ FAIL: ${message}`, "color: #f88");
            allTestsPassed = false;
        }
    }

    // Test 1: Grid Accessor Tests
    console.log("\n-- Testing Grid Accessors --");
    initGrid(); // Start with a clean grid (renamed from resetGrid)
    setGridColor(5, 10, 3);
    assert(getGridColor(5, 10) === 3, "Grid Accessor 1.1: Should set and get a color at (5, 10).");
    assert(getGridColor(0, 0) === defaultColor, "Grid Accessor 1.2: Unset cell (0, 0) should return default color.");
    assert(grid.has("5,10"), "Grid Accessor 1.3: Map should have key '5,10'.");
    setGridColor(5, 10, defaultColor); // Set back to default
    assert(getGridColor(5, 10) === defaultColor, "Grid Accessor 1.4: Cell (5, 10) should return default color after reset.");
    assert(!grid.has("5,10"), "Grid Accessor 1.5: Map should NOT have key '5,10' after setting to default.");

    // Test coordinate edge cases (negative, zero, large numbers)
    setGridColor(-1, -1, 1);
    assert(getGridColor(-1, -1) === 1, "Grid Accessor 1.6: Should set and get color at negative coordinates (-1, -1).");
    setGridColor(100000, 200000, 2);
    assert(getGridColor(100000, 200000) === 2, "Grid Accessor 1.7: Should set and get color at large coordinates.");
    initGrid(); // Clean grid for next test
    assert(getGridColor(-5, -5) === defaultColor, "Grid Accessor 1.8: Unset negative cell should return default color.");
    assert(getGridColor(999999, 999999) === defaultColor, "Grid Accessor 1.9: Unset large coordinate cell should return default color.");

    // Test 2: Boundary Crossing Tests
    console.log("\n-- Testing Ant Step at Boundary --");
    initGrid();
    // Test ant movement in all 4 directions past coordinate (0,0)
    // Ant 1: Start at (0,0), facing North (dir 0), move North
    rules = { 0: [{ writeColor: 1, move: '^', nextState: 0 }] }; // Absolute North
    let ant1 = { x: 0, y: 0, dir: 0, state: 0 };
    stepSingleAntLogic(ant1);
    assert(ant1.x === 0 && ant1.y === -1, "Boundary Crossing 2.1: Ant should move North to (0, -1).");
    assert(getGridColor(0, 0) === 1, "Boundary Crossing 2.2: (0,0) should be color 1 after ant1 moves.");
    initGrid();

    // Ant 2: Start at (0,0), facing East (dir 1), move East
    rules = { 0: [{ writeColor: 1, move: '>', nextState: 0 }] }; // Absolute East
    let ant2 = { x: 0, y: 0, dir: 1, state: 0 };
    stepSingleAntLogic(ant2);
    assert(ant2.x === 1 && ant2.y === 0, "Boundary Crossing 2.3: Ant should move East to (1, 0).");
    assert(getGridColor(0, 0) === 1, "Boundary Crossing 2.4: (0,0) should be color 1 after ant2 moves.");
    initGrid();

    // Ant 3: Start at (0,0), facing South (dir 2), move South
    rules = { 0: [{ writeColor: 1, move: 'v', nextState: 0 }] }; // Absolute South
    let ant3 = { x: 0, y: 0, dir: 2, state: 0 };
    stepSingleAntLogic(ant3);
    assert(ant3.x === 0 && ant3.y === 1, "Boundary Crossing 2.5: Ant should move South to (0, 1).");
    assert(getGridColor(0, 0) === 1, "Boundary Crossing 2.6: (0,0) should be color 1 after ant3 moves.");
    initGrid();

    // Ant 4: Start at (0,0), facing West (dir 3), move West
    rules = { 0: [{ writeColor: 1, move: '<', nextState: 0 }] }; // Absolute West
    let ant4 = { x: 0, y: 0, dir: 3, state: 0 };
    stepSingleAntLogic(ant4);
    assert(ant4.x === -1 && ant4.y === 0, "Boundary Crossing 2.7: Ant should move West to (-1, 0).");
    assert(getGridColor(0, 0) === 1, "Boundary Crossing 2.8: (0,0) should be color 1 after ant4 moves.");
    initGrid();

    // Ensure no wraparound behavior occurs (explicit check)
    rules = { 0: [{ writeColor: 1, move: '^', nextState: 0 }] }; // Move North
    let antWrap = { x: 0, y: 0, dir: 0, state: 0 };
    for (let i = 0; i < 10; i++) { // Move 10 steps North
        stepSingleAntLogic(antWrap);
    }
    assert(antWrap.y === -10, "Boundary Crossing 2.9: Ant should continue moving negatively, no wraparound.");
    assert(!grid.has(`${0},${gridRows - 1}`), "Boundary Crossing 2.10: No wraparound occurred on grid.");
    initGrid();

    // Test 3: Simulation Logic Tests
    console.log("\n-- Testing Simulation Logic --");
    initGrid();
    // Test Langton's Ant rule (R, L)
    rules = { 0: [{ writeColor: 1, move: 'R', nextState: 0 }, { writeColor: 0, move: 'L', nextState: 0 }] };
    let langtonAnt = { x: 0, y: 0, dir: 0, state: 0 }; // Start North

    // Step 1: At (0,0), color 0 (default), rule is {write:1, move:R, nextState:0}
    stepSingleAntLogic(langtonAnt);
    assert(getGridColor(0, 0) === 1, "Simulation Logic 3.1: Langton Ant - Cell (0,0) should be color 1.");
    assert(langtonAnt.dir === 1, "Simulation Logic 3.2: Langton Ant - Ant should turn East (dir 1).");
    assert(langtonAnt.x === 1 && langtonAnt.y === 0, "Simulation Logic 3.3: Langton Ant - Ant should move to (1,0).");
    assert(langtonAnt.state === 0, "Simulation Logic 3.4: Langton Ant - Ant state should remain 0.");

    // Step 2: At (1,0), color 0 (default), rule is {write:1, move:R, nextState:0}
    stepSingleAntLogic(langtonAnt);
    assert(getGridColor(1, 0) === 1, "Simulation Logic 3.5: Langton Ant - Cell (1,0) should be color 1.");
    assert(langtonAnt.dir === 2, "Simulation Logic 3.6: Langton Ant - Ant should turn South (dir 2).");
    assert(langtonAnt.x === 1 && langtonAnt.y === 1, "Simulation Logic 3.7: Langton Ant - Ant should move to (1,1).");

    // Test a multi-state rule
    initGrid();
    // Rule: (State 0, Color 0) -> Write 1, Move R, Next State 1
    //       (State 1, Color 0) -> Write 2, Move L, Next State 0
    rules = {
        0: [{ writeColor: 1, move: 'R', nextState: 1 }],
        1: [{ writeColor: 2, move: 'L', nextState: 0 }]
    };
    let multiStateAnt = { x: 0, y: 0, dir: 0, state: 0 }; // Start North, State 0

    // Step 1: State 0, Color 0 -> Write 1, Move R, Next State 1
    stepSingleAntLogic(multiStateAnt);
    assert(getGridColor(0, 0) === 1, "Simulation Logic 3.8: Multi-state - Cell (0,0) should be color 1.");
    assert(multiStateAnt.dir === 1, "Simulation Logic 3.9: Multi-state - Ant should turn East (dir 1).");
    assert(multiStateAnt.x === 1 && multiStateAnt.y === 0, "Simulation Logic 3.10: Multi-state - Ant should move to (1,0).");
    assert(multiStateAnt.state === 1, "Simulation Logic 3.11: Multi-state - Ant state should be 1.");

    // Step 2: State 1, Color 0 -> Write 2, Move L, Next State 0
    stepSingleAntLogic(multiStateAnt);
    assert(getGridColor(1, 0) === 2, "Simulation Logic 3.12: Multi-state - Cell (1,0) should be color 2.");
    assert(multiStateAnt.dir === 0, "Simulation Logic 3.13: Multi-state - Ant should turn North (dir 0).");
    assert(multiStateAnt.x === 1 && multiStateAnt.y === -1, "Simulation Logic 3.14: Multi-state - Ant should move to (1,-1).");
    assert(multiStateAnt.state === 0, "Simulation Logic 3.15: Multi-state - Ant state should be 0.");

    // Test 'S' (Stay) move
    initGrid();
    rules = { 0: [{ writeColor: 1, move: 'S', nextState: 0 }] };
    let stayAnt = { x: 0, y: 0, dir: 0, state: 0 };
    stepSingleAntLogic(stayAnt);
    assert(getGridColor(0, 0) === 1, "Simulation Logic 3.16: Stay Ant - Cell (0,0) should be color 1.");
    assert(stayAnt.x === 0 && stayAnt.y === 0, "Simulation Logic 3.17: Stay Ant - Ant should NOT move.");
    assert(stayAnt.dir === 0, "Simulation Logic 3.18: Stay Ant - Ant direction should NOT change.");

    // Test '?' (Random) move - difficult to assert exact position, but can check color change
    initGrid();
    rules = { 0: [{ writeColor: 1, move: '?', nextState: 0 }] };
    let randomAnt = { x: 0, y: 0, dir: 0, state: 0 };
    stepSingleAntLogic(randomAnt);
    assert(getGridColor(0, 0) === 1, "Simulation Logic 3.19: Random Ant - Cell (0,0) should be color 1.");
    // Cannot assert exact x,y but can check if it moved (i.e., not (0,0) unless it happened to move back)
    // For a random move, we just check the origin cell's color change.

    // Test HALT state
    initGrid();
    let haltAnt = { x: 0, y: 0, dir: 0, state: -1 }; // Ant in HALT state
    setGridColor(0, 0, 1); // Set a color to verify no change
    stepSingleAntLogic(haltAnt);
    assert(getGridColor(0, 0) === 1, "Simulation Logic 3.20: HALT Ant - Cell color should NOT change.");
    assert(haltAnt.x === 0 && haltAnt.y === 0, "Simulation Logic 3.21: HALT Ant - Ant position should NOT change.");
    assert(haltAnt.dir === 0, "Simulation Logic 3.22: HALT Ant - Ant direction should NOT change.");
    assert(haltAnt.state === -1, "Simulation Logic 3.23: HALT Ant - Ant state should remain -1.");

    // Test 4: Rendering Performance Tests (Logical Checks)
    console.log("\n-- Testing Rendering Performance (Logical) --");
    initGrid();
    setGridColor(1, 1, 1);
    setGridColor(2, 2, 2);
    setGridColor(3, 3, defaultColor); // Should remove from map
    assert(grid.size === 2, "Rendering Performance 4.1: drawGrid should only iterate over non-default cells (map size check).");

    // Test drawUpdates() by checking cellsToUpdate
    initGrid();
    ants = [{ x: 0, y: 0, dir: 0, state: 0 }];
    rules = { 0: [{ writeColor: 1, move: 'R', nextState: 0 }] };
    stepSingleAntLogic(ants[0]);
    assert(cellsToUpdate.has("0,0"), "Rendering Performance 4.2: cellsToUpdate should contain (0,0) after first step.");
    assert(cellsToUpdate.has("1,0"), "Rendering Performance 4.3: cellsToUpdate should contain (1,0) (new ant position).");
    
    // Simulate drawUpdates clearing the set
    cellsToUpdate.clear();
    assert(cellsToUpdate.size === 0, "Rendering Performance 4.4: cellsToUpdate should be cleared after drawUpdates (simulated).");

    // Test 5: Integration Tests (Simulated Interaction)
    console.log("\n-- Testing Integration (Simulated) --");
    // Mock DOM elements for initSimulation to work
    document.body.innerHTML = `
        <canvas id="antCanvas"></canvas>
        <div id="controlPanel">
            <button id="startStopBtn"></button>
            <button id="resetBtn"></button>
            <button id="randomizeBtn"></button>
            <select id="presetSelect"></select>
            <input type="number" id="antCountInput" value="1" min="1" max="1024">
            <select id="startPositionSelect"><option value="center">Center</option></select>
            <select id="startDirectionSelect"><option value="0">North</option></select>
            <input type="number" id="possibleStatesInput" value="2">
            <input type="number" id="possibleColorsInput" value="2">
            <input type="checkbox" id="individualRulesCheck">
            <div class="individual-rules-container"></div>
            <pre id="rulesDisplay"></pre>
            <button id="applyBtn"></button>
            <button id="discardBtn"></button>
            <button id="toggleRandomizeOptionsBtn"></button>
            <div id="randomizeOptionsContent"></div>
            <input type="checkbox" id="moveRelativeCheck" checked>
            <input type="checkbox" id="moveAbsoluteCheck">
            <input type="checkbox" id="moveRandomCheck">
            <input type="range" id="simSpeedSlider" value="50">
            <span id="simSpeedValue"></span>
            <button id="resetViewBtn"></button>
            <button id="minimizeBtn"></button>
            <button id="maximizeBtn"></button>
            <button id="editRuleBtn"></button>
            <button id="saveRuleBtn"></button>
            <button id="loadRuleBtn"></button>
        </div>
    `;
    // Re-initialize canvas and ctx after mocking DOM
    const mockCanvas = document.getElementById('antCanvas');
    const mockCtx = mockCanvas.getContext('2d');
    // Reassign global canvas/ctx for tests
    canvas = mockCanvas;
    ctx = mockCtx;

    // Mock presetDefinitions if not already globally available (assuming it's in presets.js)
    // For testing, we'll define a minimal one if it's not loaded
    if (typeof presetDefinitions === 'undefined') {
        window.presetDefinitions = {
            "langtons_ant": {
                name: "Langton's Ant",
                rules: { 0: [{ writeColor: 1, move: 'R', nextState: 0 }, { writeColor: 0, move: 'L', nextState: 0 }] }
            }
        };
    }

    // Simulate DOMContentLoaded to attach listeners and run initSimulation
    document.dispatchEvent(new Event('DOMContentLoaded'));

    // Test simulation start/stop/reset functionality
    const startStopBtn = document.getElementById('startStopBtn');
    const resetBtn = document.getElementById('resetBtn');
    const randomizeBtn = document.getElementById('randomizeBtn');
    const presetSelect = document.getElementById('presetSelect');
    const antCountInput = document.getElementById('antCountInput');
    const applyBtn = document.getElementById('applyBtn');
    const discardBtn = document.getElementById('discardBtn');

    // Test Start/Stop
    isRunning = false; // Ensure it's off initially for predictable test
    startStopBtn.click(); // Should start simulation
    assert(isRunning === true, "Integration 5.1: Start/Stop button should start simulation.");
    assert(simulationTimeoutId !== null || renderRequestId !== null, "Integration 5.2: Simulation/Render loops should be active.");
    startStopBtn.click(); // Should stop simulation
    assert(isRunning === false, "Integration 5.3: Start/Stop button should stop simulation.");
    assert(simulationTimeoutId === null && renderRequestId === null, "Integration 5.4: Simulation/Render loops should be inactive.");

    // Test Reset
    isRunning = true; // Set to running, then reset
    startSimulationLoop(); // Start loops for reset to stop
    startRenderLoop();
    resetBtn.click(); // Should reset and stop/restart based on initial state
    assert(grid.size === 0, "Integration 5.5: Reset button should clear the grid.");
    assert(ants.length === (parseInt(antCountInput.value, 10) || 1), "Integration 5.6: Reset should re-initialize ants.");
    // isRunning state after reset depends on 'wasRunning' passed to initSimulation, which here is true
    assert(isRunning === true, "Integration 5.7: Reset button should keep simulation running if it was running.");

    // Test Randomize
    initGrid(); // Clear grid for randomize test
    randomizeBtn.click();
    assert(Object.keys(rules).length > 0, "Integration 5.8: Randomize button should generate new rules.");
    assert(grid.size === 0, "Integration 5.9: Randomize should clear the grid.");
    assert(ants.length === (parseInt(antCountInput.value, 10) || 1), "Integration 5.10: Randomize should re-initialize ants.");

    // Test Preset Loading (Langton's Ant)
    presetSelect.value = 'langtons_ant';
    presetSelect.dispatchEvent(new Event('change')); // Simulate change event
    assert(JSON.stringify(rules) === JSON.stringify(presetDefinitions.langtons_ant.rules), "Integration 5.11: Preset select should load Langton's Ant rules.");
    assert(applyBtn.disabled === false, "Integration 5.12: Preset load should enable Apply button.");
    assert(discardBtn.disabled === false, "Integration 5.13: Preset load should enable Discard button.");

    // Test UI Controls (Ant Count, Apply, Discard)
    antCountInput.value = "5";
    antCountInput.dispatchEvent(new Event('input')); // Simulate input event
    assert(applyBtn.disabled === false, "Integration 5.14: Changing ant count should enable Apply button.");
    applyBtn.click(); // Apply changes
    assert(ants.length === 5, "Integration 5.15: Apply button should update ant count.");
    assert(applyBtn.disabled === true, "Integration 5.16: Apply button should be disabled after applying changes.");
    assert(discardBtn.disabled === true, "Integration 5.17: Discard button should be disabled after applying changes.");

    // Test Discard
    antCountInput.value = "10"; // Change again
    antCountInput.dispatchEvent(new Event('input'));
    assert(applyBtn.disabled === false, "Integration 5.18: Changing ant count again should enable Apply button.");
    discardBtn.click(); // Discard changes
    assert(parseInt(antCountInput.value, 10) === 5, "Integration 5.19: Discard button should revert ant count.");
    assert(applyBtn.disabled === true, "Integration 5.20: Apply button should be disabled after discarding changes.");
    assert(discardBtn.disabled === true, "Integration 5.21: Discard button should be disabled after discarding changes.");

    // Test 6: Visual Confirmation (Instructions for the developer)
    console.log("\n-- Visual Test (Manual) --");
    console.log("1. Load the `Langton's Ant` preset.");
    console.log("2. Set ant count to 1, start position to 'Center'.");
    console.log("3. Click 'Apply' and run the simulation.");
    console.log("4. OBSERVE: The ant should build a 'highway' and travel diagonally off-screen indefinitely.");
    console.log("5. It should NOT reappear on the other side of the screen (no wraparound).");
    console.log("6. Pan and zoom the grid. Ensure rendering is smooth and cells appear/disappear correctly.");
    console.log("7. Test 'Randomize' button, 'Ant Count' changes, and 'Start Position' changes.");
    console.log("8. Test 'Save Rule' and 'Load Rule' functionality.");

    // Final Result
    console.log("\n--- Test Suite Complete ---");
    if (allTestsPassed) {
        console.log("%c🎉 All automated tests passed!", "color: lightgreen; font-weight: bold;");
    } else {
        console.error("%c🔥 Some automated tests failed. Please review logs.", "color: red; font-weight: bold;");
    }
}