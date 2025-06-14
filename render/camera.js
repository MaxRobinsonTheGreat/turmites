/**
 * Camera Controls - Zoom, Pan, and View Management
 * Handles all camera transformations and user interactions
 */

// View transformation state
const initialScale = 8;
let scale = initialScale;
let offsetX = 0;
let offsetY = 0;
let lastMouseX = 0;
let lastMouseY = 0;
let isDragging = false;

// Zoom constraints
const minScale = 0.1;
const maxScale = 50;
const zoomFactor = 1.1;

/**
 * Initializes camera with default values
 */
function initCamera() {
    scale = initialScale;
    offsetX = 0;
    offsetY = 0;
    isDragging = false;
}

/**
 * Resets camera to initial position and scale
 */
function resetCamera() {
    console.log("Resetting camera view to center initial grid...");
    scale = initialScale;

    // Get canvas dimensions
    const canvasDims = getCanvasDimensions ? getCanvasDimensions() : { width: window.innerWidth, height: window.innerHeight };
    const { width, height } = canvasDims;

    // Calculate hypothetical grid dimensions based on initial scale
    const tempGridCols = Math.ceil(width / scale); 
    const tempGridRows = Math.ceil(height / scale);

    // Calculate the center of this hypothetical grid (in logical coordinates)
    const tempGridCenterX = tempGridCols / 2;
    const tempGridCenterY = tempGridRows / 2;

    // Calculate offset needed to place the grid center (scaled) at the viewport center
    offsetX = width / 2 - tempGridCenterX * scale;
    offsetY = height / 2 - tempGridCenterY * scale;

    console.log(`Reset Camera: Scale=${scale}, OffsetX=${offsetX.toFixed(1)}, OffsetY=${offsetY.toFixed(1)} based on grid ${tempGridCols}x${tempGridRows}`);

    // Trigger full redraw
    if (typeof triggerFullRedraw === 'function') {
        triggerFullRedraw();
    }
    if (typeof clearPendingUpdates === 'function') {
        clearPendingUpdates();
    }
}

/**
 * Handles zoom events
 * @param {WheelEvent} event The wheel event
 * @param {HTMLCanvasElement} canvas The canvas element
 */
function handleZoom(event, canvas) {
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

    if (typeof setCanvasSmoothing === 'function') {
        setCanvasSmoothing(false);
    }
    if (typeof triggerFullRedraw === 'function') {
        triggerFullRedraw();
    }
}

/**
 * Handles mouse down events for panning
 * @param {MouseEvent} event The mouse event
 * @param {HTMLCanvasElement} canvas The canvas element
 */
function handleMouseDown(event, canvas) {
    isDragging = true;
    const rect = canvas.getBoundingClientRect();
    lastMouseX = event.clientX - rect.left;
    lastMouseY = event.clientY - rect.top;
    canvas.style.cursor = 'grabbing';
}

/**
 * Handles mouse up events for panning
 * @param {MouseEvent} event The mouse event
 * @param {HTMLCanvasElement} canvas The canvas element
 */
function handleMouseUp(event, canvas) {
    if (isDragging) {
        isDragging = false;
        canvas.style.cursor = 'grab';
    }
}

/**
 * Handles mouse move events for panning
 * @param {MouseEvent} event The mouse event
 * @param {HTMLCanvasElement} canvas The canvas element
 */
function handleMouseMove(event, canvas) {
    if (!isDragging) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    offsetX += mouseX - lastMouseX;
    offsetY += mouseY - lastMouseY;

    lastMouseX = mouseX;
    lastMouseY = mouseY;

    if (typeof triggerFullRedraw === 'function') {
        triggerFullRedraw();
    }
}

/**
 * Handles mouse leave events for panning
 * @param {MouseEvent} event The mouse event
 * @param {HTMLCanvasElement} canvas The canvas element
 */
function handleMouseLeave(event, canvas) {
    if (isDragging) {
        isDragging = false;
        canvas.style.cursor = 'grab';
    }
}

/**
 * Sets up all camera event listeners on a canvas
 * @param {HTMLCanvasElement} canvas The canvas element
 */
function setupCameraControls(canvas) {
    if (!canvas) {
        console.error("Canvas element not found for camera controls!");
        return;
    }

    canvas.addEventListener('wheel', (e) => handleZoom(e, canvas));
    canvas.addEventListener('mousedown', (e) => handleMouseDown(e, canvas));
    canvas.addEventListener('mouseup', (e) => handleMouseUp(e, canvas));
    canvas.addEventListener('mousemove', (e) => handleMouseMove(e, canvas));
    canvas.addEventListener('mouseleave', (e) => handleMouseLeave(e, canvas));
    canvas.style.cursor = 'grab';
}

/**
 * Gets current camera state
 * @returns {Object} Object with scale, offsetX, offsetY
 */
function getCameraState() {
    return {
        scale,
        offsetX,
        offsetY,
        isDragging
    };
}

/**
 * Sets camera state
 * @param {Object} state Object with scale, offsetX, offsetY
 */
function setCameraState(state) {
    if (state.scale !== undefined) scale = state.scale;
    if (state.offsetX !== undefined) offsetX = state.offsetX;
    if (state.offsetY !== undefined) offsetY = state.offsetY;
    if (state.isDragging !== undefined) isDragging = state.isDragging;
}

/**
 * Converts screen coordinates to world coordinates
 * @param {number} screenX Screen X coordinate
 * @param {number} screenY Screen Y coordinate
 * @returns {Object} Object with worldX, worldY
 */
function screenToWorld(screenX, screenY) {
    return {
        worldX: (screenX - offsetX) / scale,
        worldY: (screenY - offsetY) / scale
    };
}

/**
 * Converts world coordinates to screen coordinates
 * @param {number} worldX World X coordinate
 * @param {number} worldY World Y coordinate
 * @returns {Object} Object with screenX, screenY
 */
function worldToScreen(worldX, worldY) {
    return {
        screenX: offsetX + worldX * scale,
        screenY: offsetY + worldY * scale
    };
}

// Export functions for module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initCamera,
        resetCamera,
        handleZoom,
        handleMouseDown,
        handleMouseUp,
        handleMouseMove,
        handleMouseLeave,
        setupCameraControls,
        getCameraState,
        setCameraState,
        screenToWorld,
        worldToScreen,
        initialScale,
        minScale,
        maxScale
    };
}