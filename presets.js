const presetDefinitions = {
    langtons: {
        name: "Langton's Ant",
        rules: {
            0: [
                { writeColor: 1, move: 'R', nextState: 0 }, // Color 0: Turn Right, Write 1
                { writeColor: 0, move: 'L', nextState: 0 }  // Color 1: Turn Left, Write 0
            ]
        }
    },
    constructor: {
        name: "Constructor",
        rules: {
            "0": [
                { writeColor: 0, move: "S", nextState: 2 },
                { writeColor: 0, move: "S", nextState: 2 }
            ],
            "1": [
                { writeColor: 1, move: "L", nextState: 2 },
                { writeColor: 0, move: "R", nextState: 1 }
            ],
            "2": [
                { writeColor: 0, move: "N", nextState: 1 },
                { writeColor: 0, move: "U", nextState: 2 }
            ]
        }
    },
    symmetrical: {
        name: "Symmetrical",
        rules: {
            0: [
                { writeColor: 1, move: 'R', nextState: 0 },
                { writeColor: 2, move: 'R', nextState: 0 },
                { writeColor: 3, move: 'L', nextState: 0 },
                { writeColor: 4, move: 'L', nextState: 0 },
                { writeColor: 5, move: 'R', nextState: 0 },
                { writeColor: 0, move: 'R', nextState: 0 }
            ]
        }
    },
    snowflake: {
        name: "Snowflake",
        rules: {
            0: [ // State 0
                { writeColor: 1, move: 'L', nextState: 1 }, // Sees color 0: {1,8,1}
                { writeColor: 1, move: 'R', nextState: 0 }  // Sees color 1: {1,2,0}
            ],
            1: [ // State 1
                { writeColor: 1, move: 'U', nextState: 1 }, // Sees color 0: {1,4,1}
                { writeColor: 1, move: 'U', nextState: 2 }  // Sees color 1: {1,4,2}
            ],
            2: [ // State 2
                { writeColor: 0, move: 'N', nextState: 2 },
                { writeColor: 0, move: 'U', nextState: 0 }
            ]
        }
    },
    archimedesSpiral: {
        name: "Archimedes Spiral",
        rules: {
            0: [
                { writeColor: 1, move: 'L', nextState: 0 },
                { writeColor: 2, move: 'R', nextState: 0 },
                { writeColor: 3, move: 'R', nextState: 0 },
                { writeColor: 4, move: 'R', nextState: 0 },
                { writeColor: 5, move: 'R', nextState: 0 },
                { writeColor: 6, move: 'L', nextState: 0 },
                { writeColor: 7, move: 'L', nextState: 0 },
                { writeColor: 8, move: 'L', nextState: 0 },
                { writeColor: 9, move: 'R', nextState: 0 },
                { writeColor: 10, move: 'R', nextState: 0 },
                { writeColor: 0, move: 'R', nextState: 0 }
            ]
        }
    },
    logarithmicSpiral: {
        name: "Logarithmic Spiral",
        rules: {
            0: [
                { writeColor: 1, move: 'R', nextState: 0 },
                { writeColor: 2, move: 'L', nextState: 0 },
                { writeColor: 3, move: 'L', nextState: 0 },
                { writeColor: 4, move: 'L', nextState: 0 },
                { writeColor: 5, move: 'L', nextState: 0 },
                { writeColor: 6, move: 'R', nextState: 0 },
                { writeColor: 7, move: 'R', nextState: 0 },
                { writeColor: 8, move: 'R', nextState: 0 },
                { writeColor: 9, move: 'L', nextState: 0 },
                { writeColor: 10, move: 'L', nextState: 0 },
                { writeColor: 11, move: 'L', nextState: 0 },
                { writeColor: 0, move: 'R', nextState: 0 }
            ]
        }
    },
    squareFiller: {
        name: "Square Filler",
        rules: {
            0: [
                { writeColor: 1, move: 'L', nextState: 0 },
                { writeColor: 2, move: 'R', nextState: 0 },
                { writeColor: 3, move: 'R', nextState: 0 },
                { writeColor: 4, move: 'R', nextState: 0 },
                { writeColor: 5, move: 'R', nextState: 0 },
                { writeColor: 6, move: 'R', nextState: 0 },
                { writeColor: 7, move: 'L', nextState: 0 },
                { writeColor: 8, move: 'L', nextState: 0 },
                { writeColor: 0, move: 'R', nextState: 0 }
            ]
        }
    },
    simpleTuringMachine: {
        name: "Simple Turing Machine",
        rules: {
            0: [ // TM State 0, Moving Right
                { writeColor: 1, move: '>', nextState: 1 }, // Read 0 (Orig: 1, N, 1) -> Continue R, goto 1
                { writeColor: 0, move: '<', nextState: 2 }  // Read 1 (Orig: 0, U, 0) -> Reverse L, goto 0
            ],
            1: [ // TM State 1, Moving Right
                { writeColor: 1, move: '<', nextState: 3 }, // Read 0 (Orig: 1, U, 1) -> Reverse L, goto 1
                { writeColor: 0, move: '>', nextState: 0 }  // Read 1 (Orig: 0, N, 0) -> Continue R, goto 0
            ],
            2: [ // TM State 0, Moving Left
                { writeColor: 1, move: '<', nextState: 3 }, // Read 0 (Orig: 1, N, 1) -> Continue L, goto 1
                { writeColor: 0, move: '>', nextState: 0 }  // Read 1 (Orig: 0, U, 0) -> Reverse R, goto 0
            ],
            3: [ // TM State 1, Moving Left
                { writeColor: 1, move: '>', nextState: 1 }, // Read 0 (Orig: 1, U, 1) -> Reverse R, goto 1
                { writeColor: 0, move: '<', nextState: 2 }  // Read 1 (Orig: 0, N, 0) -> Continue L, goto 0
            ]
        }
    },
    busyBeaver3: {
        name: "Busy Beaver 3",
        rules: {
            0: [ // State A
                { writeColor: 1, move: '>', nextState: 1 }, // Reads 0 (TM: 1,R,B)
                { writeColor: 1, move: '<', nextState: 2 }  // Reads 1 (TM: 1,L,C)
            ],
            1: [ // State B
                { writeColor: 1, move: '<', nextState: 0 }, // Reads 0 (TM: 1,L,A)
                { writeColor: 1, move: '>', nextState: 1 }  // Reads 1 (TM: 1,R,B)
            ],
            2: [ // State C
                { writeColor: 1, move: '<', nextState: 1 }, // Reads 0 (TM: 1,L,B)
                { writeColor: 1, move: '>', nextState: -1 } // Reads 1 (TM: 1,R,H)
            ]
            // Note: State -1 is implicitly handled as HALT by script.js
            // No explicit definition needed here for state -1
        }
    },
    busyBeaver4: {
        name: "Busy Beaver 4",
        rules: {
            0: [ // State A
                { writeColor: 1, move: '>', nextState: 1 }, // Reads 0 (TM: 1,R,B)
                { writeColor: 1, move: '<', nextState: 1 }  // Reads 1 (TM: 1,L,B)
            ],
            1: [ // State B
                { writeColor: 1, move: '<', nextState: 0 }, // Reads 0 (TM: 1,L,A)
                { writeColor: 0, move: '<', nextState: 2 }  // Reads 1 (TM: 0,L,C)
            ],
            2: [ // State C
                { writeColor: 1, move: '>', nextState: -1 },// Reads 0 (TM: 1,R,H)
                { writeColor: 1, move: '<', nextState: 3 }  // Reads 1 (TM: 1,L,D)
            ],
            3: [ // State D
                { writeColor: 1, move: '>', nextState: 3 }, // Reads 0 (TM: 1,R,D)
                { writeColor: 0, move: '>', nextState: 0 }  // Reads 1 (TM: 0,R,A)
            ]
            // State -1 implicitly handled as HALT
        }
    },
    busyBeaver5: {
        name: "Busy Beaver 5",
        rules: {
            0: [ // State A
                { writeColor: 1, move: '>', nextState: 1 }, // Reads 0 (TM: 1,R,B)
                { writeColor: 1, move: '<', nextState: 2 }  // Reads 1 (TM: 1,L,C)
            ],
            1: [ // State B
                { writeColor: 1, move: '>', nextState: 2 }, // Reads 0 (TM: 1,R,C)
                { writeColor: 1, move: '>', nextState: 1 }  // Reads 1 (TM: 1,R,B)
            ],
            2: [ // State C
                { writeColor: 1, move: '>', nextState: 3 }, // Reads 0 (TM: 1,R,D)
                { writeColor: 0, move: '<', nextState: 4 }  // Reads 1 (TM: 0,L,E)
            ],
            3: [ // State D
                { writeColor: 1, move: '<', nextState: 0 }, // Reads 0 (TM: 1,L,A)
                { writeColor: 1, move: '<', nextState: 3 }  // Reads 1 (TM: 1,L,D)
            ],
            4: [ // State E
                { writeColor: 1, move: '>', nextState: -1}, // Reads 0 (TM: 1,R,H)
                { writeColor: 0, move: '<', nextState: 0 }  // Reads 1 (TM: 0,L,A)
            ]
            // State -1 implicitly handled as HALT
        }
    }
}; 