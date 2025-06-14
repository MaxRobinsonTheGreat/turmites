/**
 * Main Application Controller
 * Coordinates all modules and manages the overall application state
 */

// Application state
let ants = [];
let rules = {};
let gridCols = 0, gridRows = 0; // Used for initial ant placement and camera reset

/**
 * Initializes ants with various placement strategies
 * @param {number} antCount Number of ants to create
 * @param {string} startMode Placement mode ('center', 'random', 'grid', 'row')
 * @param {string} startDirMode Direction mode ('0'-'3', 'random')
 * @param {boolean} useIndividualRules Whether to use individual rules per ant
 * @param {Array} preservedRules Existing individual rules to preserve
 * @returns {Array} Array of created ants
 */
function initAnts(antCount, startMode, startDirMode, useIndividualRules, preservedRules = null) {
    const newAnts = [];
    clearPendingUpdates();
    
    if (gridCols <= 0 || gridRows <= 0) {
        // Set default grid dimensions for ant placement
        const canvasDims = getCanvasDimensions();
        const cameraState = getCameraState();
        gridCols = Math.ceil(canvasDims.width / cameraState.scale);
        gridRows = Math.ceil(canvasDims.height / cameraState.scale);
    }

    const centerX = Math.floor(gridCols / 2);
    const centerY = Math.floor(gridRows / 2);
    const occupied = new Set();

    console.log(`Initializing ${antCount} ants. Mode: ${startMode}, Dir: ${startDirMode}, Individual Rules: ${useIndividualRules}`);

    for (let i = 0; i < antCount; i++) {
        let gridX, gridY;
        let attempts = 0;
        const MAX_ATTEMPTS = 2000;

        // Determine position based on start mode
        switch (startMode) {
            case 'random':
                do {
                    gridX = Math.floor(Math.random() * gridCols);
                    gridY = Math.floor(Math.random() * gridRows);
                    attempts++;
                } while (occupied.has(`${gridX},${gridY}`) && attempts < MAX_ATTEMPTS);
                break;

            case 'grid':
                const gridRatio = gridCols / gridRows;
                let cols = Math.ceil(Math.sqrt(antCount * gridRatio));
                let rows = Math.ceil(antCount / cols);
                cols = Math.min(cols, gridCols);
                rows = Math.min(rows, gridRows);
                
                const spacingX = gridCols / (cols + 1);
                const spacingY = gridRows / (rows + 1);
                const colIndex = i % cols;
                const rowIndex = Math.floor(i / cols);
                
                gridX = Math.floor(spacingX * (colIndex + 1));
                gridY = Math.floor(spacingY * (rowIndex + 1));
                gridX = Math.max(0, Math.min(gridCols - 1, gridX));
                gridY = Math.max(0, Math.min(gridRows - 1, gridY));
                break;

            case 'row':
                const rowWidth = Math.min(antCount, gridCols);
                const numRows = Math.ceil(antCount / gridCols);
                const startX = Math.floor(centerX - rowWidth / 2);
                const startY = Math.floor(centerY - numRows / 2);
                
                gridX = startX + (i % gridCols);
                gridY = startY + Math.floor(i / gridCols);
                break;

            case 'center':
            default:
                const clusterSize = Math.ceil(Math.sqrt(antCount));
                const offset = Math.floor(clusterSize / 2);
                gridX = centerX - offset + (i % clusterSize);
                gridY = centerY - offset + Math.floor(i / clusterSize);
                break;
        }

        // Ensure within bounds
        gridX = Math.max(0, Math.min(gridCols - 1, gridX || 0));
        gridY = Math.max(0, Math.min(gridRows - 1, gridY || 0));
        occupied.add(`${gridX},${gridY}`);

        // Determine initial direction
        let initialDir = 0;
        if (startDirMode === 'random') {
            initialDir = Math.floor(Math.random() * 4);
        } else {
            const dirValue = parseInt(startDirMode, 10);
            if (!isNaN(dirValue) && dirValue >= 0 && dirValue < 4) {
                initialDir = dirValue;
            }
        }

        // Set up individual rules if needed
        let individualRule = null;
        if (useIndividualRules) {
            if (preservedRules && i < preservedRules.length && preservedRules[i]) {
                individualRule = preservedRules[i];
            } else {
                // Generate random individual rules
                const maxStates = Math.floor(Math.random() * 5) + 1;
                const maxColors = Math.floor(Math.random() * 10) + 2;
                individualRule = generateRandomRulesForAnt(maxStates, maxColors);
            }
        }

        const newAnt = createAnt(gridX, gridY, initialDir, 0, individualRule);
        newAnts.push(newAnt);
        markCellForUpdate(gridX, gridY);
    }

    return newAnts;
}

