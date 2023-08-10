import EventEmitter from "./EventEmitter.mjs";

const blank1x1 = await fetch("leveltemplates/blank1x1.txt").then(res => res.text());

/** LevelData - interface for storing and editing levels

leditorProject.txt format as follows:
https://docs.google.com/document/d/1zcxeQGibkZORstwGQUovhQk71k00B69oYwkqFpGyOqs/edit
*/

/* Geometry data */
const BLOCK_TYPE_MASK                  = 0b00000000000001111;
const SHORTCUT_OBJECT_MASK             = 0b00000000001111000;
const MUST_BE_FIRST_LAYER_MASK         = 0b11111111001111000;
const STACKABLES_START_BIT = 7;
const EXCLUSIVE_TO_WALL_MASK           = 0b00000011110000000;
const EXCLUSIVE_TO_WALL_AND_SLOPE_MASK = 0b00111100000000000;
const MUST_BE_ON_WALL_MASK             = 0b11000000000000000;


export const Geometry = {
    BLOCK_TYPE_MASK: BLOCK_TYPE_MASK,
    SHORTCUT_OBJECT_MASK: SHORTCUT_OBJECT_MASK,

    wall: 0b001,
    floor: 0b010,
    slopeNE: 0b100,
    slopeNW: 0b101,
    slopeSE: 0b110,
    slopeSW: 0b111,
    slope: 0b100,
    shortcutEntrance: 0b0001000,
    shortcutPath:     0b0010000,
    playerEntrance:   0b0100000,
    dragonDen:        0b0110000,
    whackAMoleHole:   0b1000000,
    scavengerHole:    0b1010000,

    horizontalPole: 1 << (STACKABLES_START_BIT + 0),
    verticalPole: 1 << (STACKABLES_START_BIT + 1),
    forbidFlyChains: 1 << (STACKABLES_START_BIT + 2),
    waterfall: 1 << (STACKABLES_START_BIT + 3),
    hive: 1 << (STACKABLES_START_BIT + 4),
    wormGrass: 1 << (STACKABLES_START_BIT + 5),
    rock: 1 << (STACKABLES_START_BIT + 6),
    spear: 1 << (STACKABLES_START_BIT + 7),
    crack: 1 << (STACKABLES_START_BIT + 8),
    garbageWormHole: 1 << (STACKABLES_START_BIT + 9),
};


/* File */
const convertProjectData = {
    fromLeditor: {
        geometry: {
            0: 0,
            1: Geometry.wall,
            2: Geometry.slopeNE,
            3: Geometry.slopeNW,
            4: Geometry.slopeSE,
            5: Geometry.slopeSW,
            6: Geometry.floor,
            7: 0, // Shortcut entrance block type. Our editor only reads the shortcut entrance stackable and does not use this
        },
        stackables: {
            1: Geometry.horizontalPole,
            2: Geometry.verticalPole,
            3: Geometry.hive,
            4: Geometry.shortcutEntrance,
            5: Geometry.shortcutPath,
            6: Geometry.playerEntrance,
            7: Geometry.dragonDen,
            9: Geometry.rock,
            10: Geometry.spear,
            11: Geometry.crack,
            12: Geometry.forbidFlyChains,
            13: Geometry.garbageWormHole,
            18: Geometry.waterfall,
            19: Geometry.whackAMoleHole,
            20: Geometry.wormGrass,
            21: Geometry.scavengerHole,
        }
    },
    toLeditor: {
        geometry: {
            0: 0,
            [Geometry.wall]: 1,
            [Geometry.slopeNE]: 2,
            [Geometry.slopeNW]: 3,
            [Geometry.slopeSE]: 4,
            [Geometry.slopeSW]: 5,
            [Geometry.floor]: 6,
            [Geometry.shortcutEntrance]: 7
        },
        stackables: {
             [Geometry.horizontalPole]: 1,
             [Geometry.verticalPole]: 2,
             [Geometry.hive]: 3,
             [Geometry.shortcutEntrance]: 4,
             [Geometry.shortcutPath]: 5,
             [Geometry.playerEntrance]: 6,
             [Geometry.dragonDen]: 7,
             [Geometry.rock]: 9,
             [Geometry.spear]: 10,
             [Geometry.crack]: 11,
             [Geometry.forbidFlyChains]: 12,
             [Geometry.garbageWormHole]: 13,
             [Geometry.waterfall]: 18,
             [Geometry.whackAMoleHole]: 19,
             [Geometry.wormGrass]: 20,
             [Geometry.scavengerHole]: 21,
        }
    },

    fromLeditorGeometry([blockType, stackables]) {
        let value = this.fromLeditor.geometry[blockType];
        for (let i = 0; i < stackables.length; i++) {
            value |= this.fromLeditor.stackables[stackables[i]];
        }
        return value;
    },
    toLeditorGeometry(geo) {
        let result = [, []];
        result[0] = this.toLeditor.geometry[geo & BLOCK_TYPE_MASK];
        if (geo & SHORTCUT_OBJECT_MASK) {
            result[1].push(this.toLeditor.stackables[geo & SHORTCUT_OBJECT_MASK]);
        }

        let curMask = 1 << STACKABLES_START_BIT;
        geo = geo >> STACKABLES_START_BIT << STACKABLES_START_BIT;
        while (geo) {
            let stackable = geo & curMask;
            if (stackable) {
                result[1].push(this.toLeditor.stackables[stackable])
                geo ^= curMask;
            }
            curMask <<= 1;
        }

        return result;
    }
};


