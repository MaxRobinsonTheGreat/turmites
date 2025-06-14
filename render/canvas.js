/**
 * Canvas Rendering and Drawing
 * Handles all canvas drawing operations for the turmite simulation
 */

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

// Canvas state variables
let canvas, ctx;
let width, height;
const cellSize = 1; // Logical size of each cell
let cellsToUpdate = new Set(); // Combined set for all redraw locations
let needsFullRedraw = true; // Flag to trigger full grid redraw

/**
 * Initializes the canvas and context
 */
function initCanvas() {
    canvas = document.getElementById('antCanvas');
    if (!canvas) {
        console.error('Canvas element not found!');
        return false;
    }
    
    ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Canvas context not found!');
        return false;
    }
    
    resizeCanvas();
    setCanvasSmoothing(false);
    return true;
}

/**
 * Resizes the canvas to match window size
 */
function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    if (!canvas) return;
    
    canvas.width = width;
    canvas.height = height;
    setCanvasSmoothing(false);
    needsFullRedraw = true; // Flag for full redraw
}

/**
 * Sets canvas image smoothing
 * @param {boolean} enabled Whether to enable smoothing
 */
function setCanvasSmoothing(enabled) {
    if (!ctx) return;
    ctx.imageSmoothingEnabled = enabled;
    ctx.mozImageSmoothingEnabled = enabled;
    ctx.webkitImageSmoothingEnabled = enabled;
    ctx.msImageSmoothingEnabled = enabled;
}

/**
 * Draws an ant shape on the canvas
 * @param {Object} ant The ant to draw
 * @param {number} scale Current scale factor
 * @param {number} offsetX Camera offset X
 * @param {number} offsetY Camera offset Y
 */
function drawAntShape(ant, scale, offsetX, offsetY) {
    if (!ctx || !ant) return;
    
    // Calculate pixel positions
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
    ctx.arc(antCenterX, antCenterY, antRadius, 0, 2 * Math.PI);
    ctx.fill();
}

/**
 * Draws the complete grid
 * @param {number} scale Current scale factor
 * @param {number} offsetX Camera offset X
 * @param {number} offsetY Camera offset Y
 */
function drawGrid(scale, offsetX, offsetY) {
    if (!ctx || typeof getGridEntries !== 'function') return;
    
    setCanvasSmoothing(false);

    // Calculate visible bounds
    const viewX1 = -offsetX / scale;
    const viewY1 = -offsetY / scale;
    const viewX2 = (width - offsetX) / scale;
    const viewY2 = (height - offsetY) / scale;

    // Iterate over the map entries instead of a fixed 2D array
    for (const [coordString, colorIndex] of getGridEntries()) {
        const [xStr, yStr] = coordString.split(',');
        const x = parseInt(xStr, 10);
        const y = parseInt(yStr, 10);

        // Quick check to see if the cell is even close to the viewport
        if (x < viewX1 - 1 || x > viewX2 + 1 || y < viewY1 - 1 || y > viewY2 + 1) {
            continue;
        }

        if (colorIndex >= 0 && colorIndex < cellColors.length) {
            ctx.fillStyle = cellColors[colorIndex];
            const px = Math.floor(offsetX + x * cellSize * scale);
            const py = Math.floor(offsetY + y * cellSize * scale);
            const pw = Math.ceil(cellSize * scale);
            const ph = Math.ceil(cellSize * scale);

            // Visibility check
            if (px + pw > 0 && px < width && py + ph > 0 && py < height) {
                ctx.fillRect(px, py, pw, ph);
            }
        }
    }
}

/**
 * Draws only the updated cells efficiently
 * @param {number} scale Current scale factor
 * @param {number} offsetX Camera offset X
 * @param {number} offsetY Camera offset Y
 */
function drawUpdates(scale, offsetX, offsetY) {
    if (!ctx || typeof getGridColor !== 'function') return;
    
    setCanvasSmoothing(false);

    // Draw all cells marked for update
    cellsToUpdate.forEach(coordString => {
        const [xStr, yStr] = coordString.split(',');
        const x = parseInt(xStr, 10);
        const y = parseInt(yStr, 10);

        // Ensure coordinate is valid
        if (isNaN(x) || isNaN(y)) return;

        const colorIndex = getGridColor(x, y);
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

    // Clear the update set for the next frame
    cellsToUpdate.clear();
}

/**
 * Main draw function that handles full redraws and updates
 * @param {Array} ants Array of ants to draw
 * @param {number} scale Current scale factor
 * @param {number} offsetX Camera offset X
 * @param {number} offsetY Camera offset Y
 */
function draw(ants, scale, offsetX, offsetY) {
    if (!ctx) return;

    if (needsFullRedraw) {
        // Clear background (important for full redraw)
        ctx.fillStyle = '#555555'; 
        ctx.fillRect(0, 0, width, height);
        drawGrid(scale, offsetX, offsetY); // Draw the entire grid
        needsFullRedraw = false; // Reset flag after drawing
    } else {
        drawUpdates(scale, offsetX, offsetY); // Draw only changes
    }

    // Draw ants with smoothing enabled
    setCanvasSmoothing(true);
    for (const ant of ants) {
        if (ant) drawAntShape(ant, scale, offsetX, offsetY);
    }
    setCanvasSmoothing(false);
}

/**
 * Marks cells for update on next draw
 * @param {number} x Cell x coordinate
 * @param {number} y Cell y coordinate
 */
function markCellForUpdate(x, y) {
    cellsToUpdate.add(`${x},${y}`);
}

/**
 * Triggers a full redraw on next draw call
 */
function triggerFullRedraw() {
    needsFullRedraw = true;
}

/**
 * Clears all pending cell updates
 */
function clearPendingUpdates() {
    cellsToUpdate.clear();
}

/**
 * Gets the canvas dimensions
 * @returns {Object} Object with width and height
 */
function getCanvasDimensions() {
    return { width, height };
}

// Export functions for module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initCanvas,
        resizeCanvas,
        setCanvasSmoothing,
        draw,
        drawGrid,
        drawUpdates,
        drawAntShape,
        markCellForUpdate,
        triggerFullRedraw,
        clearPendingUpdates,
        getCanvasDimensions,
        cellColors
    };
}