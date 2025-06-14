/**
 * UI Controls and Event Handlers
 * Manages all user interface interactions and control logic
 */

// UI state variables
let lastAppliedState = {};

/**
 * Updates visibility of individual rules controls based on ant count
 * @param {number} antCount Number of ants
 * @param {HTMLElement} rulesDisplayContainer Rules display container
 * @param {HTMLElement} individualRulesContainer Individual rules container
 * @param {HTMLElement} individualRulesCheck Individual rules checkbox
 * @param {HTMLElement} rulesDisplayPre Rules display pre element
 */
function updateIndividualRulesVisibility(antCount, rulesDisplayContainer, individualRulesContainer, individualRulesCheck, rulesDisplayPre) {
    const showIndividualOption = antCount > 1;

    // Show/Hide the individual rules checkbox container
    if (individualRulesContainer) {
        individualRulesContainer.classList.toggle('hidden', !showIndividualOption);
    }

    // Enable/Disable and Uncheck the checkbox if ant count is 1
    let isIndividualChecked = false;
    if (individualRulesCheck) {
        individualRulesCheck.disabled = !showIndividualOption;
        if (!showIndividualOption && individualRulesCheck.checked) {
            individualRulesCheck.checked = false;
            // Enable Apply button if disabling checkbox
            const applyBtn = document.getElementById('applyBtn');
            if (applyBtn) applyBtn.disabled = false; 
        }
        isIndividualChecked = individualRulesCheck.checked;
    }

    // Show/Hide the entire rule section container based on checkbox state
    if (rulesDisplayContainer) {
        rulesDisplayContainer.classList.toggle('hidden', isIndividualChecked);
    }

    // If individual rules is ON, hide the rule editor
    if (rulesDisplayPre && isIndividualChecked) {
        rulesDisplayPre.classList.add('hidden');
    }
}

/**
 * Marks changes as pending and enables apply/discard buttons
 * @param {HTMLElement} applyBtn Apply button
 * @param {HTMLElement} discardBtn Discard button
 * @param {HTMLElement} presetSelect Preset select
 */
function markChangesPending(applyBtn, discardBtn, presetSelect) {
    if (applyBtn) applyBtn.disabled = false;
    if (discardBtn) discardBtn.disabled = false;
    if (presetSelect) presetSelect.value = 'custom';
}

/**
 * Updates the start/stop button text
 * @param {boolean} isRunning Whether simulation is running
 */
function updateButtonText(isRunning) {
    const btn = document.getElementById('startStopBtn');
    if (btn) btn.innerHTML = isRunning ? '❚❚' : '▶';
}

/**
 * Stores the current application state for potential discard
 * @param {Object} state State object to store
 */
function storeLastAppliedState(state) {
    lastAppliedState = { ...state };
}

/**
 * Gets the last applied state
 * @returns {Object} Last applied state
 */
function getLastAppliedState() {
    return { ...lastAppliedState };
}

/**
 * Sets up all UI event listeners
 * @param {Object} callbacks Object containing callback functions
 */
