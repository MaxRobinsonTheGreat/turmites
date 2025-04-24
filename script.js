const canvas = document.getElementById('antCanvas');
const ctx = canvas.getContext('2d');

let width, height;
const cellSize = 1; // Logical size of each cell (we zoom the canvas, not change this)
let grid;
let ants = []; // Array to hold multiple ants
let gridCols = 0, gridRows = 0;
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
    const moveOptions = ['L', 'R', 'N', 'U', 'S'];

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
    const moveOptions = ['L', 'R', 'N', 'U', 'S'];
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

function initGrid() {
    // Calculate grid size based on current viewport and CURRENT scale
    gridCols = Math.ceil(width / scale); // Use current scale
    gridRows = Math.ceil(height / scale); // Use current scale

    if (gridCols <= 0 || gridRows <= 0) { 
        console.warn("Cannot init grid with zero/negative dimensions, possibly invalid scale?", {width, height, scale});
        gridCols = 1; gridRows = 1; // Set minimum size to prevent errors down the line
    }
    const defaultColorIndex = 0;
    grid = Array(gridRows).fill(null).map(() => Array(gridCols).fill(defaultColorIndex));
    console.log(`Initialized grid: ${gridCols}x${gridRows} with color ${defaultColorIndex} (${cellColors[defaultColorIndex]}) using scale ${scale}`);
}

