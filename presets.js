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
            0: [ // State 0
                { writeColor: 1, move: 'N', nextState: 1 }, // Reads 0: Write 1, Move Forward, -> State 1
                { writeColor: 0, move: 'U', nextState: 0 }  // Reads 1: Write 0, Reverse & Move, -> State 0
            ],
            1: [ // State 1
                { writeColor: 1, move: 'U', nextState: 1 }, // Reads 0: Write 1, Reverse & Move, -> State 1
                { writeColor: 0, move: 'N', nextState: 0 }  // Reads 1: Write 0, Move Forward, -> State 0
            ]
        }
    },
    busyBeaver3: {
        name: "Busy Beaver 3",
        rules: {
            0: [ // TM State A, Turmite Moving Right
                { writeColor: 1, move: 'N', nextState: 1 }, // Reads 0 (TM: 1,R,B) -> Turmite: (1,N, TS1[B,R])
                { writeColor: 1, move: 'U', nextState: 5 }  // Reads 1 (TM: 1,L,C) -> Turmite: (1,U, TS5[C,L])
            ],
            1: [ // TM State B, Turmite Moving Right
                { writeColor: 1, move: 'U', nextState: 3 }, // Reads 0 (TM: 1,L,A) -> Turmite: (1,U, TS3[A,L])
                { writeColor: 1, move: 'N', nextState: 1 }  // Reads 1 (TM: 1,R,B) -> Turmite: (1,N, TS1[B,R])
            ],
            2: [ // TM State C, Turmite Moving Right
                { writeColor: 1, move: 'U', nextState: 4 }, // Reads 0 (TM: 1,L,B) -> Turmite: (1,U, TS4[B,L])
                { writeColor: 1, move: 'N', nextState: 6 }  // Reads 1 (TM: 1,R,H) -> Turmite: (1,N, TS6[HALT])
            ],
            3: [ // TM State A, Turmite Moving Left
                { writeColor: 1, move: 'U', nextState: 1 }, // Reads 0 (TM: 1,R,B) -> Turmite: (1,U, TS1[B,R])
                { writeColor: 1, move: 'N', nextState: 5 }  // Reads 1 (TM: 1,L,C) -> Turmite: (1,N, TS5[C,L])
            ],
            4: [ // TM State B, Turmite Moving Left
                { writeColor: 1, move: 'N', nextState: 3 }, // Reads 0 (TM: 1,L,A) -> Turmite: (1,N, TS3[A,L])
                { writeColor: 1, move: 'U', nextState: 1 }  // Reads 1 (TM: 1,R,B) -> Turmite: (1,U, TS1[B,R])
            ],
            5: [ // TM State C, Turmite Moving Left
                { writeColor: 1, move: 'N', nextState: 4 }, // Reads 0 (TM: 1,L,B) -> Turmite: (1,N, TS4[B,L])
                { writeColor: 1, move: 'U', nextState: 6 }  // Reads 1 (TM: 1,R,H) -> Turmite: (1,U, TS6[HALT])
            ],
            6: [ // Turmite HALT State
                { writeColor: 0, move: 'S', nextState: 6 }, // Reads 0 -> Write 0, Stay, -> HALT
                { writeColor: 1, move: 'S', nextState: 6 }  // Reads 1 -> Write 1, Stay, -> HALT
            ]
        }
    },
    busyBeaver4: {
        name: "Busy Beaver 4",
        rules: {
            0: [ // TM State A, Turmite Moving Right
                { writeColor: 1, move: 'N', nextState: 1 }, // Reads 0 (TM: 1,R,B) -> Turmite: (1,N, TS1[B,R])
                { writeColor: 1, move: 'U', nextState: 5 }  // Reads 1 (TM: 1,L,B) -> Turmite: (1,U, TS5[B,L])
            ],
            1: [ // TM State B, Turmite Moving Right
                { writeColor: 1, move: 'U', nextState: 4 }, // Reads 0 (TM: 1,L,A) -> Turmite: (1,U, TS4[A,L])
                { writeColor: 0, move: 'U', nextState: 6 }  // Reads 1 (TM: 0,L,C) -> Turmite: (0,U, TS6[C,L])
            ],
            2: [ // TM State C, Turmite Moving Right
                { writeColor: 1, move: 'N', nextState: 8 }, // Reads 0 (TM: 1,R,H) -> Turmite: (1,N, TS8[HALT])
                { writeColor: 1, move: 'U', nextState: 7 }  // Reads 1 (TM: 1,L,D) -> Turmite: (1,U, TS7[D,L])
            ],
            3: [ // TM State D, Turmite Moving Right
                { writeColor: 1, move: 'N', nextState: 3 }, // Reads 0 (TM: 1,R,D) -> Turmite: (1,N, TS3[D,R])
                { writeColor: 0, move: 'N', nextState: 0 }  // Reads 1 (TM: 0,R,A) -> Turmite: (0,N, TS0[A,R])
            ],
            4: [ // TM State A, Turmite Moving Left
                { writeColor: 1, move: 'U', nextState: 1 }, // Reads 0 (TM: 1,R,B) -> Turmite: (1,U, TS1[B,R])
                { writeColor: 1, move: 'N', nextState: 5 }  // Reads 1 (TM: 1,L,B) -> Turmite: (1,N, TS5[B,L])
            ],
            5: [ // TM State B, Turmite Moving Left
                { writeColor: 1, move: 'N', nextState: 4 }, // Reads 0 (TM: 1,L,A) -> Turmite: (1,N, TS4[A,L])
                { writeColor: 0, move: 'N', nextState: 6 }  // Reads 1 (TM: 0,L,C) -> Turmite: (0,N, TS6[C,L])
            ],
            6: [ // TM State C, Turmite Moving Left
                { writeColor: 1, move: 'U', nextState: 8 }, // Reads 0 (TM: 1,R,H) -> Turmite: (1,U, TS8[HALT])
                { writeColor: 1, move: 'N', nextState: 7 }  // Reads 1 (TM: 1,L,D) -> Turmite: (1,N, TS7[D,L])
            ],
            7: [ // TM State D, Turmite Moving Left
                { writeColor: 1, move: 'U', nextState: 3 }, // Reads 0 (TM: 1,R,D) -> Turmite: (1,U, TS3[D,R])
                { writeColor: 0, move: 'U', nextState: 0 }  // Reads 1 (TM: 0,R,A) -> Turmite: (0,U, TS0[A,R])
            ],
            8: [ // Turmite HALT State
                { writeColor: 0, move: 'S', nextState: 8 }, // Reads 0 -> Write 0, Stay, -> HALT
                { writeColor: 1, move: 'S', nextState: 8 }  // Reads 1 -> Write 1, Stay, -> HALT
            ]
        }
    },
    busyBeaver5: {
        name: "Busy Beaver 5",
        rules: {
            // TM State A (Turmite States 0 for Right, 5 for Left)
            0: [ // TM State A, Moving Right
                { writeColor: 1, move: 'N', nextState: 1 }, // Reads 0 (TM: 1,R,B) -> Turmite: (1,N, TS1[B,R])
                { writeColor: 1, move: 'U', nextState: 7 }  // Reads 1 (TM: 1,L,C) -> Turmite: (1,U, TS7[C,L])
            ],
            5: [ // TM State A, Moving Left
                { writeColor: 1, move: 'U', nextState: 1 }, // Reads 0 (TM: 1,R,B) -> Turmite: (1,U, TS1[B,R])
                { writeColor: 1, move: 'N', nextState: 7 }  // Reads 1 (TM: 1,L,C) -> Turmite: (1,N, TS7[C,L])
            ],
            // TM State B (Turmite States 1 for Right, 6 for Left)
            1: [ // TM State B, Moving Right
                { writeColor: 1, move: 'N', nextState: 2 }, // Reads 0 (TM: 1,R,C) -> Turmite: (1,N, TS2[C,R])
                { writeColor: 1, move: 'N', nextState: 1 }  // Reads 1 (TM: 1,R,B) -> Turmite: (1,N, TS1[B,R])
            ],
            6: [ // TM State B, Moving Left
                { writeColor: 1, move: 'U', nextState: 2 }, // Reads 0 (TM: 1,R,C) -> Turmite: (1,U, TS2[C,R])
                { writeColor: 1, move: 'U', nextState: 1 }  // Reads 1 (TM: 1,R,B) -> Turmite: (1,U, TS1[B,R])
            ],
            // TM State C (Turmite States 2 for Right, 7 for Left)
            2: [ // TM State C, Moving Right
                { writeColor: 1, move: 'N', nextState: 3 }, // Reads 0 (TM: 1,R,D) -> Turmite: (1,N, TS3[D,R])
                { writeColor: 0, move: 'U', nextState: 9 }  // Reads 1 (TM: 0,L,E) -> Turmite: (0,U, TS9[E,L])
            ],
            7: [ // TM State C, Moving Left
                { writeColor: 1, move: 'U', nextState: 3 }, // Reads 0 (TM: 1,R,D) -> Turmite: (1,U, TS3[D,R])
                { writeColor: 0, move: 'N', nextState: 9 }  // Reads 1 (TM: 0,L,E) -> Turmite: (0,N, TS9[E,L])
            ],
            // TM State D (Turmite States 3 for Right, 8 for Left)
            3: [ // TM State D, Moving Right
                { writeColor: 1, move: 'U', nextState: 5 }, // Reads 0 (TM: 1,L,A) -> Turmite: (1,U, TS5[A,L])
                { writeColor: 1, move: 'U', nextState: 8 }  // Reads 1 (TM: 1,L,D) -> Turmite: (1,U, TS8[D,L])
            ],
            8: [ // TM State D, Moving Left
                { writeColor: 1, move: 'N', nextState: 5 }, // Reads 0 (TM: 1,L,A) -> Turmite: (1,N, TS5[A,L])
                { writeColor: 1, move: 'N', nextState: 8 }  // Reads 1 (TM: 1,L,D) -> Turmite: (1,N, TS8[D,L])
            ],
            // TM State E (Turmite States 4 for Right, 9 for Left)
            4: [ // TM State E, Moving Right
                { writeColor: 1, move: 'N', nextState: 10}, // Reads 0 (TM: 1,R,H) -> Turmite: (1,N, TS10[HALT])
                { writeColor: 0, move: 'U', nextState: 5 }  // Reads 1 (TM: 0,L,A) -> Turmite: (0,U, TS5[A,L])
            ],
            9: [ // TM State E, Moving Left
                { writeColor: 1, move: 'U', nextState: 10}, // Reads 0 (TM: 1,R,H) -> Turmite: (1,U, TS10[HALT])
                { writeColor: 0, move: 'N', nextState: 5 }  // Reads 1 (TM: 0,L,A) -> Turmite: (0,N, TS5[A,L])
            ],
            // Turmite HALT State
            10: [
                { writeColor: 0, move: 'S', nextState: 10 }, // Reads 0 -> Write 0, Stay, -> HALT
                { writeColor: 1, move: 'S', nextState: 10 }  // Reads 1 -> Write 1, Stay, -> HALT
            ]
        }
    }
}; 