export class LevelData extends EventEmitter {
    // Stores ALL data from the original project file as JSON, ordered by line.
    #originalProjectData = [];

    #geometry;
    #tileData;
    #defaultMaterial;
    cameraPositions;

    levelWidth;
    levelHeight;
    bufferLeft;
    bufferTop;
    bufferRight;
    bufferBottom;
    layers;

    constructor() {
        super();
        this.importProjectData(blank1x1);
    }


    /* File */

    importProjectData(leditorProjectData) {
        let lines = leditorProjectData.split("\r");
        lines.length = 9;

        // Make each line of leditor data JSON-parseable (Geometry is already a parseable array)
        for (let i = 1; i < lines.length; i++) {
            let str = lines[i];
            str = str
                .replace(/\[(?=#)/g, "{")
                .replace(/#([^\:]+)/g, '"$1"')
                // objects representing leditor points, rects, colors
                .replace(/point\((-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?)\)/g, '{"x": $1, "y": $2, "isPoint": true}')
                .replace(/rect\((-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?)\)/g, '{"x": $1, "y": $2, "w": $3, "h": $4, "isRect": true}')
                .replace(/color\( ?(-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?) ?\)/g, `{"r": $1, "g": $2, "b": $3, "isColor": true}`);

            str = str.split(""); // turn into char array for ease of modification

            // rematch curly braces
            let bracketStack = [];
            for (let i = 0; i < str.length; i++) {
                let char = str[i];

                if (char === "[" || char === "{") {
                    bracketStack.push(char);
                    continue;
                }
                if (char === "]" && bracketStack[bracketStack.length - 1] === "{") {
                    str[i] = "}";
                }
                if (char === "]" || char === "}") {
                    bracketStack.pop();
                }
            }
            lines[i] = str.join("");
        }
        // Parse JSON
        this.#originalProjectData = lines.map(str => JSON.parse(str));
        let [geometry, tiles, effects, light, , levelSettings, cameras, water, props] = this.#originalProjectData;

        // Set level dimensions
        this.levelWidth = levelSettings.size.x;
        this.levelHeight = levelSettings.size.y;
        this.layers = geometry[0][0].length;
        [this.bufferLeft, this.bufferTop, this.bufferRight, this.bufferBottom] = levelSettings.extraTiles;

        // Set geometry matrix
        this.#geometry = [];
        for (let x = 0; x < this.levelWidth; x++) {
            this.#geometry[x] = [];
            for (let y = 0; y < this.levelHeight; y++) {
                this.#geometry[x][y] = [];
                for (let l = 0; l < this.layers; l++) {
                    this.#geometry[x][y][l] = convertProjectData.fromLeditorGeometry(geometry[x][y][l]);
                }
            }
        }

        // Tiles & default material
        this.#tileData = tiles.tlMatrix;
        this.#defaultMaterial = tiles.defaultMaterial;

        // Cameras
        this.cameraPositions = cameras.cameras;

        // cleanup
        this.#originalProjectData[0] = null;
        this.#originalProjectData[1].tlMatrix = null;

        this.trigger("init");
    }

    exportProjectData() {
        // Transfer level data to originalProjectData
        const data = this.#originalProjectData;

        // Level dimensions
        data[5].size.x = this.levelWidth;
        data[5].size.y = this.levelHeight;

        // Geometry matrix
        data[0] = [];
        for (let x = 0; x < this.levelWidth; x++) {
            data[0][x] = [];
            for (let y = 0; y < this.levelHeight; y++) {
                data[0][x][y] = [];
                for (let l = 0; l < this.layers; l++) {
                    data[0][x][y][l] = convertProjectData.toLeditorGeometry(this.#geometry[x][y][l]);
                }
            }
        }

        // Tiles & default material
        data[1].tlMatrix = this.#tileData;
        data[1].defaultMaterial = this.#defaultMaterial;

        // Cameras
        data[6].cameras = this.cameraPositions;

        // Stringify and reformat merged data to create leditor project file
        let stringifiedData = [];
        for (let i = 0; i < data.length; i++) {
            stringifiedData[i] = JSON.stringify(data[i], function (key, value) {
                // Make sure point, rect, color objects are turned into leditor format
                if (value.isPoint) {
                    return `@@point(${value.x}, ${value.y})`;
                }
                if (value.isRect) {
                    return `@@rect(${value.x}, ${value.y}, ${value.w}, ${value.h})`;
                }
                if (value.isColor) {
                    return `@@color(${value.r}, ${value.g}, ${value.b})`;
                }
                return value;
            });
            if (i === 0) continue;

            stringifiedData[i] = stringifiedData[i]
                .replace(/{/g, "[")
                .replace(/}/g, "]")
                .replace(/"([^"]+)"(?=\:)/g, "#$1")
                .replace(/"@@([a-z]+)\(([^\)]+)\)"/g, "$1($2)");
        }

        return stringifiedData.join("\r");
    }

    /* Level dimensions checks */
    isInBounds({ x, y }) {
        return x >= 0 && x < this.levelWidth &&
            y >= 0 && y < this.levelHeight;
    }

    constrainToBounds({ x, y }) {
        x = Math.min(Math.max(x, 0), this.levelWidth);
        y = Math.min(Math.max(y, 0), this.levelHeight);
        return { x, y };
    }

    /* Get level data */

    geometryAt(x, y, l) {
        return this.#geometry[x]?.[y]?.[l] ?? 0;
    }

    // todo
    tileAt(x, y) {
        return this.#tileData[x][y];
    }


    /* Edit geometry */

    #resolveGeometryExclusivities(x, y, l) {
        let geo = this.#geometry[x][y][l];
        let blockType = geo & BLOCK_TYPE_MASK;

        if (blockType === Geometry.wall) {
            if (geo & Geometry.crack) {
                // Cracked wall is functionally no wall, so remove objects that must be on wall excluding crack
                this.#geometry[x][y][l] &= (~MUST_BE_ON_WALL_MASK) | Geometry.crack;
            } else {
                // Remove objects exclusive to wall
                this.#geometry[x][y][l] &= ~(EXCLUSIVE_TO_WALL_AND_SLOPE_MASK | EXCLUSIVE_TO_WALL_MASK);
            }
        } else {
            // Remove objects that must be on wall
            this.#geometry[x][y][l] &= ~MUST_BE_ON_WALL_MASK;

            if (blockType & Geometry.slope) {
                // Remove objects exclusive to slope
                this.#geometry[x][y][l] &= ~EXCLUSIVE_TO_WALL_AND_SLOPE_MASK;
            }
        }
    }

    #resolveSlopePlacement(x, y, l) {
        let left = x === 0 || (this.#geometry[x - 1][y][l] & BLOCK_TYPE_MASK) === Geometry.wall;
        let bottom = y === this.levelHeight - 1 || (this.#geometry[x][y + 1][l] & BLOCK_TYPE_MASK) === Geometry.wall;

        if (left && bottom) {
            return Geometry.slopeNE;
        }

        let right = x === this.levelWidth - 1 || (this.#geometry[x + 1][y][l] & BLOCK_TYPE_MASK) === Geometry.wall;

        if (bottom && right) {
            return Geometry.slopeNW;
        }

        let top = y === 0 || (this.#geometry[x][y - 1][l] & BLOCK_TYPE_MASK) === Geometry.wall;

        if (right && top) {
            return Geometry.slopeSW;
        }

        if (top && left) {
            return Geometry.slopeSE;
        }

        return false;
    }

    #writeGeometry(x, y, l, geometry) {
        if (l > 0) {
            this.#geometry[x][y][l] &= ~MUST_BE_FIRST_LAYER_MASK;
            if (geometry & MUST_BE_FIRST_LAYER_MASK) return;
        }

        if (geometry === Geometry.slope) {
            let slopeToPlace = this.#resolveSlopePlacement(x, y, l);
            if (slopeToPlace) {
                geometry = slopeToPlace;
            } else return;
        }

        if (geometry & BLOCK_TYPE_MASK) {
            this.#geometry[x][y][l] &= ~BLOCK_TYPE_MASK;
        }
        if (geometry & SHORTCUT_OBJECT_MASK) {
            this.#geometry[x][y][l] &= ~SHORTCUT_OBJECT_MASK;
        }
        this.#geometry[x][y][l] |= geometry;
    }
    #toggleGeometry(x, y, l, geometry) {
        if (l > 0) {
            this.#geometry[x][y][l] &= ~MUST_BE_FIRST_LAYER_MASK;
            if (geometry & MUST_BE_FIRST_LAYER_MASK) return;
        }

        if (geometry === Geometry.slope) {
            if (!(this.#geometry[x][y][l] & Geometry.slope)) {
                let slopeToPlace = this.#resolveSlopePlacement(x, y, l);
                if (slopeToPlace) {
                    geometry = slopeToPlace;
                } else return;
            } else {
                this.#geometry[x][y][l] &= ~BLOCK_TYPE_MASK;
                return;
            }
        }

        if (geometry & BLOCK_TYPE_MASK) {
            if ((this.#geometry[x][y][l] & BLOCK_TYPE_MASK) !== geometry) {
                this.#geometry[x][y][l] &= ~BLOCK_TYPE_MASK;
            }
        } 
        if (geometry & SHORTCUT_OBJECT_MASK) {
            if ((this.#geometry[x][y][l] & SHORTCUT_OBJECT_MASK) !== geometry) {
                this.#geometry[x][y][l] &= ~SHORTCUT_OBJECT_MASK;
            }
        } 

        this.#geometry[x][y][l] ^= geometry;
    }
    #removeGeometry(x, y, l, geometry) {
        if (l > 0) {
            this.#geometry[x][y][l] &= ~MUST_BE_FIRST_LAYER_MASK;
            if (geometry & MUST_BE_FIRST_LAYER_MASK) return;
        }

        if (geometry === Geometry.slope) {
            if (this.#geometry[x][y][l] & Geometry.slope) {
                this.#geometry[x][y][l] &= ~BLOCK_TYPE_MASK;
            }
            return;
        }
        if (geometry & BLOCK_TYPE_MASK) {
            if ((this.#geometry[x][y][l] & BLOCK_TYPE_MASK) === geometry) {
                this.#geometry[x][y][l] ^= geometry;
            }
            return;
        }
        if (geometry & SHORTCUT_OBJECT_MASK) {
            if ((this.#geometry[x][y][l] & SHORTCUT_OBJECT_MASK) === geometry) {
                this.#geometry[x][y][l] ^= geometry;
            }
            return;
        }
        this.#geometry[x][y][l] &= ~geometry;
    }
    #clearGeometry(x, y, l) {
        this.#geometry[x][y][l] = 0;
    }

    // Perform a read or write operation (geometry) on a given part of the level
    performAction({ action, name }, fromX, fromY, toX, toY, l) {
        let method = (
            action === "write" ? this.#writeGeometry :
            action === "toggle" ? this.#toggleGeometry :
            action === "remove" ? this.#removeGeometry :
            this.#clearGeometry
        ).bind(this);

        for (let x = fromX; x <= toX; x++) {
            for (let y = fromY; y <= toY; y++) {
                // Unique behavior for clear all geometry (name parameter is unused)
                if (action === "clear") {
                    method(x, y, l);
                    continue;
                }

                // Perform action using specified geometry
                method(x, y, l, Geometry[name]);
                this.#resolveGeometryExclusivities(x, y, l);
            }
        }

        this.trigger("edit", fromX, fromY, toX, toY);
    }
}


