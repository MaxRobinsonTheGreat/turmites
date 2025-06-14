/**
 * Integration Test Suite
 * Comprehensive tests for the turmite simulation system
 */

/**
 * Runs the complete test suite
 */
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

    // Test 1: Grid Accessor Tests
    console.log("\n-- Testing Grid Accessors --");
    initGrid(); // Start with a clean grid
    setGridColor(5, 10, 3);
    assert(getGridColor(5, 10) === 3, "Grid Accessor 1.1: Should set and get a color at (5, 10).");
    assert(getGridColor(0, 0) === defaultColor, "Grid Accessor 1.2: Unset cell (0, 0) should return default color.");
    assert(hasGridCell(5, 10), "Grid Accessor 1.3: Grid should have cell (5, 10).");
    setGridColor(5, 10, defaultColor); // Set back to default
    assert(getGridColor(5, 10) === defaultColor, "Grid Accessor 1.4: Cell (5, 10) should return default color after reset.");
    assert(!hasGridCell(5, 10), "Grid Accessor 1.5: Grid should NOT have cell (5, 10) after setting to default.");

    // Test coordinate edge cases (negative, zero, large numbers)
    setGridColor(-1, -1, 1);
    assert(getGridColor(-1, -1) === 1, "Grid Accessor 1.6: Should set and get color at negative coordinates (-1, -1).");
    setGridColor(100000, 200000, 2);
    assert(getGridColor(100000, 200000) === 2, "Grid Accessor 1.7: Should set and get color at large coordinates.");
    initGrid(); // Clean grid for next test
    assert(getGridColor(-5, -5) === defaultColor, "Grid Accessor 1.8: Unset negative cell should return default color.");
    assert(getGridColor(999999, 999999) === defaultColor, "Grid Accessor 1.9: Unset large coordinate cell should return default color.");

    // Test 2: Ant Creation and Validation Tests
    console.log("\n-- Testing Ant Creation and Validation --");
    const testAnt1 = createAnt(0, 0, 0, 0);
    assert(isValidAnt(testAnt1), "Ant Creation 2.1: Should create a valid ant.");
    assert(testAnt1.x === 0 && testAnt1.y === 0, "Ant Creation 2.2: Ant should have correct position.");
    assert(testAnt1.dir === 0 && testAnt1.state === 0, "Ant Creation 2.3: Ant should have correct direction and state.");

    const invalidAnt = { x: 0, y: 0, dir: -1, state: 0 };
    assert(!isValidAnt(invalidAnt), "Ant Validation 2.4: Should reject ant with invalid direction.");

    // Test 3: Rule Generation and Validation Tests
    console.log("\n-- Testing Rule Generation and Validation --");
    const testRules = generateRandomRules(2, 3);
    const validation = validateRules(testRules);
    assert(validation.isValid, "Rule Generation 3.1: Generated rules should be valid.");
    assert(Object.keys(testRules).length === 2, "Rule Generation 3.2: Should generate correct number of states.");
    assert(testRules[0].length === 3, "Rule Generation 3.3: Should generate correct number of colors per state.");

    const langtonsRules = createLangtonsAntRules();
    const langtonsValidation = validateRules(langtonsRules);
    assert(langtonsValidation.isValid, "Rule Validation 3.4: Langton's rules should be valid.");

    // Test invalid rules
    const invalidRules = { 0: [{ writeColor: -1, move: 'X', nextState: 'invalid' }] };
    const invalidValidation = validateRules(invalidRules);
    assert(!invalidValidation.isValid, "Rule Validation 3.5: Should reject invalid rules.");
    assert(invalidValidation.errors.length > 0, "Rule Validation 3.6: Should provide error messages.");

    // Test 4: Boundary Crossing Tests
    console.log("\n-- Testing Ant Step at Boundary --");
    initGrid();
    // Test ant movement in all 4 directions past coordinate (0,0)
    const testRules1 = { 0: [{ writeColor: 1, move: '^', nextState: 0 }] }; // Absolute North
    let ant1 = createAnt(0, 0, 0, 0);
    stepSingleAntLogic(ant1, testRules1);
    assert(ant1.x === 0 && ant1.y === -1, "Boundary Crossing 4.1: Ant should move North to (0, -1).");
    assert(getGridColor(0, 0) === 1, "Boundary Crossing 4.2: (0,0) should be color 1 after ant1 moves.");

    initGrid();
    const testRules2 = { 0: [{ writeColor: 1, move: '>', nextState: 0 }] }; // Absolute East
    let ant2 = createAnt(0, 0, 1, 0);
    stepSingleAntLogic(ant2, testRules2);
    assert(ant2.x === 1 && ant2.y === 0, "Boundary Crossing 4.3: Ant should move East to (1, 0).");

    // Test 5: Simulation Logic Tests
    console.log("\n-- Testing Simulation Logic --");
    initGrid();
    // Test Langton's Ant rule (R, L)
    const langtonsTestRules = { 0: [{ writeColor: 1, move: 'R', nextState: 0 }, { writeColor: 0, move: 'L', nextState: 0 }] };
    let langtonAnt = createAnt(0, 0, 0, 0); // Start North

    // Step 1: At (0,0), color 0 (default), rule is {write:1, move:R, nextState:0}
    stepSingleAntLogic(langtonAnt, langtonsTestRules);
    assert(getGridColor(0, 0) === 1, "Simulation Logic 5.1: Langton Ant - Cell (0,0) should be color 1.");
    assert(langtonAnt.dir === 1, "Simulation Logic 5.2: Langton Ant - Ant should turn East (dir 1).");
    assert(langtonAnt.x === 1 && langtonAnt.y === 0, "Simulation Logic 5.3: Langton Ant - Ant should move to (1,0).");
    assert(langtonAnt.state === 0, "Simulation Logic 5.4: Langton Ant - Ant state should remain 0.");

    // Test multi-state rule
    initGrid();
    const multiStateTestRules = {
        0: [{ writeColor: 1, move: 'R', nextState: 1 }],
        1: [{ writeColor: 2, move: 'L', nextState: 0 }]
    };
    let multiStateAnt = createAnt(0, 0, 0, 0); // Start North, State 0

    // Step 1: State 0, Color 0 -> Write 1, Move R, Next State 1
    stepSingleAntLogic(multiStateAnt, multiStateTestRules);
    assert(getGridColor(0, 0) === 1, "Simulation Logic 5.5: Multi-state - Cell (0,0) should be color 1.");
    assert(multiStateAnt.dir === 1, "Simulation Logic 5.6: Multi-state - Ant should turn East (dir 1).");
    assert(multiStateAnt.state === 1, "Simulation Logic 5.7: Multi-state - Ant state should be 1.");

    // Test 'S' (Stay) move
    initGrid();
    const stayTestRules = { 0: [{ writeColor: 1, move: 'S', nextState: 0 }] };
    let stayAnt = createAnt(0, 0, 0, 0);
    stepSingleAntLogic(stayAnt, stayTestRules);
    assert(getGridColor(0, 0) === 1, "Simulation Logic 5.8: Stay Ant - Cell (0,0) should be color 1.");
    assert(stayAnt.x === 0 && stayAnt.y === 0, "Simulation Logic 5.9: Stay Ant - Ant should NOT move.");
    assert(stayAnt.dir === 0, "Simulation Logic 5.10: Stay Ant - Ant direction should NOT change.");

    // Test HALT state
    initGrid();
    let haltAnt = createAnt(0, 0, 0, -1); // Ant in HALT state
    setGridColor(0, 0, 1); // Set a color to verify no change
    stepSingleAntLogic(haltAnt, langtonsTestRules);
    assert(getGridColor(0, 0) === 1, "Simulation Logic 5.11: HALT Ant - Cell color should NOT change.");
    assert(haltAnt.x === 0 && haltAnt.y === 0, "Simulation Logic 5.12: HALT Ant - Ant position should NOT change.");
    assert(haltAnt.state === -1, "Simulation Logic 5.13: HALT Ant - Ant state should remain -1.");

    // Test 6: Performance Tests (Logical Checks)
    console.log("\n-- Testing Performance (Logical) --");
    initGrid();
    setGridColor(1, 1, 1);
    setGridColor(2, 2, 2);
    setGridColor(3, 3, defaultColor); // Should remove from map
    assert(getGridSize() === 2, "Performance 6.1: Grid should only contain non-default cells (size check).");

    // Test 7: Rule Parsing and Formatting
    console.log("\n-- Testing Rule Parsing and Formatting --");
    const formattedRules = formatRulesForDisplay(langtonsTestRules, "Test Preset");
    assert(formattedRules.includes("Test Preset"), "Rule Formatting 7.1: Should include preset name.");
    assert(formattedRules.includes("States: 1"), "Rule Formatting 7.2: Should include state count.");
    assert(formattedRules.includes("Colors: 2"), "Rule Formatting 7.3: Should include color count.");

    const parsedRules = parseRulesFromText(JSON.stringify(langtonsTestRules));
    assert(parsedRules !== null, "Rule Parsing 7.4: Should parse valid JSON rules.");
    assert(JSON.stringify(parsedRules) === JSON.stringify(langtonsTestRules), "Rule Parsing 7.5: Parsed rules should match original.");

    const invalidParsedRules = parseRulesFromText("invalid json");
    assert(invalidParsedRules === null, "Rule Parsing 7.6: Should reject invalid JSON.");

    // Test 8: Visual Confirmation (Instructions for the developer)
    console.log("\n-- Visual Test Instructions (Manual) --");
    console.log("1. Load the `Langton's Ant` preset.");
    console.log("2. Set ant count to 1, start position to 'Center'.");
    console.log("3. Click 'Apply' and run the simulation.");
    console.log("4. OBSERVE: The ant should build a 'highway' and travel diagonally off-screen indefinitely.");
    console.log("5. It should NOT reappear on the other side of the screen (no wraparound).");
    console.log("6. Pan and zoom the grid. Ensure rendering is smooth and cells appear/disappear correctly.");
    console.log("7. Test 'Randomize' button, 'Ant Count' changes, and 'Start Position' changes.");
    console.log("8. Test 'Save Rule' and 'Load Rule' functionality.");

    // Final Result
    console.log("\n--- Test Suite Complete ---");
    if (allTestsPassed) {
        console.log("%c🎉 All automated tests passed!", "color: lightgreen; font-weight: bold;");
    } else {
        console.error("%c🔥 Some automated tests failed. Please review logs.", "color: red; font-weight: bold;");
    }

    return allTestsPassed;
}

// Export functions for module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runTests
    };
}