### **Project Plan: Implement Dynamic Grid**

**Goal:** Refactor the simulation's grid from a fixed-size 2D Array to a sparse, dynamically growing data structure. This will allow for true, unbounded turmite exploration.

**Core Architectural Change:** Replace `grid` (`Array<Array<number>>`) with a `Map<string, number>`.
*   **Key:** A string coordinate, e.g., `"10,-5"`.
*   **Value:** The cell's color index (a `number`).
*   **Benefit:** Only non-background cells are stored, saving memory and allowing for an "infinite" coordinate system.

---

### **Part 1: Step-by-Step Implementation Plan**

We will modify `script.js` in a logical order, refactoring each part of the code that interacts with the grid.

**Step 1: Update Global Variables and Grid Initialization**

1.  In the global scope of `script.js`, find the `grid` variable.
2.  Introduce a `defaultColor` constant. The map will only store cells that are *not* this color.
3.  Change `initGrid` to simply clear the map. We'll rename it to be more accurate.

```javascript
// C:/Users/thewa/Documents/GitHub/turmites/script.js

// ... (near top)
let grid; // Keep the declaration
const defaultColor = 0; // The color of an empty, unvisited cell (usually black)
// ...

// FIND this function:
function initGrid() { /* ... old content ... */ }

// REPLACE with this:
function resetGrid() {
    grid = new Map(); // The grid is now a Map
    console.log(`Initialized new dynamic grid (Map).`);
}

// In initSimulation(), change the call from initGrid() to resetGrid().
function initSimulation(...) {
    // ...
    // initGrid(); // old
    resetGrid(); // new
    // ...
}
```

**Step 2: Create Grid Accessor Functions (Abstraction is Key)**

To make the refactor clean and safe, we'll create two helper functions to handle all reads and writes to our new `Map`-based grid. Add these near your other helper functions.

```javascript
// C:/Users/thewa/Documents/GitHub/turmites/script.js

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
```

**Step 3: Refactor the Core Simulation Logic (`stepSingleAntLogic`)**

This is the most critical change.

1.  Remove the grid boundary wraparound logic.
2.  Use our new accessor functions to read and write cell colors.

```javascript
// C:/Users/thewa/Documents/GitHub/turmites/script.js

function stepSingleAntLogic(ant) {
    if (!grid || !ant || ant.state === -1) return;

    // REMOVE THIS WRAPAROUND LOGIC. The grid is now infinite.
    // ant.x = (ant.x + gridCols) % gridCols;
    // ant.y = (ant.y + gridRows) % gridRows;

    // REMOVE THIS BOUNDARY CHECK.
    // if (!grid[ant.y] || ... ) { /* ... */ }

    const currentCellX = ant.x;
    const currentCellY = ant.y;
    // USE the new getter function.
    const currentCellColor = getGridColor(currentCellX, currentCellY);
    const currentState = ant.state;

    // ... (rule lookup logic remains the same) ...
    
    // ...
    if (rule.writeColor !== currentCellColor) {
        // USE the new setter function.
        setGridColor(currentCellY, currentCellX, rule.writeColor); // NOTE: A typo was here in original code (y,x) - should be (x,y)
        // Let's correct it:
        setGridColor(currentCellX, currentCellY, rule.writeColor);
        cellsToUpdate.add(`${currentCellX},${currentCellY}`);
    }
    // ... (rest of the function for ant movement and state change is the same)
}
```
*Self-correction:* The original `setGridColor` call had `y, x`. My new function uses `x, y`. It's good practice to be consistent. I've corrected it to `setGridColor(currentCellX, currentCellY, rule.writeColor)`.

**Step 4: Refactor Rendering (`drawGrid` and `drawUpdates`)**

1.  `drawGrid` no longer has `gridCols`/`gridRows` to loop over. It must iterate over the `Map` and only draw cells that are currently visible on the screen.
2.  `drawUpdates` will require minimal changes because it already works with coordinate strings.

```javascript
// C:/Users/thewa/Documents/GitHub/turmites/script.js

function drawGrid() {
    if (!grid || !ctx) return;
    setCanvasSmoothing(false);

    // Calculate visible bounds (this logic is still useful!)
    const viewX1 = -offsetX / scale;
    const viewY1 = -offsetY / scale;
    const viewX2 = (width - offsetX) / scale;
    const viewY2 = (height - offsetY) / scale;
    const cellSize = 1;

    // NEW: Iterate over the map entries instead of a fixed 2D array
    for (const [coordString, colorIndex] of grid.entries()) {
        const [xStr, yStr] = coordString.split(',');
        const x = parseInt(xStr, 10);
        const y = parseInt(yStr, 10);

        // OPTIONAL but good: A quick check to see if the cell is even close to the viewport
        if (x < viewX1 - 1 || x > viewX2 + 1 || y < viewY1 - 1 || y > viewY2 + 1) {
            continue;
        }

        ctx.fillStyle = cellColors[colorIndex];
        const px = Math.floor(offsetX + x * cellSize * scale);
        const py = Math.floor(offsetY + y * cellSize * scale);
        const pw = Math.ceil(cellSize * scale);
        const ph = Math.ceil(cellSize * scale);

        // This check is now even more important!
        if (px + pw > 0 && px < width && py + ph > 0 && py < height) {
            ctx.fillRect(px, py, pw, ph);
        }
    }

    // --- Draw Ants (this part is unchanged) ---
    setCanvasSmoothing(true);
    for (const ant of ants) {
        if (ant) drawAntShape(ant);
    }
    setCanvasSmoothing(false);
}

// In drawUpdates(), find this line:
// if (isNaN(x) || isNaN(y) || y < 0 || y >= grid.length || x < 0 || x >= grid[y].length) return;
// REPLACE with a simpler check, as grid.length is no longer valid.
if (isNaN(x) || isNaN(y)) return;
// AND use the new getter:
const colorIndex = getGridColor(x, y);
```
**Note on `initAnts`:** The logic for calculating initial `gridCols` and `gridRows` based on window size is still useful for *placing the ants initially*. They provide a virtual box to start in. So, you don't need to remove those calculations from `initSimulation`.