/**
 * Initializes the complete simulation
 * @param {boolean} randomize Whether to randomize rules
 * @param {number} numStates Number of states for random rules
 * @param {number} numColorsToUse Number of colors for random rules
 * @param {boolean} wasRunning Previous running state
 */
function initSimulation(randomize = false, numStates = 1, numColorsToUse = 2, wasRunning = true) {
    console.log(`initSimulation called. Randomize: ${randomize}, States: ${numStates}, Colors: ${numColorsToUse}, WasRunning: ${wasRunning}`);
    
    // Stop any running loops
    stopSimulationLoop();
    stopRenderLoop();

    const elements = getUIElements();
    const antCount = parseInt(elements.antCountInput?.value || '1', 10);
    const startMode = elements.startPositionSelect?.value || 'center';
    const startDirMode = elements.startDirectionSelect?.value || '0';
    const useIndividual = elements.individualRulesCheck?.checked && antCount > 1;

    // Preserve individual rules if not randomizing
    let preservedRules = null;
    if (!randomize && useIndividual && ants.length > 0) {
        preservedRules = ants.map(ant => ant?.individualRule).filter(rule => rule);
        console.log(`Preserving ${preservedRules.length} individual rules.`);
    }

    // Generate or use existing rules
    if (randomize) {
        rules = generateRandomRules(numStates, numColorsToUse);
    } else if (Object.keys(rules).length === 0) {
        console.log("Generating default Langton's Ant rules.");
        rules = createLangtonsAntRules();
    }

    // Initialize canvas and camera
    if (!initCanvas()) {
        console.error("Failed to initialize canvas!");
        return;
    }

    // Reset grid and ants
    initGrid();
    ants = initAnts(antCount, startMode, startDirMode, useIndividual, preservedRules);

    // Update UI
    updateUI();
    setRunning(wasRunning);
    updateButtonText(wasRunning);

    // Store current state for discard functionality
    storeCurrentState();

    // Start loops if running
    if (wasRunning) {
        const cameraState = getCameraState();
        startSimulationLoop(ants, rules);
        startRenderLoop(ants, cameraState.scale, cameraState.offsetX, cameraState.offsetY);
    }

    // Initial draw
    triggerFullRedraw();
    const cameraState = getCameraState();
    draw(ants, cameraState.scale, cameraState.offsetX, cameraState.offsetY);
}

/**
 * Updates the UI with current rules and state
 */
function updateUI() {
    const elements = getUIElements();
    if (!elements.rulesDisplay) return;

    const formattedRules = formatRulesForDisplay(rules);
    elements.rulesDisplay.textContent = formattedRules;

    // Update speed display
    if (elements.simSpeedSlider && elements.simSpeedValueSpan) {
        const sliderValue = parseInt(elements.simSpeedSlider.value, 10);
        const speed = mapSliderToSpeed(sliderValue);
        elements.simSpeedValueSpan.textContent = Math.round(speed);
    }

    // Disable apply/discard buttons
    if (elements.applyBtn) elements.applyBtn.disabled = true;
    if (elements.discardBtn) elements.discardBtn.disabled = true;
}

/**
 * Stores current application state for discard functionality
 */
function storeCurrentState() {
    const elements = getUIElements();
    const state = {
        antCount: elements.antCountInput?.value || '1',
        startPosition: elements.startPositionSelect?.value || 'center',
        startDirection: elements.startDirectionSelect?.value || '0',
        individualChecked: elements.individualRulesCheck?.checked || false,
        rulesText: elements.rulesDisplay?.textContent || ''
    };
    storeLastAppliedState(state);
}

/**
 * Main application initialization
 */
