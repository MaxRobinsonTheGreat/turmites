/**
 * Simulation Engine - Timing and Loop Management
 * Handles simulation timing, speed control, and render loops
 */

// Simulation state
let isRunning = true;
let simulationTimeoutId = null;
let renderRequestId = null;
let nextStepTime = 0;
let pauseTime = 0;

// Speed configuration
const slowModeThreshold = 1000 / 16; // ~62.5 FPS threshold
const minSimSpeed = 1;       // Min Steps/Sec at slider value 1
const midSimSpeed = 60;      // Steps/Sec at slider midpoint (50)
const maxSimSpeed = 100000;  // Max Target Steps/Sec at slider value 100
const maxStepsPerLoopIteration = 100000; // Safety limit

/**
 * Maps slider value to simulation speed
 * @param {number} sliderValue Slider value (1-100)
 * @returns {number} Mapped speed in steps per second
 */
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
        const power = 3; // Adjust power for desired curve
        const normalizedInput = (sliderValue - sliderMid) / (sliderMax - sliderMid);
        const scaledOutput = Math.pow(normalizedInput, power);
        const speed = midSimSpeed + scaledOutput * (maxSimSpeed - midSimSpeed);
        return Math.min(maxSimSpeed, speed); // Clamp at max
    }
}

/**
 * Main simulation loop
 * @param {Array} ants Array of ants to simulate
 * @param {Object} rules Global rules object
 */
function simulationLoop(ants, rules) {
    if (!isRunning) {
        simulationTimeoutId = null;
        return;
    }
    
    const now = performance.now();
    let totalStepsExecutedThisLoop = 0;
    
    // Get current speed from slider
    const slider = document.getElementById('simSpeedSlider');
    const targetSpeed = slider ? parseInt(slider.value, 10) : 50;
    const mappedSpeed = mapSliderToSpeed(targetSpeed);
    const stepDuration = (mappedSpeed > 0) ? 1000 / mappedSpeed : Infinity;

    // Determine how many full simulation ticks should have passed
    while (now >= nextStepTime && totalStepsExecutedThisLoop < maxStepsPerLoopIteration) {
        for (let i = 0; i < ants.length; i++) {
            const ant = ants[i];
            if (!ant) continue;

            // Record current location before stepping
            const prevX = ant.x;
            const prevY = ant.y;
            if (typeof markCellForUpdate === 'function') {
                markCellForUpdate(prevX, prevY);
            }

            // Execute step for this ant
            if (typeof stepSingleAntLogic === 'function') {
                stepSingleAntLogic(ant, rules);
            }

            // Record new location after stepping
            if (typeof markCellForUpdate === 'function') {
                markCellForUpdate(ant.x, ant.y);
            }
        }

        nextStepTime += stepDuration;
        totalStepsExecutedThisLoop += ants.length;
        if (stepDuration <= 0 || !isFinite(stepDuration)) {
            break;
        }
    }

    if (totalStepsExecutedThisLoop >= maxStepsPerLoopIteration) {
        // Reset nextStepTime based on current time to avoid huge future jumps
        nextStepTime = performance.now() + stepDuration;
    }

    const timeToNext = Math.max(0, nextStepTime - performance.now());
    simulationTimeoutId = setTimeout(() => simulationLoop(ants, rules), timeToNext);
}

/**
 * Starts the simulation loop
 * @param {Array} ants Array of ants to simulate
 * @param {Object} rules Global rules object
 */
function startSimulationLoop(ants, rules) {
    if (simulationTimeoutId) return; // Already running

    console.log('Starting/Resuming Simulation Loop...');

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
    simulationTimeoutId = setTimeout(() => simulationLoop(ants, rules), timeToFirstCall);
    console.log(`Scheduled first simulation check in ${timeToFirstCall.toFixed(0)}ms`);
}

/**
 * Stops the simulation loop
 */
function stopSimulationLoop() {
    if (simulationTimeoutId) {
        clearTimeout(simulationTimeoutId);
        simulationTimeoutId = null;
        pauseTime = performance.now(); // Record pause time
        console.log("Simulation Loop stopped.");
    }
}

/**
 * Render loop for drawing
 * @param {Array} ants Array of ants to render
 * @param {number} scale Current camera scale
 * @param {number} offsetX Camera offset X
 * @param {number} offsetY Camera offset Y
 */
function renderLoop(ants, scale, offsetX, offsetY) {
    if (!isRunning) {
        renderRequestId = null; // Ensure ID is cleared
        return; // Don't draw or request next frame
    }
    
    if (typeof draw === 'function') {
        draw(ants, scale, offsetX, offsetY);
    }
    
    renderRequestId = requestAnimationFrame(() => renderLoop(ants, scale, offsetX, offsetY));
}

/**
 * Starts the render loop
 * @param {Array} ants Array of ants to render
 * @param {number} scale Current camera scale
 * @param {number} offsetX Camera offset X
 * @param {number} offsetY Camera offset Y
 */
function startRenderLoop(ants, scale, offsetX, offsetY) {
    if (renderRequestId) return; // Already running
    console.log("Starting Render Loop.");
    renderRequestId = requestAnimationFrame(() => renderLoop(ants, scale, offsetX, offsetY));
}

/**
 * Stops the render loop
 */
function stopRenderLoop() {
    if (renderRequestId) {
        cancelAnimationFrame(renderRequestId);
        renderRequestId = null;
        console.log("Render Loop stopped.");
    }
}

/**
 * Sets the running state
 * @param {boolean} running Whether the simulation should be running
 */
function setRunning(running) {
    isRunning = running;
}

/**
 * Gets the current running state
 * @returns {boolean} Whether the simulation is running
 */
function getRunning() {
    return isRunning;
}

/**
 * Gets simulation state information
 * @returns {Object} Object with timing and state info
 */
function getSimulationState() {
    return {
        isRunning,
        simulationTimeoutId,
        renderRequestId,
        nextStepTime,
        pauseTime
    };
}

/**
 * Calculates simulation delay from target steps per second
 * @param {number} targetStepsPerSec Target steps per second
 * @returns {number} Delay in milliseconds
 */
function calculateSimDelay(targetStepsPerSec) {
    if (targetStepsPerSec <= 0) return 10000; // Avoid division by zero, very slow
    // Calculate delay, clamp between 0 (for max speed) and a reasonable max
    const delay = 1000 / targetStepsPerSec;
    return Math.max(0, Math.min(10000, delay)); // Clamp delay (0ms to 10s)
}

// Export functions for module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        mapSliderToSpeed,
        simulationLoop,
        startSimulationLoop,
        stopSimulationLoop,
        renderLoop,
        startRenderLoop,
        stopRenderLoop,
        setRunning,
        getRunning,
        getSimulationState,
        calculateSimDelay
    };
}