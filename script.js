const canvas = document.getElementById('antCanvas');
const ctx = canvas.getContext('2d');

let width, height;
const cellSize = 1; // Logical size of each cell (we zoom the canvas, not change this)
let grid;
let ant;
let intervalId = null;
let stepsPerTick; // Number of steps to run per interval tick
let isRunning = true; // Simulation starts running

// View transformation state
let scale = 8; // Initial zoom level (Adjust as desired)
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

let gridCols = 0; // Store grid dimensions globally for centering logic
let gridRows = 0;

let currentIntervalId = null;
let currentIntervalDelay = 0;
let currentStepsPerTick = 1;
let timeoutId = null; // ID for setTimeout loop (replaced animationFrameId)

// --- Configuration ---
const minSimSpeed = 1;       // Min Steps/Sec at slider value 1
const midSimSpeed = 60;      // Steps/Sec at slider midpoint (50)
const maxSimSpeed = 100000;   // Max Target Steps/Sec at slider value 100 (Adjusted)
const maxStepsPerLoopIteration = 100000; // Safety limit

// --- State Variables ---
let simulationTimeoutId = null;   // ID for simulation setTimeout loop
let nextStepTime = 0;             // Target time for the next simulation step
let renderRequestId = null;       // ID for render requestAnimationFrame
let pauseTime = 0; // Added: Store time when paused

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
    canvas.width = width;
    canvas.height = height;

    // Recalculate offset to re-center the *existing* grid
    if (gridCols > 0 && gridRows > 0) { // Use stored dimensions
        const gridCenterX = gridCols / 2 * cellSize;
        const gridCenterY = gridRows / 2 * cellSize;
        offsetX = width / 2 - gridCenterX * scale;
        offsetY = height / 2 - gridCenterY * scale;
    } else {
        // Fallback if called before grid initialized
        offsetX = width / 2;
        offsetY = height / 2;
    }

    setCanvasSmoothing(false);
    requestAnimationFrame(draw); // Redraw needed after size/offset change
}

function setCanvasSmoothing(enabled) {
     if (!ctx) return; // Add check for context existence
     ctx.imageSmoothingEnabled = enabled;
     ctx.mozImageSmoothingEnabled = enabled;
     ctx.webkitImageSmoothingEnabled = enabled;
     ctx.msImageSmoothingEnabled = enabled;
}

function initGrid() {
    // Calculate grid size based on current viewport and scale
    // Use ceil to ensure the grid covers the whole viewport
    gridCols = Math.ceil(width / scale); // Use current width
    gridRows = Math.ceil(height / scale); // Use current height

    // Initialize cells to 1 (black background)
    grid = Array(gridRows).fill(null).map(() => Array(gridCols).fill(1));
    console.log(`Initialized grid: ${gridCols}x${gridRows} (state 1) based on scale ${scale}`);
}

function initAnt() {
    // Place ant in the center of the *current* grid
    ant = {
        x: Math.floor(gridCols / 2),
        y: Math.floor(gridRows / 2),
        dir: 0 // Start facing North
    };
}

function resetCamera() {
    console.log("Resetting camera view...");
    scale = 8;
    offsetX = 0;
    offsetY = 0;
    // No need to requestAnimationFrame(draw) here, render loop handles it
}

