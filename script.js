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

// Define neon cell colors (distinct from ant color 'red')
const cellColors = [
    '#000000', // 0: Black (Background)
    '#FFFFFF', // 1: White (Replaced Cyan)
    '#FF00FF', // 2: Magenta/Fuchsia
    '#FFFF00', // 3: Yellow
    '#00FF00'  // 4: Lime
];
const numColors = cellColors.length;

// --- Turmite Rule Definition (Mutable) ---
let rules = {}; // Initialize as empty

// Function to generate random rules with variable states/colors
function generateRandomRules(numStates, numColorsToUse) {
    console.log(`Generating random rules for ${numStates} states and ${numColorsToUse} colors.`);
    const newRules = {};
    const moveOptions = ['L', 'R', 'N', 'U']; // Left, Right, None, U-turn

    for (let s = 0; s < numStates; s++) {
        newRules[s] = []; // Initialize state array
        // Rules should be defined for *all* possible colors the grid *might* contain,
        // even if we only write a subset initially.
        // Let's stick to defining rules for the colors we intend to use (numColorsToUse)
        for (let c = 0; c < numColorsToUse; c++) {
            // Write one of the *used* colors
            const writeColor = Math.floor(Math.random() * numColorsToUse);
            const moveIndex = Math.floor(Math.random() * moveOptions.length);
            const move = moveOptions[moveIndex];
            // Go to one of the *used* states
            const nextState = Math.floor(Math.random() * numStates);
            newRules[s].push({ writeColor, move, nextState });
        }
    }
    rules = newRules; // Update the global rules object
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

function initAnts() {
    ants = []; // Clear existing ants
    if (gridCols <= 0 || gridRows <= 0) { return; }

    const antCountInput = document.getElementById('antCountInput');
    const numAntsToCreate = antCountInput ? parseInt(antCountInput.value, 10) : 10;
    const validatedAntCount = Math.max(1, Math.min(1024, numAntsToCreate || 1));

    const centerX = Math.floor(gridCols / 2);
    const centerY = Math.floor(gridRows / 2);
    const clusterSize = Math.ceil(Math.sqrt(validatedAntCount));
    const offset = Math.floor(clusterSize / 2);

    for (let i = 0; i < validatedAntCount; i++) {
        const gridX = centerX - offset + (i % clusterSize);
        const gridY = centerY - offset + Math.floor(i / clusterSize);
        const newAnt = {
            x: gridX,
            y: gridY,
            dir: 0, // Start facing North
            state: 0
        };
        ants.push(newAnt);
    }
    console.log(`Initialized ${ants.length} ants.`);
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

    if (randomize) {
        generateRandomRules(numStates, numColorsToUse);
    } else if (Object.keys(rules).length === 0) {
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
    initAnts(); // Ants are placed relative to this initial grid
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
    rulesString += `// Moves: L:Left, R:Right, N:None, U:U-Turn\n\n`;
    try { rulesString += JSON.stringify(rules, null, 2); } catch (e) { /* ... */ }
    if (rulesDisplay) rulesDisplay.textContent = rulesString;
    
    // --- Ensure Apply button is disabled after any init ---
    if (applyBtn) applyBtn.disabled = true;

    setCanvasSmoothing(false);
    cellsToUpdate.clear();
    needsFullRedraw = true; // Trigger full redraw for initial state

    // Explicitly draw the initial full grid state
    // No clear needed here as drawGrid draws all cells
    drawGrid(); // This draws all cells, covering previous state

    isRunning = wasRunning;
    updateButtonText();
    pauseTime = 0;

    if (isRunning) {
        startSimulationLoop(); // Schedules steps
        startRenderLoop();     // Schedules calls to draw() -> drawUpdates
    } 
    // else: Paused state handled, initial draw already done.
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

    let rule;
    try { rule = rules[currentState][currentCellColor]; }
    catch (e) { console.error(`Rule lookup failed! State: ${currentState}, Color: ${currentCellColor}`, e); isRunning = false; stopSimulationLoop(); stopRenderLoop(); updateButtonText(); return; }
    if (!rule) { console.error(`No rule found for State: ${currentState}, Color: ${currentCellColor}`); isRunning = false; stopSimulationLoop(); stopRenderLoop(); updateButtonText(); return; }

    // --- Record change only if color is different ---
    if (rule.writeColor !== currentCellColor) {
        grid[currentCellY][currentCellX] = rule.writeColor;
        cellsToUpdate.add(`${currentCellX},${currentCellY}`); // Add coordinate string to Set
    } // Else: No color change, no need to redraw cell

    switch (rule.move) {
        case 'R': ant.dir = (ant.dir + 1) % 4; break;
        case 'L': ant.dir = (ant.dir - 1 + 4) % 4; break;
        case 'U': ant.dir = (ant.dir + 2) % 4; break;
        case 'N': default: break;
    }

    ant.state = rule.nextState;

    const moveOffset = directions[ant.dir];
    ant.x += moveOffset.dx;
    ant.y += moveOffset.dy;
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
    setCanvasSmoothing(true); // Enable AA for circles
    for (let i = 0; i < ants.length; i++) {
        const ant = ants[i];
        if (!ant) continue;

        // --- Check if ant is within logical grid bounds --- 
        if (ant.x < 0 || ant.x >= gridCols || ant.y < 0 || ant.y >= gridRows) {
            continue; // Don't draw if logically outside the grid
        }

        // Calculate ant's center pixel position
        const antCenterX = offsetX + (ant.x + 0.5) * cellSize * scale;
        const antCenterY = offsetY + (ant.y + 0.5) * cellSize * scale;
        const antRadius = (cellSize / 2.5) * scale;

        // Only draw if potentially visible on screen
        if (antCenterX + antRadius > 0 && antCenterX - antRadius < width &&
            antCenterY + antRadius > 0 && antCenterY - antRadius < height) {
            ctx.fillStyle = 'red'; ctx.beginPath(); ctx.arc(antCenterX, antCenterY, antRadius, 0, 2 * Math.PI); ctx.fill();
        }
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
    setCanvasSmoothing(true); // Enable AA for circles
    for (let i = 0; i < ants.length; i++) {
        const ant = ants[i];
        if (!ant) continue;

        // --- Check if ant is within logical grid bounds --- 
        if (ant.x < 0 || ant.x >= gridCols || ant.y < 0 || ant.y >= gridRows) {
            continue; // Don't draw if logically outside the grid
        }

        const antCenterX = offsetX + (ant.x + 0.5) * cellSize * scale;
        const antCenterY = offsetY + (ant.y + 0.5) * cellSize * scale;
        const antRadius = (cellSize / 2.5) * scale;
        // Check visibility before drawing
        if (antCenterX + antRadius > 0 && antCenterX - antRadius < width &&
            antCenterY + antRadius > 0 && antCenterY - antRadius < height)
        {
            ctx.fillStyle = 'red'; ctx.beginPath(); ctx.arc(antCenterX, antCenterY, antRadius, 0, 2 * Math.PI); ctx.fill();
        }
    }
    setCanvasSmoothing(false); // Disable AA immediately after

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
    // Check for 'R' key (Randomize)
    else if (event.key === 'r' || event.key === 'R') {
        const btn = document.getElementById('randomizeBtn');
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

    // Check all required elements rigorously
    if (!simSpeedSlider || !simSpeedValueSpan || !startStopBtn || !resetBtn || !resetViewBtn || !minimizeBtn || !maximizeBtn || !controlPanel || !rulesDisplay || !applyBtn || !randomizeBtn || !antCountInput) {
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
        return; // Stop execution
    }

    console.log("All control panel elements found. Proceeding with listeners and init...");

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
        // Optionally reset ant count input to current sim state? No, let it keep user input.
        // Optionally reset rules text to current sim state? No, let it keep user input.
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

    // Ant Count Input Listener
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
            if (applyBtn) applyBtn.disabled = false;
        });
    }

    // Rules Display Listener (Input event)
    rulesDisplay.addEventListener('input', () => {
        if (applyBtn) applyBtn.disabled = false;
    });

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
            const currentState = isRunning;
            console.log("Resetting simulation to apply changes.");
            initSimulation(false, undefined, undefined, currentState); // initSimulation reads ant count and uses current global 'rules'
        });
    }

    // Randomize Listener - Creates new rules AND resets
    if (randomizeBtn) {
        randomizeBtn.addEventListener('click', () => {
            console.log("Randomizing rules and resetting simulation...");
            const currentState = isRunning;
            const randomStates = Math.floor(Math.random() * 8) + 1;
            const randomColors = Math.floor(Math.random() * (numColors - 1)) + 2;
            // Generate rules THEN reset simulation (initSimulation uses new rules and current ant count)
            initSimulation(true, randomStates, randomColors, currentState);
            if (applyBtn) applyBtn.disabled = true;
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

    initSimulation(false, undefined, undefined, true); // Initial load always starts running
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