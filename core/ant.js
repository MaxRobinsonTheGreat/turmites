/**
 * Ant Logic and Simulation Stepping
 * Manages individual ant behavior and movement
 */

// Direction constants
const directions = [
    { dx: 0, dy: -1 }, // North
    { dx: 1, dy: 0 },  // East
    { dx: 0, dy: 1 },  // South
    { dx: -1, dy: 0 }  // West
];

/**
 * Creates a new ant object
 * @param {number} x Initial x position
 * @param {number} y Initial y position
 * @param {number} dir Initial direction (0-3)
 * @param {number} state Initial state
 * @param {Object} individualRule Optional individual rule set
 * @returns {Object} New ant object
 */
function createAnt(x, y, dir = 0, state = 0, individualRule = null) {
    return {
        x: x,
        y: y,
        dir: dir,
        state: state,
        individualRule: individualRule
    };
}

/**
 * Steps a single ant through one simulation step
 * @param {Object} ant The ant to step
 * @param {Object} globalRules Global rule set to use if ant has no individual rules
 */
function stepSingleAntLogic(ant, globalRules) {
    if (!ant || ant.state === -1) return; // HALT state: do nothing further

    const currentCellX = ant.x;
    const currentCellY = ant.y;
    const currentCellColor = getGridColor(currentCellX, currentCellY);
    const currentState = ant.state;

    const ruleSetToUse = ant.individualRule || globalRules;
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
    
    // Record change only if color is different
    if (rule.writeColor !== currentCellColor) {
        setGridColor(currentCellX, currentCellY, rule.writeColor);
        if (typeof cellsToUpdate !== 'undefined') {
            cellsToUpdate.add(`${currentCellX},${currentCellY}`);
        }
    }

    let dx = 0, dy = 0;
    // Determine Direction Change
    switch (rule.move) {
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
    
    // Determine Movement Delta (only if not 'S')
    if (rule.move !== 'S') {
        const moveOffset = directions[ant.dir];
        if (moveOffset) { 
            dx = moveOffset.dx;
            dy = moveOffset.dy;
        } else {
             console.error(`Invalid ant direction: ${ant.dir}`);
        }
    }
    
    // Update state and apply movement
    ant.state = rule.nextState;
    ant.x += dx;
    ant.y += dy;
}

/**
 * Validates an ant object
 * @param {Object} ant The ant to validate
 * @returns {boolean} True if the ant is valid
 */
function isValidAnt(ant) {
    return ant && 
           typeof ant.x === 'number' && 
           typeof ant.y === 'number' && 
           typeof ant.dir === 'number' && 
           typeof ant.state === 'number' &&
           ant.dir >= 0 && ant.dir < 4;
}

/**
 * Gets the direction name for a given direction index
 * @param {number} dir Direction index (0-3)
 * @returns {string} Direction name
 */
function getDirectionName(dir) {
    const names = ['North', 'East', 'South', 'West'];
    return names[dir] || 'Unknown';
}

// Export functions for module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        createAnt,
        stepSingleAntLogic,
        isValidAnt,
        getDirectionName,
        directions
    };
}