---

### **Part 2: Testing Strategy**

Since there's no formal test framework (like Jest or Mocha), we can create a simple test runner function that can be executed from the browser's developer console. This is a pragmatic way to add verification.

**Action:** Create a new file `tests.js` and link it in `index.html` (or just add this function at the end of `script.js` for simplicity).

```javascript
// Add to the end of script.js or in a new tests.js file

function runTests() {
    console.log("%c--- Running Turmite Tests ---", "color: yellow; font-size: 1.2em;");
    let allTestsPassed = true;

    function assert(condition, message) {
        if (condition) {
            console.log(`%c  ✅ PASS: ${message}`, "color: #8f8");
        } else {
            console.error(`%c  ❌ FAIL: ${message}`, "color: #f88");
            allTestsPassed = false;
        }
    }

    // Test 1: Grid Get/Set Functionality
    console.log("\n-- Testing Grid Accessors --");
    resetGrid(); // Start with a clean grid
    setGridColor(5, 10, 3);
    assert(getGridColor(5, 10) === 3, "Should set and get a color at (5, 10).");
    assert(getGridColor(0, 0) === defaultColor, "Unset cell (0, 0) should return default color.");
    assert(grid.has("5,10"), "Map should have key '5,10'.");
    setGridColor(5, 10, defaultColor); // Set back to default
    assert(getGridColor(5, 10) === defaultColor, "Cell (5, 10) should return default color after reset.");
    assert(!grid.has("5,10"), "Map should NOT have key '5,10' after setting to default.");

    // Test 2: Ant Step Logic (Boundary Crossing)
    console.log("\n-- Testing Ant Step at Boundary --");
    resetGrid();
    // A simple rule: always move Left ('<') and write color 1
    rules = { 0: [{ writeColor: 1, move: '<', nextState: 0 }] };
    const testAnt = { x: 0, y: 0, dir: 3, state: 0 }; // Start at origin, facing Left
    
    stepSingleAntLogic(testAnt); // Perform one step
    
    assert(testAnt.x === -1, "Ant should move to x = -1 (not wrap).");
    assert(testAnt.y === 0, "Ant y-position should remain 0.");
    assert(getGridColor(0, 0) === 1, "Original cell (0,0) should have been written with color 1.");

    // Test 3: Visual Confirmation (Instructions for the developer)
    console.log("\n-- Visual Test (Manual) --");
    console.log("1. Load the `Langton's Ant` preset.");
    console.log("2. Set ant count to 1, start position to 'Center'.");
    console.log("3. Click 'Apply' and run the simulation.");
    console.log("4. OBSERVE: The ant should build a 'highway' and travel diagonally off-screen indefinitely.");
    console.log("5. It should NOT reappear on the other side of the screen.");

    // Final Result
    console.log("\n--- Test Suite Complete ---");
    if (allTestsPassed) {
        console.log("%c🎉 All automated tests passed!", "color: lightgreen; font-weight: bold;");
    } else {
        console.error("%c🔥 Some automated tests failed. Please review logs.", "color: red; font-weight: bold;");
    }
}
```

### **Putting It All Together for the Pull Request**

1.  Follow the Fork > Clone > Branch workflow.
2.  Implement the code changes from Part 1.
3.  Add the testing code from Part 2.
4.  Open the developer console in your browser and run `runTests()` to verify your work.
5.  When you submit the Pull Request, include a summary of your changes and the test plan in the description. This shows the author you've been thoughtful and thorough.

**Example PR Description:**

> **Feat: Implement Dynamic Grid for Unbounded Simulation**
>
> Hi! This PR refactors the core grid data structure from a fixed-size 2D Array to a `Map`.
>
> **Changes:**
> -   The `grid` is now a `Map("x,y" => color)` which allows it to grow dynamically.
> -   Removed grid boundary wraparound logic, enabling turmites to explore an "infinite" space.
> -   Added `getGridColor()` and `setGridColor()` helpers for clean and safe grid access.
> -   Updated rendering logic (`drawGrid`) to iterate over the sparse map, only drawing visible cells.
>
> **Testing:**
> I've included a `runTests()` function (in `tests.js`/`script.js`) that can be executed from the console to verify the new mechanics. It includes automated checks for:
> 1.  Correct get/set behavior on the map.
> 2.  Correct ant movement across the `x=0` boundary without wrapping.
>
> A visual test with Langton's Ant confirms that the highway pattern now correctly extends off-screen.