// --- Helper Functions ---

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
    rulesString += `// Moves: L:Left, R:Right, N:None, U:U-Turn, S:Stay\n\n`;
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
    if (!grid || !ant) return; // Check individual ant
    if (gridCols <= 0 || gridRows <= 0) return;

    ant.x = (ant.x + gridCols) % gridCols;
    ant.y = (ant.y + gridRows) % gridRows;

    if (!grid[ant.y] || ant.y < 0 || ant.y >= grid.length || ant.x < 0 || ant.x >= grid[ant.y].length) {
         console.error("Ant out of bounds after wrap:", ant);
         // Optionally reset the specific ant instead of returning?
         // ant.x = Math.floor(gridCols / 2);
         // ant.y = Math.floor(gridRows / 2);
         return;
     }

    const currentCellX = ant.x;
    const currentCellY = ant.y;
    const currentCellColor = grid[currentCellY][currentCellX];
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
        grid[currentCellY][currentCellX] = rule.writeColor;
        cellsToUpdate.add(`${currentCellX},${currentCellY}`); 
    } 

    let dx = 0, dy = 0;
    // --- Determine Direction Change --- 
    switch (rule.move) { // Use rule.move directly again
        case 'R': ant.dir = (ant.dir + 1) % 4; break;
        case 'L': ant.dir = (ant.dir - 1 + 4) % 4; break;
        case 'U': ant.dir = (ant.dir + 2) % 4; break;
        case 'S': break; 
        case 'N': default: break; 
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
    if (!grid || !grid.length || !grid[0].length || !ctx) return;
    // Remove save/transform/restore - calculate pixels directly
    // ctx.save();
    // ctx.translate(offsetX, offsetY);
    // ctx.scale(scale, scale);
    setCanvasSmoothing(false); // Still important

    if (gridCols <= 0 || gridRows <= 0) { return; }

    // Calculate visible grid bounds (in grid cell coordinates - still useful)
    const viewX1 = -offsetX / scale, viewY1 = -offsetY / scale;
    const viewX2 = (width - offsetX) / scale, viewY2 = (height - offsetY) / scale;
    const cellSize = 1;
    // Add a small buffer to catch cells partially visible at edges
    const buffer = 2;
    const startCol = Math.max(0, Math.floor(viewX1 / cellSize) - buffer);
    const endCol = Math.min(gridCols, Math.ceil(viewX2 / cellSize) + buffer);
    const startRow = Math.max(0, Math.floor(viewY1 / cellSize) - buffer);
    const endRow = Math.min(gridRows, Math.ceil(viewY2 / cellSize) + buffer);

    // Draw ALL cells using calculated pixel coordinates
    for (let y = startRow; y < endRow; y++) {
        if (y < 0 || y >= grid.length || !grid[y]) continue;
        for (let x = startCol; x < endCol; x++) {
             if (x < 0 || x >= grid[y].length) continue;

            const colorIndex = grid[y][x];
            // Draw ALL valid color indices (including 0)
            if (colorIndex >= 0 && colorIndex < cellColors.length) {
                 ctx.fillStyle = cellColors[colorIndex];

                 // Calculate final pixel coordinates and dimensions
                 const px = Math.floor(offsetX + x * cellSize * scale);
                 const py = Math.floor(offsetY + y * cellSize * scale);
                 const pw = Math.ceil(cellSize * scale);
                 const ph = Math.ceil(cellSize * scale);

                 if (px + pw > 0 && px < width && py + ph > 0 && py < height) {
                    ctx.fillRect(px, py, pw, ph);
                 }
            } // else { console.warn(`Invalid color index at ${x},${y}: ${colorIndex}`); } // Optional: Warn on invalid index
        }
    }

    // --- Draw Ants (Enable Smoothing) --- 
    setCanvasSmoothing(true); // Enable AA for shapes
    for (let i = 0; i < ants.length; i++) {
        if (ants[i]) drawAntShape(ants[i]); // Call without isFullRedraw
    }
    setCanvasSmoothing(false); // Disable AA immediately after
    // ctx.restore(); // No restore needed
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

        // Ensure coordinate is valid and on grid before drawing
        if (isNaN(x) || isNaN(y) || y < 0 || y >= grid.length || x < 0 || x >= grid[y].length) return;

        const colorIndex = grid[y][x]; // Get the CURRENT color of the cell
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

    // Check all required elements rigorously
    if (!simSpeedSlider || !simSpeedValueSpan || !startStopBtn || !resetBtn || !resetViewBtn || !minimizeBtn || !maximizeBtn || !controlPanel || !rulesDisplay || !applyBtn || !randomizeBtn || !antCountInput || !startPositionSelect || !possibleStatesInput || !possibleColorsInput || !rulesDisplayContainer || !individualRulesCheck || !individualRulesContainer || !editRuleBtn || !ruleLabel || !startDirectionSelect || !rulesDisplayPre /* Add check */ || !saveRuleBtn || !loadRuleBtn || !discardBtn || !presetSelect) {
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
        return; // Stop execution
    }

    console.log("All control panel elements found. Proceeding with listeners and init...");

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
        console.log("Resetting simulation state (keeping current rules)...");
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
            if (applyBtn) applyBtn.disabled = false;
            const discardBtn = document.getElementById('discardBtn');
            if (discardBtn) discardBtn.disabled = false; // Also enable discard
            if (presetSelect) presetSelect.value = 'custom'; // Set preset to Custom
            // If editor was open and count becomes 1 (which forces individual off),
            // it will be handled by updateIndividualRulesVisibility hiding the container.
            // No extra logic needed here.
        });
    }

    // Rules Display Listener (Input event)
    rulesDisplay.addEventListener('input', () => {
        if (applyBtn) applyBtn.disabled = false;
        const discardBtn = document.getElementById('discardBtn');
        if (discardBtn) discardBtn.disabled = false; // Also enable discard
        if (presetSelect) presetSelect.value = 'custom'; // Set preset to Custom
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
            if (applyBtn) applyBtn.disabled = false;
            const discardBtn = document.getElementById('discardBtn');
            if (discardBtn) discardBtn.disabled = false; // Also enable discard
            if (presetSelect) presetSelect.value = 'custom'; // Set preset to Custom
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
            if (applyBtn) applyBtn.disabled = false; // Enable Apply on change
            const discardBtn = document.getElementById('discardBtn');
            if (discardBtn) discardBtn.disabled = false; // Also enable discard
            if (presetSelect) presetSelect.value = 'custom'; // Set preset to Custom
        });
    }

    // Start Direction Select Listener
    if (startDirectionSelect) {
        startDirectionSelect.addEventListener('input', () => {
            if (applyBtn) applyBtn.disabled = false; // Enable Apply on change
            const discardBtn = document.getElementById('discardBtn');
            if (discardBtn) discardBtn.disabled = false; // Also enable discard
            if (presetSelect) presetSelect.value = 'custom'; // Set preset to Custom
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
            // Enable Apply as this setting change *could* affect next Apply/Reset
            // Or just affect next Randomize? Let's enable Apply for now, user can clarify if needed.
            if (applyBtn) applyBtn.disabled = false; 
            const discardBtn = document.getElementById('discardBtn');
            if (discardBtn) discardBtn.disabled = false; // Also enable discard
            if (presetSelect) presetSelect.value = 'custom'; // Set preset to Custom
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
             if (applyBtn) applyBtn.disabled = false; 
            const discardBtn = document.getElementById('discardBtn');
            if (discardBtn) discardBtn.disabled = false; // Also enable discard
            if (presetSelect) presetSelect.value = 'custom'; // Set preset to Custom
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
                        rulesString += `// Moves: L:Left, R:Right, N:None, U:U-Turn, S:Stay\n\n`;
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

        let presetRules = null;
        let presetName = "";

        switch(presetValue) {
            case 'langtons':
                presetName = "Langton's Ant";
                presetRules = {
                    0: [
                        { writeColor: 1, move: 'R', nextState: 0 }, // Color 0: Turn Right, Write 1
                        { writeColor: 0, move: 'L', nextState: 0 }  // Color 1: Turn Left, Write 0
                    ]
                };
                break;
            case 'constructor': // Added Constructor preset
                presetName = "Constructor";
                presetRules = {
                    "0": [
                        {
                        "writeColor": 0,
                        "move": "S",
                        "nextState": 2
                        },
                        {
                        "writeColor": 0,
                        "move": "S",
                        "nextState": 2
                        }
                    ],
                    "1": [
                        {
                        "writeColor": 1,
                        "move": "L",
                        "nextState": 2
                        },
                        {
                        "writeColor": 0,
                        "move": "R",
                        "nextState": 1
                        }
                    ],
                    "2": [
                        {
                        "writeColor": 0,
                        "move": "N",
                        "nextState": 1
                        },
                        {
                        "writeColor": 0,
                        "move": "U",
                        "nextState": 2
                        }
                    ]
                };
                break;
            // Add more cases for future presets here
            case 'custom': // Renamed from 'none'
            default:
                // Do nothing if 'custom' or unknown value selected
                return; 
        }

        if (presetRules) {
            try {
                const numStates = Object.keys(presetRules).length;
                const numColors = presetRules[0] ? presetRules[0].length : 0;
                let rulesString = `// Preset: ${presetName}\n`;
                rulesString += `// States: ${numStates}\n`;
                rulesString += `// Colors: ${numColors}\n`; 
                rulesString += `// Moves: L:Left, R:Right, N:None, U:U-Turn, S:Stay\n\n`;
                rulesString += JSON.stringify(presetRules, null, 2);

                rulesEditor.textContent = rulesString;
                applyBtn.disabled = false; // Restore enabling
                discardBtn.disabled = false; // Restore enabling
                console.log(`Preset '${presetName}' loaded into editor.`);

            } catch (error) {
                console.error("Error formatting preset rule:", error);
                alert(`Failed to load preset '${presetName}': ${error.message}`);
            }
        }
    }

    // Preset Select Listener
    if (presetSelect) {
        presetSelect.addEventListener('change', (event) => {
            loadPresetRule(event.target.value);
        });
    }

    initSimulation(false, undefined, undefined, true); // Initial Load

    // Load the default preset AFTER the initial simulation setup
    loadPresetRule(presetSelect.value);
    // --- Disable buttons immediately after initial preset load --- 
    if (applyBtn) applyBtn.disabled = true;
    if (discardBtn) discardBtn.disabled = true;
    console.log("Disabled Apply/Discard after initial preset load.");
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