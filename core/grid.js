/**
 * Dynamic Sparse Grid Implementation
 * Manages an infinite 2D grid using a Map for memory efficiency
 */

const defaultColor = 0; // The color of an empty, unvisited cell (usually black)
let grid; // Global grid instance

/**
 * Initializes or resets the grid to an empty state (a new Map).
 */
function initGrid() {
    grid = new Map();
    if (typeof cellsToUpdate !== 'undefined') {
        cellsToUpdate.clear(); // Clear any pending updates
    }
    if (typeof needsFullRedraw !== 'undefined') {
        needsFullRedraw = true; // Ensure a full redraw after grid reset
    }
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

/**
 * Gets the current grid size (number of non-default cells)
 * @returns {number} The number of cells with non-default colors
 */
function getGridSize() {
    return grid.size;
}

/**
 * Gets all non-default cells as an iterator
 * @returns {Iterator} Iterator over [coordString, colorIndex] pairs
 */
function getGridEntries() {
    return grid.entries();
}

/**
 * Checks if a specific coordinate has a non-default color
 * @param {number} x The x-coordinate
 * @param {number} y The y-coordinate
 * @returns {boolean} True if the cell has a non-default color
 */
function hasGridCell(x, y) {
    return grid.has(`${x},${y}`);
}

// Export functions for module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initGrid,
        getGridColor,
        setGridColor,
        getGridSize,
        getGridEntries,
        hasGridCell,
        defaultColor
    };
}