function setupUIControls(callbacks) {
    const {
        onStartStop,
        onReset,
        onRandomize,
        onApply,
        onDiscard,
        onSpeedChange,
        onAntCountChange,
        onRulesChange,
        onIndividualRulesChange,
        onStartPositionChange,
        onStartDirectionChange,
        onPresetChange,
        onEditRule,
        onSaveRule,
        onLoadRule,
        onMinimize,
        onMaximize,
        onResetView
    } = callbacks;

    // Get all UI elements
    const elements = getUIElements();
    if (!elements.allFound) {
        console.error("Some UI elements not found! Cannot setup controls.");
        return false;
    }

    const {
        startStopBtn, resetBtn, randomizeBtn, applyBtn, discardBtn,
        simSpeedSlider, simSpeedValueSpan, antCountInput, rulesDisplay,
        individualRulesCheck, startPositionSelect, startDirectionSelect,
        presetSelect, editRuleBtn, saveRuleBtn, loadRuleBtn,
        minimizeBtn, maximizeBtn, resetViewBtn,
        rulesDisplayContainer, individualRulesContainer, rulesDisplayPre
    } = elements;

    // Start/Stop button
    startStopBtn.addEventListener('click', onStartStop);

    // Reset button
    resetBtn.addEventListener('click', onReset);

    // Randomize button
    randomizeBtn.addEventListener('click', onRandomize);

    // Apply button
    applyBtn.addEventListener('click', onApply);

    // Discard button
    discardBtn.addEventListener('click', onDiscard);

    // Speed slider
    simSpeedSlider.addEventListener('input', () => {
        const sliderValue = parseInt(simSpeedSlider.value, 10);
        const newSpeed = mapSliderToSpeed ? mapSliderToSpeed(sliderValue) : sliderValue;
        simSpeedValueSpan.textContent = Math.round(newSpeed);
        if (onSpeedChange) onSpeedChange(sliderValue);
    });

    // Ant count input
    antCountInput.addEventListener('input', () => {
        const currentVal = parseInt(antCountInput.value, 10);
        const minVal = parseInt(antCountInput.min, 10);
        const maxVal = 1024;
        if (!isNaN(currentVal)) {
            if (currentVal < minVal) antCountInput.value = minVal;
            else if (currentVal > maxVal) antCountInput.value = maxVal;
        }
        const currentCount = parseInt(antCountInput.value, 10) || 0;
        updateIndividualRulesVisibility(currentCount, rulesDisplayContainer, individualRulesContainer, individualRulesCheck, rulesDisplayPre);
        markChangesPending(applyBtn, discardBtn, presetSelect);
        if (onAntCountChange) onAntCountChange(currentCount);
    });

    // Rules display
    rulesDisplay.addEventListener('input', () => {
        markChangesPending(applyBtn, discardBtn, presetSelect);
        if (onRulesChange) onRulesChange(rulesDisplay.textContent);
    });

    // Individual rules checkbox
    individualRulesCheck.addEventListener('change', () => {
        updateIndividualRulesVisibility(
            parseInt(antCountInput.value, 10) || 0,
            rulesDisplayContainer,
            individualRulesContainer,
            individualRulesCheck,
            rulesDisplayPre
        );
        markChangesPending(applyBtn, discardBtn, presetSelect);
        if (onIndividualRulesChange) onIndividualRulesChange(individualRulesCheck.checked);
    });

    // Start position select
    startPositionSelect.addEventListener('input', () => {
        markChangesPending(applyBtn, discardBtn, presetSelect);
        if (onStartPositionChange) onStartPositionChange(startPositionSelect.value);
    });

    // Start direction select
    startDirectionSelect.addEventListener('input', () => {
        markChangesPending(applyBtn, discardBtn, presetSelect);
        if (onStartDirectionChange) onStartDirectionChange(startDirectionSelect.value);
    });

    // Preset select
    presetSelect.addEventListener('change', () => {
        if (onPresetChange) onPresetChange(presetSelect.value);
    });

    // Edit rule button
    editRuleBtn.addEventListener('click', () => {
        if (onEditRule) onEditRule();
    });

    // Save rule button
    saveRuleBtn.addEventListener('click', () => {
        if (onSaveRule) onSaveRule();
    });

    // Load rule button
    loadRuleBtn.addEventListener('click', () => {
        if (onLoadRule) onLoadRule();
    });

    // Panel controls
    minimizeBtn.addEventListener('click', () => {
        if (onMinimize) onMinimize();
    });

    maximizeBtn.addEventListener('click', () => {
        if (onMaximize) onMaximize();
    });

    // Reset view button
    resetViewBtn.addEventListener('click', () => {
        if (onResetView) onResetView();
    });

    // Keyboard shortcuts
    setupKeyboardShortcuts(onStartStop, onReset, onRandomize);

    // Initial state setup
    updateIndividualRulesVisibility(
        parseInt(antCountInput.value, 10) || 0,
        rulesDisplayContainer,
        individualRulesContainer,
        individualRulesCheck,
        rulesDisplayPre
    );

    return true;
}

/**
 * Gets all UI elements with validation
 * @returns {Object} Object containing all UI elements and validation status
 */
function getUIElements() {
    const elements = {
        startStopBtn: document.getElementById('startStopBtn'),
        resetBtn: document.getElementById('resetBtn'),
        randomizeBtn: document.getElementById('randomizeBtn'),
        applyBtn: document.getElementById('applyBtn'),
        discardBtn: document.getElementById('discardBtn'),
        simSpeedSlider: document.getElementById('simSpeedSlider'),
        simSpeedValueSpan: document.getElementById('simSpeedValue'),
        antCountInput: document.getElementById('antCountInput'),
        rulesDisplay: document.getElementById('rulesDisplay'),
        individualRulesCheck: document.getElementById('individualRulesCheck'),
        startPositionSelect: document.getElementById('startPositionSelect'),
        startDirectionSelect: document.getElementById('startDirectionSelect'),
        presetSelect: document.getElementById('presetSelect'),
        editRuleBtn: document.getElementById('editRuleBtn'),
        saveRuleBtn: document.getElementById('saveRuleBtn'),
        loadRuleBtn: document.getElementById('loadRuleBtn'),
        minimizeBtn: document.getElementById('minimizeBtn'),
        maximizeBtn: document.getElementById('maximizeBtn'),
        resetViewBtn: document.getElementById('resetViewBtn'),
        rulesDisplayContainer: document.getElementById('rulesDisplay')?.parentNode,
        individualRulesContainer: document.querySelector('.individual-rules-container'),
        rulesDisplayPre: document.getElementById('rulesDisplay')
    };

    // Check if all elements were found
    const allFound = Object.values(elements).every(element => element !== null);
    elements.allFound = allFound;

    return elements;
}

/**
 * Sets up keyboard shortcuts
 * @param {Function} onStartStop Start/stop callback
 * @param {Function} onReset Reset callback
 * @param {Function} onRandomize Randomize callback
 */
function setupKeyboardShortcuts(onStartStop, onReset, onRandomize) {
    window.addEventListener('keydown', (event) => {
        // Ignore keys if user is typing in the rules editor
        if (event.target === document.getElementById('rulesDisplay')) {
            return;
        }

        // Check for Space bar (Start/Stop)
        if (event.code === 'Space') {
            event.preventDefault();
            if (onStartStop) onStartStop();
        }
        // Check for 'F' key (Randomize)
        else if (event.key === 'f' || event.key === 'F') {
            if (onRandomize) onRandomize();
        }
        // Check for 'R' key (Reset)
        else if (event.key === 'r' || event.key === 'R') {
            if (onReset) onReset();
        }
    });
}

// Export functions for module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        updateIndividualRulesVisibility,
        markChangesPending,
        updateButtonText,
        storeLastAppliedState,
        getLastAppliedState,
        setupUIControls,
        getUIElements,
        setupKeyboardShortcuts
    };
}