function initApp() {
    console.log("Initializing Turmite Application...");

    // Initialize canvas and modules
    if (!initCanvas()) {
        console.error("Failed to initialize canvas!");
        return;
    }

    initCamera();
    initGrid();

    // Set up UI event handlers
    const uiCallbacks = {
        onStartStop: () => {
            const isCurrentlyRunning = getRunning();
            if (isCurrentlyRunning) {
                console.log("Pause button clicked");
                setRunning(false);
                stopSimulationLoop();
                stopRenderLoop();
            } else {
                console.log("Start button clicked");
                setRunning(true);
                const cameraState = getCameraState();
                startSimulationLoop(ants, rules);
                startRenderLoop(ants, cameraState.scale, cameraState.offsetX, cameraState.offsetY);
            }
            updateButtonText(getRunning());
        },

        onReset: () => {
            const currentState = getRunning();
            initSimulation(false, undefined, undefined, currentState);
        },

        onRandomize: () => {
            const currentState = getRunning();
            const maxStates = Math.floor(Math.random() * 5) + 1;
            const maxColors = Math.floor(Math.random() * 10) + 2;
            initSimulation(true, maxStates, maxColors, currentState);
        },

        onApply: () => {
            console.log("Applying changes...");
            const elements = getUIElements();
            
            // Parse and validate rules
            if (elements.rulesDisplay) {
                const parsedRules = parseRulesFromText(elements.rulesDisplay.textContent);
                if (parsedRules) {
                    rules = parsedRules;
                } else {
                    alert("Error parsing rules. Please check the rule format.");
                    return;
                }
            }

            const currentState = getRunning();
            initSimulation(false, undefined, undefined, currentState);
        },

        onDiscard: () => {
            console.log("Discarding changes...");
            const lastState = getLastAppliedState();
            const elements = getUIElements();
            
            if (elements.antCountInput) elements.antCountInput.value = lastState.antCount;
            if (elements.startPositionSelect) elements.startPositionSelect.value = lastState.startPosition;
            if (elements.startDirectionSelect) elements.startDirectionSelect.value = lastState.startDirection;
            if (elements.individualRulesCheck) elements.individualRulesCheck.checked = lastState.individualChecked;
            if (elements.rulesDisplay) elements.rulesDisplay.textContent = lastState.rulesText;
            
            if (elements.applyBtn) elements.applyBtn.disabled = true;
            if (elements.discardBtn) elements.discardBtn.disabled = true;
        },

        onResetView: () => {
            resetCamera();
            const cameraState = getCameraState();
            if (!getRunning()) {
                draw(ants, cameraState.scale, cameraState.offsetX, cameraState.offsetY);
            }
        },

        onMinimize: () => {
            const controlPanel = document.getElementById('controlPanel');
            if (controlPanel) controlPanel.classList.add('minimized');
        },

        onMaximize: () => {
            const controlPanel = document.getElementById('controlPanel');
            if (controlPanel) controlPanel.classList.remove('minimized');
        }
    };

    // Set up UI controls
    if (!setupUIControls(uiCallbacks)) {
        console.error("Failed to setup UI controls!");
        return;
    }

    // Set up camera controls
    const canvas = document.getElementById('antCanvas');
    setupCameraControls(canvas);

    // Set up window resize handler
    window.addEventListener('resize', () => {
        resizeCanvas();
        const cameraState = getCameraState();
        if (!getRunning()) {
            draw(ants, cameraState.scale, cameraState.offsetX, cameraState.offsetY);
        }
    });

    // Load presets into dropdown
    loadPresetsIntoDropdown();

    // Initialize simulation
    initSimulation(false, undefined, undefined, true);

    console.log("Turmite Application initialized successfully!");
}

/**
 * Loads preset definitions into the dropdown
 */
function loadPresetsIntoDropdown() {
    const presetSelect = document.getElementById('presetSelect');
    if (!presetSelect || typeof presetDefinitions === 'undefined') {
        console.warn("Preset select or definitions not found.");
        return;
    }

    presetSelect.innerHTML = '';

    // Add preset options
    for (const key in presetDefinitions) {
        if (presetDefinitions.hasOwnProperty(key)) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = presetDefinitions[key].name;
            presetSelect.appendChild(option);
        }
    }

    // Add custom option
    const customOption = document.createElement('option');
    customOption.value = 'custom';
    customOption.textContent = 'Custom';
    presetSelect.appendChild(customOption);

    // Load first preset by default
    if (presetSelect.options.length > 1) {
        presetSelect.value = presetSelect.options[0].value;
        loadPresetRule(presetSelect.value);
    }
}

/**
 * Loads a preset rule into the editor
 * @param {string} presetValue Preset key to load
 */
function loadPresetRule(presetValue) {
    if (presetValue === 'custom' || typeof presetDefinitions === 'undefined') return;

    const selectedPreset = presetDefinitions[presetValue];
    if (!selectedPreset) return;

    const elements = getUIElements();
    if (!elements.rulesDisplay) return;

    const formattedRules = formatRulesForDisplay(selectedPreset.rules, selectedPreset.name);
    elements.rulesDisplay.textContent = formattedRules;

    if (elements.applyBtn) elements.applyBtn.disabled = false;
    if (elements.discardBtn) elements.discardBtn.disabled = false;
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);

// Export main functions for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initAnts,
        initSimulation,
        initApp,
        loadPresetsIntoDropdown,
        loadPresetRule
    };
}