function initSimulation() {
    console.log("initSimulation called.");
    stopSimulationLoop();
    stopRenderLoop();

    width = window.innerWidth;
    height = window.innerHeight;
    if (!canvas) { console.error("Canvas missing!"); return; }
    canvas.width = width;
    canvas.height = height;

    // Reset scale to initial before calculating grid/offset
    scale = 8;

    initGrid();
    initAnt();

    if (gridCols > 0 && gridRows > 0) {
        const gridCenterX = gridCols / 2 * cellSize;
        const gridCenterY = gridRows / 2 * cellSize;
        // Calculate and STORE the initial offsets
        initialOffsetX = width / 2 - gridCenterX * scale;
        initialOffsetY = height / 2 - gridCenterY * scale;
        // Set current offset to initial
        offsetX = initialOffsetX;
        offsetY = initialOffsetY;
    } else {
        // Fallback
        initialOffsetX = width / 2;
        initialOffsetY = height / 2;
        offsetX = initialOffsetX;
        offsetY = initialOffsetY;
    }

    // Setup Controls - Remove FPS display references
    const simSpeedSlider = document.getElementById('simSpeedSlider');
    const simSpeedValueSpan = document.getElementById('simSpeedValue');
    // actualFpsValueSpan = document.getElementById('actualFpsValue'); // Remove

    if (!simSpeedSlider || !simSpeedValueSpan /* || !actualFpsValueSpan */) { console.error("UI elements missing!"); return; }

    const initialSliderValue = parseInt(simSpeedSlider.value, 10);
    const initialSimSpeed = mapSliderToSpeed(initialSliderValue);
    simSpeedSlider.value = initialSliderValue;
    simSpeedValueSpan.textContent = Math.round(initialSimSpeed);
    // frameTimes.length = 0; // Remove
    // lastFpsUpdateTime = 0; // Remove
    // if(actualFpsValueSpan) actualFpsValueSpan.textContent = '--'; // Remove

    setCanvasSmoothing(false);
    isRunning = true;
    updateButtonText();

    // Make sure panel is not minimized on init
    const panel = document.getElementById('controlPanel');
    if (panel) panel.classList.remove('minimized');

    pauseTime = 0; // Reset pause time on full init
    startSimulationLoop();
    startRenderLoop();
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

// Core logic of a single ant step (inverted)
function stepLogic() {
    if (!grid || !ant || !grid.length || !grid[0].length) return;

    const cols = grid[0].length;
    const rows = grid.length;

    // Wrap-around bounds check
    ant.x = (ant.x + cols) % cols;
    ant.y = (ant.y + rows) % rows;

    // Check validity before grid access
    if (ant.y < 0 || ant.y >= grid.length || ant.x < 0 || ant.x >= grid[0].length) {
        console.error("Ant out of bounds despite wrap-around:", ant);
        ant.x = Math.floor(cols / 2);
        ant.y = Math.floor(rows / 2);
        ant.dir = 0;
        return;
    }

    const currentCellX = ant.x;
    const currentCellY = ant.y;

    try {
        // Inverted Langton's Ant rule:
        if (grid[currentCellY][currentCellX] === 1) { // Black square
            ant.dir = (ant.dir + 1) % 4; // Turn right
            grid[currentCellY][currentCellX] = 0; // Flip to white
        } else { // White square (state 0)
            ant.dir = (ant.dir - 1 + 4) % 4; // Turn left
            grid[currentCellY][currentCellX] = 1; // Flip to black
        }
    } catch (e) {
         console.error(`Error accessing grid at [${currentCellY}][${currentCellX}]. Ant:`, ant, "Grid dims:", grid.length, grid[0].length, e);
         ant.x = Math.floor(cols / 2);
         ant.y = Math.floor(rows / 2);
         ant.dir = 0;
         return;
    }

    // Move forward
    const move = directions[ant.dir];
    ant.x += move.dx;
    ant.y += move.dy;
}

// Called by setInterval in Normal Mode
function runSimulationTick() {
    if (!isRunning) {
         if (currentIntervalId) clearInterval(currentIntervalId);
         currentIntervalId = null;
         return;
     }
    for (let i = 0; i < currentStepsPerTick; i++) {
        stepLogic();
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
        stepLogic();
    }

    // Draw the result of the batch
    // Using requestAnimationFrame here ensures drawing happens smoothly,
    // but the *next* simulation batch starts via setTimeout immediately after this call.
    requestAnimationFrame(draw);

    // Schedule the next batch immediately
    timeoutId = setTimeout(runMaxSpeedLoop, 0);
}

function drawGrid() {
    if (!grid || !grid.length || !grid[0].length) return;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    setCanvasSmoothing(false);

    // Calculate visible grid bounds
    const viewX1 = -offsetX / scale;
    const viewY1 = -offsetY / scale;
    const viewX2 = (width - offsetX) / scale;
    const viewY2 = (height - offsetY) / scale;
    const startCol = Math.max(0, Math.floor(viewX1 / cellSize));
    const endCol = Math.min(grid[0].length, Math.ceil(viewX2 / cellSize));
    const startRow = Math.max(0, Math.floor(viewY1 / cellSize));
    const endRow = Math.min(grid.length, Math.ceil(viewY2 / cellSize));

    // Draw white cells (state 0) using a single path
    ctx.beginPath();
    ctx.fillStyle = 'white'; // Path color is now white

    for (let y = startRow; y < endRow; y++) {
        if (y < 0 || y >= grid.length) continue;
        for (let x = startCol; x < endCol; x++) {
             if (x < 0 || x >= grid[y].length) continue;

            if (grid[y][x] === 0) { // Draw white cells (state 0)
               ctx.rect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }
    }
    ctx.fill();

    // Draw Ant as a Circle (Red)
    if (ant && ant.x >= startCol && ant.x < endCol && ant.y >= startRow && ant.y < endRow) {
        ctx.fillStyle = 'red'; // Ant color changed to red
        ctx.beginPath();
        ctx.arc(
            ant.x * cellSize + cellSize / 2,
            ant.y * cellSize + cellSize / 2,
            cellSize / 2.5,
            0, 2 * Math.PI
        );
        ctx.fill();
    }

    ctx.restore();
}

// Main drawing function (add FPS calculation)
function draw() {
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
    drawGrid();
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

    setCanvasSmoothing(false); // Ensure pixelation is off after zoom
    requestAnimationFrame(draw); // Redraw with new transform
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

    requestAnimationFrame(draw); // Redraw during panning
}

function handleMouseLeave(event) {
     if (isDragging) {
        isDragging = false; // Stop dragging if mouse leaves canvas
        canvas.style.cursor = 'grab';
    }
}

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

    // Check all required elements rigorously
    if (!simSpeedSlider || !simSpeedValueSpan || !startStopBtn || !resetBtn || !resetViewBtn || !minimizeBtn || !maximizeBtn || !controlPanel) {
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
        console.log("Resetting simulation...");
        isRunning = true; // Ensure it's running after reset
        initSimulation(); // Reset state and restart simulation
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

    initSimulation(); // Initial setup and start
});

// Global listeners like resize can often stay global
window.addEventListener('resize', resizeCanvas);

// --- Simulation Loop (Corrected Logic) ---
function simulationLoop() {
    if (!isRunning) {
        simulationTimeoutId = null; // Ensure cleared
        return; // Stop if paused
    }

    const now = performance.now();
    let stepsExecuted = 0;

    // Determine target speed using the mapping function
    const slider = document.getElementById('simSpeedSlider');
    const sliderValue = slider ? parseInt(slider.value, 10) : 50; // Default to midpoint if no slider
    const targetSpeed = mapSliderToSpeed(sliderValue);
    const stepDuration = (targetSpeed > 0) ? 1000 / targetSpeed : Infinity;

    // Catch up on steps if needed (runs 0 times if ahead of schedule)
    while (now >= nextStepTime && stepsExecuted < maxStepsPerLoopIteration) {
        stepLogic();
        nextStepTime += stepDuration;
        stepsExecuted++;
        // Safety break if stepDuration is invalid
        if (stepDuration <= 0 || !isFinite(stepDuration)) {
             console.error("Step duration is invalid, breaking loop.", stepDuration);
             nextStepTime = performance.now() + 1000; // Force a 1s pause
             break;
         }
    }

    // Handle hitting the step limit
    if (stepsExecuted >= maxStepsPerLoopIteration) {
        console.warn(`Max steps (${maxStepsPerLoopIteration}) reached in one loop iteration.`);
        // Reset nextStepTime based on current time to avoid huge future jumps
        nextStepTime = performance.now() + stepDuration;
    }

    // Always calculate the delay to the *next* scheduled step time based on the *current* time
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
    // isRunning check prevents drawing when paused
    if (!isRunning) {
        renderRequestId = null; // Ensure ID is cleared
        return; // Don't draw or request next frame
    }
    draw(); // Perform drawing
    renderRequestId = requestAnimationFrame(renderLoop); // Request next frame
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