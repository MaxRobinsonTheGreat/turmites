/**
 * Rule Generation and Management
 * Handles turmite rule creation, validation, and storage
 */

/**
 * Generates random rules with variable states/colors
 * @param {number} numStates Number of states to generate
 * @param {number} numColorsToUse Number of colors to use
 * @param {Object} moveOptions Object containing movement options
 * @returns {Object} Generated rules object
 */
function generateRandomRules(numStates, numColorsToUse, moveOptions = null) {
    const newRules = {};
    
    // Default move options if not provided
    const defaultMoveOptions = {
        useRelative: true,
        useAbsolute: false,
        useRandom: false
    };
    
    const options = moveOptions || defaultMoveOptions;
    
    let moveChoices = ['S']; // 'S' is always available
    if (options.useRelative) {
        moveChoices.push('L', 'R', 'N', 'U');
    }
    if (options.useAbsolute) {
        moveChoices.push('^', '>', 'v', '<');
    }
    if (options.useRandom) {
        moveChoices.push('?');
    }
    
    // Ensure there's at least one move option
    if (moveChoices.length === 0) moveChoices.push('N');

    for (let s = 0; s < numStates; s++) {
        newRules[s] = [];
        for (let c = 0; c < numColorsToUse; c++) {
            const writeColor = Math.floor(Math.random() * numColorsToUse);
            const moveIndex = Math.floor(Math.random() * moveChoices.length);
            const move = moveChoices[moveIndex];
            const nextState = Math.floor(Math.random() * numStates);
            newRules[s].push({ writeColor, move, nextState });
        }
    }
    
    return newRules;
}

/**
 * Generates random rules for a single ant
 * @param {number} numStates Number of states to generate
 * @param {number} numColorsToUse Number of colors to use
 * @param {Object} moveOptions Object containing movement options
 * @returns {Object} Generated rules object for individual ant
 */
function generateRandomRulesForAnt(numStates, numColorsToUse, moveOptions = null) {
    return generateRandomRules(numStates, numColorsToUse, moveOptions);
}

/**
 * Creates Langton's Ant rules
 * @returns {Object} Langton's Ant rules
 */
function createLangtonsAntRules() {
    return {
        0: [
            { writeColor: 1, move: 'R', nextState: 0 },
            { writeColor: 0, move: 'L', nextState: 0 }
        ]
    };
}

/**
 * Validates a rules object
 * @param {Object} rules The rules object to validate
 * @returns {Object} Validation result with isValid and errors
 */
function validateRules(rules) {
    const result = { isValid: true, errors: [] };
    
    if (!rules || typeof rules !== 'object') {
        result.isValid = false;
        result.errors.push('Rules must be an object');
        return result;
    }
    
    const states = Object.keys(rules);
    if (states.length === 0) {
        result.isValid = false;
        result.errors.push('Rules must contain at least one state');
        return result;
    }
    
    for (const stateKey of states) {
        const state = parseInt(stateKey, 10);
        if (isNaN(state) || state < 0) {
            result.isValid = false;
            result.errors.push(`Invalid state key: ${stateKey}`);
            continue;
        }
        
        const stateRules = rules[stateKey];
        if (!Array.isArray(stateRules)) {
            result.isValid = false;
            result.errors.push(`State ${stateKey} rules must be an array`);
            continue;
        }
        
        if (stateRules.length === 0) {
            result.isValid = false;
            result.errors.push(`State ${stateKey} must have at least one rule`);
            continue;
        }
        
        for (let colorIndex = 0; colorIndex < stateRules.length; colorIndex++) {
            const rule = stateRules[colorIndex];
            
            if (!rule || typeof rule !== 'object') {
                result.isValid = false;
                result.errors.push(`State ${stateKey}, color ${colorIndex}: rule must be an object`);
                continue;
            }
            
            // Validate writeColor
            if (typeof rule.writeColor !== 'number' || rule.writeColor < 0) {
                result.isValid = false;
                result.errors.push(`State ${stateKey}, color ${colorIndex}: writeColor must be a non-negative number`);
            }
            
            // Validate move
            const validMoves = ['L', 'R', 'U', 'N', 'S', '^', '>', 'v', '<', '?'];
            if (!rule.move || !validMoves.includes(rule.move)) {
                result.isValid = false;
                result.errors.push(`State ${stateKey}, color ${colorIndex}: move must be one of ${validMoves.join(', ')}`);
            }
            
            // Validate nextState
            if (typeof rule.nextState !== 'number' || rule.nextState < -1) {
                result.isValid = false;
                result.errors.push(`State ${stateKey}, color ${colorIndex}: nextState must be a number >= -1`);
            }
        }
    }
    
    return result;
}

/**
 * Formats rules for display with comments
 * @param {Object} rules The rules object to format
 * @param {string} presetName Optional preset name
 * @returns {string} Formatted rules string
 */
function formatRulesForDisplay(rules, presetName = null) {
    const numStates = Object.keys(rules).length;
    const numColors = rules[0] ? rules[0].length : 0;
    
    let rulesString = '';
    if (presetName) {
        rulesString += `// Preset: ${presetName}\n`;
    }
    rulesString += `// States: ${numStates}\n`;
    rulesString += `// Colors: ${numColors}\n`;
    rulesString += `// Moves: L:Left, R:Right, U:U-Turn, N:No Turn (forward), S:Stay, ^>v<:Absolute Dirs, ?:Random\n\n`;
    
    try {
        rulesString += JSON.stringify(rules, null, 2);
    } catch (e) {
        rulesString += "Error stringifying rules.";
    }
    
    return rulesString;
}

/**
 * Parses rules from a text string (removes comments and parses JSON)
 * @param {string} rulesText The rules text to parse
 * @returns {Object} Parsed rules object or null if invalid
 */
function parseRulesFromText(rulesText) {
    try {
        // Remove comment lines
        const rulesWithoutComments = rulesText.replace(/^\s*\/\/.*$/gm, '').trim();
        
        if (!rulesWithoutComments) {
            return null;
        }
        
        const parsedRules = JSON.parse(rulesWithoutComments);
        
        // Validate the parsed rules
        const validation = validateRules(parsedRules);
        if (!validation.isValid) {
            console.error('Rule validation failed:', validation.errors);
            return null;
        }
        
        return parsedRules;
    } catch (e) {
        console.error('Error parsing rules:', e);
        return null;
    }
}

// Export functions for module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        generateRandomRules,
        generateRandomRulesForAnt,
        createLangtonsAntRules,
        validateRules,
        formatRulesForDisplay,
        parseRulesFromText
    };
}