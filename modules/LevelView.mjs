import { Geometry } from "./LevelData.mjs";

export default class LevelView {
    levelData;

    #container;
    #levelCanvas;
    #gridCanvas;
    #uiCanvas;
    #ctx;

    // Camera
    minZoom;
    maxZoom;
    #defaultZoom;
    zoom; // effective zoom value (rounded to int)
    #rawZoom; // un-rounded zoom value is stored
    pan;

    // Selection/editing
    #selection = {};
    #initiatedRectSelection = false;
    #workLayer = 0;
    #selectionType = "none";
    #tool = { geometry: "wall", action: "write" };

    // Display
    #showGrid = true;

    // Values calculated at runtime when camera settings change
    #invZoom;
    #onscreenLevelBoundaries; // boundaries of screen in level coords

    constructor(container, levelData, { minZoom, maxZoom, zoom = 12 }) {
        this.#levelCanvas = document.createElement("canvas");
        this.#gridCanvas = document.createElement("canvas");
        this.#uiCanvas = document.createElement("canvas");

        this.#container = container;
        this.#container.append(this.#levelCanvas, this.#gridCanvas, this.#uiCanvas);
        
        [this.#levelCanvas, this.#gridCanvas, this.#uiCanvas].forEach(canvas => {
            canvas.style.position = "absolute";
            canvas.style.width = canvas.style.height = "100%";
            //alert(`${canvas.width}, ${canvas.height}`);
        });
        const observer = new ResizeObserver((entries) => {
            entries.forEach(({target: canvas}) => {
                canvas.width = canvas.clientWidth;
                canvas.height = canvas.clientHeight;
                this.width = canvas.width;
                this.height = canvas.height;
                this.#repaintAll();
            });
        });
        observer.observe(this.#levelCanvas);
        observer.observe(this.#gridCanvas);
        observer.observe(this.#uiCanvas);

        this.width = this.#levelCanvas.width;
        this.height = this.#levelCanvas.height;

        this.levelData = levelData;
        this.levelData.on("init", () => {
            this.#resetCamera();

            this.#selection = {};
            this.#repaintAll();
        });
        this.levelData.on("edit", (x1, y1, x2, y2) => {
            this.#repaintPartLevel(x1, y1, x2, y2);
        });

        this.minZoom = minZoom;
        this.maxZoom = maxZoom;
        this.#defaultZoom = zoom;
        this.#resetCamera();
        this.#repaintAll();
        
        this.#container.addEventListener("mousedown", e => this.#onMouseDown(e));
        this.#container.addEventListener("mousemove", e => this.#onMouseMove(e));
        this.#container.addEventListener("wheel", e => this.#onMouseWheel(e));
        this.#container.oncontextmenu = () => false;
    }

    /* Display */
    #repaintAll() {
        this.#repaintLevel();
        this.#repaintGrid();
        this.#repaintUI();
    }

    // Calculate #onscreenLevelBoundaries
    #calculateOnscreenLevelBoundaries() {
        let start = this.#screenToLevelTransform(0, 0);
        let end = this.#screenToLevelTransform(this.width, this.height);

        start.x = Math.floor(start.x);
        start.y = Math.floor(start.y);
        end.x = Math.ceil(end.x);
        end.y = Math.ceil(end.y);

        this.#onscreenLevelBoundaries = {
            start: start,
            end: end
        };
    }

    // Canvas transform
    #applyCameraTransformation(ctx) {
        const panX = Math.floor(this.pan.x), panY = Math.floor(this.pan.y);
        const zoom = this.zoom;

        ctx.translate(panX, panY);
        ctx.scale(zoom, zoom);
    }

    // Convert screen coord to level coord by applying inverse of camera transformation
    #screenToLevelTransform(screenX, screenY) {
        return {
            x: (screenX - this.pan.x) * this.#invZoom,
            y: (screenY - this.pan.y) * this.#invZoom
        };
    }

    // Convert screen coord to level coord & round down to integer
    #screenToLevelCoords(screenX, screenY) {
        let { x, y } = this.#screenToLevelTransform(screenX, screenY);
        return { x: Math.floor(x), y: Math.floor(y) };
    }

    /* Level display */
    #repaintLevel() {
        this.#ctx = this.#levelCanvas.getContext("2d");
        this.#ctx.restore();
        this.#ctx.clearRect(0, 0, this.width, this.height);

        // Draw level
        let { start, end } = this.#onscreenLevelBoundaries;
        start = this.levelData.constrainToBounds(start);
        end = this.levelData.constrainToBounds(end);

        this.#ctx.save();
        this.#applyCameraTransformation(this.#ctx);

        // Draw geometry
        for (let x = start.x; x < end.x; x++) {
            for (let y = start.y; y < end.y; y++) {
                this.#drawGeometryAt(x, y);
            }
        }
    }

    #repaintPartLevel(x1, y1, x2, y2) {
        this.#ctx = this.#levelCanvas.getContext("2d");
        this.#ctx.clearRect(x1, y1, x2 - x1 + 1, y2 - y1 + 1);

        for (let x = x1; x <= x2; x++) {
            for (let y = y1; y <= y2; y++) {
                this.#drawGeometryAt(x, y);
            }
        }
    }

    // Draw all layers of one tile geometry
    #drawGeometryAt(x, y) {
        for (let l = this.levelData.layers - 1; l >= 0; l--) {
            this.#drawGeometryTile(x, y, l);
        }
    }

    // Draw a single tile of geometry
    #drawGeometryTile(x, y, l) {
        const geo = this.levelData.geometryAt(x, y, l);

        this.#ctx.textAlign = "center";
        this.#ctx.textBaseline = "middle";
        this.#ctx.font = `1px monospace`;

        const color = ["#000000B0", "#008800A0", "#880000A0"][l];
        this.#ctx.fillStyle = color;

        // Block type
        switch (geo & Geometry.BLOCK_TYPE_MASK) {
            case Geometry.wall:
                this.#ctx.fillRect(x, y, 1, 1);
                break;
            case Geometry.slopeNE:
                this.#ctx.beginPath();
                this.#ctx.moveTo(x, y);
                this.#ctx.lineTo(x, y + 1);
                this.#ctx.lineTo(x + 1, y + 1);
                this.#ctx.fill();
                break;
            case Geometry.slopeNW:
                this.#ctx.beginPath();
                this.#ctx.moveTo(x + 1, y);
                this.#ctx.lineTo(x, y + 1);
                this.#ctx.lineTo(x + 1, y + 1);
                this.#ctx.fill();
                break;
            case Geometry.slopeSE:
                this.#ctx.beginPath();
                this.#ctx.moveTo(x + 1, y);
                this.#ctx.lineTo(x, y + 1);
                this.#ctx.lineTo(x, y);
                this.#ctx.fill();
                break;
            case Geometry.slopeSW:
                this.#ctx.beginPath();
                this.#ctx.moveTo(x, y);
                this.#ctx.lineTo(x + 1, y);
                this.#ctx.lineTo(x + 1, y + 1);
                this.#ctx.fill();
                break;
            case Geometry.floor:
                this.#ctx.fillRect(x, y, 1, 0.5);
        }

        // Stackable objects
        if (geo & Geometry.crack) {
            this.#ctx.fillStyle = "red";
            this.#ctx.fillText("C", x + 0.5, y + 0.5);
        }
        if (geo & Geometry.garbageWormHole) {
            this.#ctx.fillStyle = "#3CB04C";
            this.#ctx.fillText("G", x + 0.5, y + 0.5);
        }
        if (geo & Geometry.horizontalPole) {
            this.#ctx.fillStyle = color;
            this.#ctx.fillRect(x, y + 0.4, 1, 0.2);
        }
        if (geo & Geometry.verticalPole) {
            this.#ctx.fillStyle = color;
            this.#ctx.fillRect(x + 0.4, y, 0.2, 1);
        }
        if (geo & Geometry.rock) {
            this.#ctx.fillStyle = "#222";
            this.#ctx.beginPath();
            this.#ctx.ellipse(x + 0.5, y + 0.75, 1 * 0.25, 1 * 0.25, 0, 0, Math.PI * 2);
            this.#ctx.fill();
        }
        if (geo & Geometry.spear) {
            this.#ctx.strokeStyle = "#222";
            this.#ctx.lineWidth = 0.05;
            this.#ctx.beginPath();
            this.#ctx.moveTo(x, y + 1);
            this.#ctx.lineTo(x + 1, y + 0.5);
            this.#ctx.stroke();
        }
        if (geo & Geometry.hive) {
            this.#ctx.fillStyle = "white";
            this.#ctx.beginPath();
            this.#ctx.moveTo(x + 1, y + 1);
            this.#ctx.lineTo(x, y + 1);
            this.#ctx.lineTo(x, y + 0.7);
            for (let curX = x; curX < (x + 1);) {
                this.#ctx.lineTo(curX += 1 / 8, y);
                this.#ctx.lineTo(curX += 1 / 8, y + 0.7);
            }
            this.#ctx.fill();
        }
        if (geo & Geometry.wormGrass) {
            let r = 0.1;
            this.#ctx.fillStyle = "#B22222";
            for (let curX = (x + 1 / 6); curX <= (x + 5 / 6); curX += 1 / 3) {
                this.#ctx.beginPath();
                this.#ctx.rect(curX - r, y + r, r * 2, 1 - r);
                this.#ctx.ellipse(curX, y + r, r, r, 0, 0, Math.PI, true);
                this.#ctx.fill();
            }
        }
        if (geo & Geometry.waterfall) {
            this.#ctx.fillStyle = "#4169E1";
            this.#ctx.fillText("W", x + 0.5, y + 0.5);
        }
        if (geo & Geometry.forbidFlyChains) {
            this.#ctx.fillStyle = "red";
            this.#ctx.fillText("F", x + 0.5, y + 0.5);
        }

        // Shortcut elements
        let strokeStyle; // temp var
        switch (geo & Geometry.SHORTCUT_OBJECT_MASK) {
            case Geometry.shortcutEntrance:
                this.#ctx.fillStyle = "white";
                this.#ctx.fillText("S", x + 0.5, y + 0.5);
                break;

            case Geometry.shortcutPath:
                this.#ctx.fillStyle = "white";
                this.#ctx.fillRect(x + 0.45, y + 0.45, 0.1, 0.1);
                break;

            case Geometry.playerEntrance:
                strokeStyle = "white";
            case Geometry.dragonDen:
                strokeStyle ||= "#3CB04C";
            case Geometry.scavengerHole:
                strokeStyle ||= "#795C34";

                this.#ctx.beginPath();
                this.#ctx.ellipse(x + 0.5, y + 0.5, 0.4, 0.4, 0, 0, Math.PI * 2);
                this.#ctx.lineWidth = 0.2;
                this.#ctx.strokeStyle = strokeStyle;
                this.#ctx.stroke();
                break;

            case Geometry.whackAMoleHole:
                this.#ctx.fillStyle = "#FFA500";
                this.#ctx.beginPath();
                this.#ctx.moveTo(x + 0.5, y);
                this.#ctx.lineTo(x + 1, y + 0.5);
                this.#ctx.lineTo(x + 0.5, y + 1);
                this.#ctx.lineTo(x, y + 0.5);
                this.#ctx.fill();
                break;
        }
    }

    /* Grid display */
    #repaintGrid() {
        this.#ctx = this.#gridCanvas.getContext("2d");
        this.#ctx.restore();
        this.#ctx.clearRect(0, 0, this.width, this.height);

        this.#ctx.save();
        this.#applyCameraTransformation(this.#ctx);

        // Draw grid if toggled on
        if (this.#showGrid) {
            let { start, end } = this.#onscreenLevelBoundaries;
            start = this.levelData.constrainToBounds(start);
            end = this.levelData.constrainToBounds(end);

            this.#ctx.lineWidth = 0.04;
            this.#ctx.strokeStyle = "#BBB";
            for (let x = start.x; x <= end.x; x++) {
                this.#ctx.beginPath();
                this.#ctx.moveTo(x, start.y);
                this.#ctx.lineTo(x, end.y);
                this.#ctx.stroke();
            }
            for (let y = start.y; y <= end.y; y++) {
                this.#ctx.beginPath();
                this.#ctx.moveTo(start.x, y);
                this.#ctx.lineTo(end.x, y);
                this.#ctx.stroke();
            }
        }

        // Draw outer and inner borders
        this.#ctx.lineWidth = 0.08;

        this.#ctx.strokeStyle = "#222";
        this.#ctx.strokeRect(0, 0, this.levelData.levelWidth, this.levelData.levelHeight);

        this.#ctx.strokeStyle = "#FFF";
        this.#ctx.strokeRect(
            this.levelData.bufferLeft, this.levelData.bufferTop,
            this.levelData.levelWidth - this.levelData.bufferLeft - this.levelData.bufferRight,
            this.levelData.levelHeight - this.levelData.bufferTop - this.levelData.bufferBottom);
    }

    /* UI display */
    #repaintUI() {
        this.#ctx = this.#uiCanvas.getContext("2d");
        this.#ctx.restore();
        this.#ctx.clearRect(0, 0, this.width, this.height);

        if (this.#selection) {
            this.#ctx.save();
            this.#applyCameraTransformation(this.#ctx);


            let x1 = Math.min(this.#selection.x1, this.#selection.x2);
            let x2 = Math.max(this.#selection.x1, this.#selection.x2);
            let y1 = Math.min(this.#selection.y1, this.#selection.y2);
            let y2 = Math.max(this.#selection.y1, this.#selection.y2);

            // Draw rectangle selection
            this.#ctx.lineWidth = 0.04;
            this.#ctx.strokeStyle = "#F00";
            this.#ctx.strokeRect(x1, y1, x2 - x1 + 1, y2 - y1 + 1);

            // Draw text coordinates
            this.#ctx.fillStyle = "#F00";
            this.#ctx.font = `${this.#invZoom * 12}px Arial`;

            let text = `(${x1}, ${y1})`;
            if (this.#selectionType === "rect") {
                text += ` w: ${x2 - x1 + 1} h: ${y2 - y1 + 1}`;
            }
            this.#ctx.fillText(text, x2 + 1 + this.#invZoom * 4, y2 + 1);
        }
    }


    /* UI */
    #onMouseDown(e) {
        if (e.shiftKey) return;

        const tile = this.#screenToLevelCoords(e.offsetX, e.offsetY);
        if (!this.levelData.isInBounds(tile)) return;

        // Handle selection
        if (this.#selectionType === "rect") {
            // Rect selection behavior
            if (this.#initiatedRectSelection) {
                this.#performEditAction(e.altKey);
                this.#initiatedRectSelection = false;
            } else {
                this.#initiatedRectSelection = true;
            }
            this.#selection = { x1: tile.x, y1: tile.y, x2: tile.x, y2: tile.y };
        } else if (this.#selectionType === "paint") {
            // Paint selection behavior
            this.#selection = { x1: tile.x, y1: tile.y, x2: tile.x, y2: tile.y };
            this.#performEditAction(e.altKey);
        }

        this.#repaintUI();
    }
    #onMouseMove(e) {
        if (e.shiftKey && (e.buttons & 1)) {
            // Shift + drag: adjust pan
            this.adjustPan(e.movementX, e.movementY);
            return;
        }

        const tile = this.#screenToLevelCoords(e.offsetX, e.offsetY);
        if (!this.levelData.isInBounds(tile)) return;
        if (this.#selection && this.#selection.x1 === tile.x && this.#selection.y1 === tile.y) return;

        if (this.#selectionType === "rect" && this.#initiatedRectSelection) {
            // Move targeted rect
            this.#selection.x1 = tile.x;
            this.#selection.y1 = tile.y;
        } else {
            // Target mouse position when idle
            this.#selection = { x1: tile.x, y1: tile.y, x2: tile.x, y2: tile.y };

            if (this.#selectionType === "paint" && e.buttons > 0) {
                // Paint if mouse pressed
                this.#performEditAction(e.altKey);
            }
        }
        this.#repaintUI();
    }
    #onMouseWheel(e) {
        this.adjustZoom(-e.deltaY * 0.008, e.offsetX, e.offsetY);
    }

    /* Editing interface */

    // Set work layer
    setWorkLayer(layer) {
        this.#workLayer = layer;
    }

    // Set selection behavior - "paint" | "rect" | "none"
    setSelectionType(type) {
        this.#selectionType = type;
        this.#repaintUI();
    }

    // Set edit action
    setEditAction(action) {
        this.#tool.action = action;
    }
    // Set geometry tool
    setGeometryTool(geometry) {
        this.#tool.geometry = geometry;
    }

    // Perform edit with current selection
    #performEditAction(forceRemove) {
        let { x1, y1, x2, y2 } = this.#selection;
        if (x1 > x2) [x1, x2] = [x2, x1];
        if (y1 > y2) [y1, y2] = [y2, y1];

        this.levelData.performAction({
            action: forceRemove ? "remove" : this.#tool.action,
            geometry: this.#tool.geometry
        }, x1, y1, x2, y2, this.#workLayer);
    }


    /* Camera */
    #resetCamera() {
        this.zoom = this.#rawZoom = this.#defaultZoom;
        this.#invZoom = 1 / this.zoom;
        this.pan = { x: 0, y: 0 };
        this.#calculateOnscreenLevelBoundaries();
    }

    setZoom(zoom, pivotX = this.width / 2, pivotY = this.height / 2) {
        zoom = Math.floor(zoom);
        zoom = Math.max(Math.min(zoom, this.maxZoom), this.minZoom);
        if (this.zoom === zoom) return;

        this.pan.x = (this.pan.x - pivotX) * zoom * this.#invZoom + pivotX;
        this.pan.y = (this.pan.y - pivotY) * zoom * this.#invZoom + pivotY;

        this.zoom = this.#rawZoom = zoom;
        this.#invZoom = 1 / zoom;

        this.#calculateOnscreenLevelBoundaries();
        this.#repaintAll();
    }
    adjustZoom(value, pivotX, pivotY) {
        this.#rawZoom += value;
        this.#rawZoom = Math.max(Math.min(this.#rawZoom, this.maxZoom), this.minZoom);
        this.setZoom(this.#rawZoom, pivotX, pivotY);
    }

    adjustPan(x, y) {
        if (x === 0 && y === 0) return;

        this.pan.x += x;
        this.pan.y += y;

        this.#calculateOnscreenLevelBoundaries();
        this.#repaintAll();
    }

    /* Display settings */
    toggleGrid(show) {
        this.#showGrid = show;
        this.#repaintGrid();
    }
}