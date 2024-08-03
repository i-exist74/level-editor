import { Geometry } from "./LevelData.mjs";

export default class LevelView {
    levelData;

    #container;
    #levelCanvas;
    #gridCanvas;
    #uiCanvas;
    #canvases;
    #ctx;

    // Camera
    minZoom;
    maxZoom;
    #defaultZoom;
    zoom; // effective zoom value (rounded to int)
    #rawZoom; // un-rounded zoom value is stored
    pan;
    
    // For zoom/drag gesture behavior
    #pointerCache = [];
    #prevSqDistBetweenPointers = 0;

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
        this.#canvases = [this.#levelCanvas, this.#gridCanvas, this.#uiCanvas];
        
        this.#container = container;
        this.#container.append(this.#levelCanvas, this.#gridCanvas, this.#uiCanvas);
        
        this.#canvases.forEach(canvas => {
            canvas.style.position = "absolute";
            canvas.style.width = canvas.style.height = "100%";
        });
        const observer = new ResizeObserver((entries) => {
            entries.forEach(({target: canvas}) => {
                canvas.width = canvas.clientWidth;
                canvas.height = canvas.clientHeight;
                this.width = canvas.width;
                this.height = canvas.height;
                this.#calculateOnscreenLevelBoundaries();
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
        this.levelData.on("change dimensions", (newW, newH) => {
            this.width = newW;
            this.height = newH;
            this.#canvases.forEach(canvas => {
                canvas.width = newW;
                canvas.height = newH;
            });
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
        
        this.#container.addEventListener("pointerdown", e => this.#onPointerDown(e));
        this.#container.addEventListener("pointermove", e => this.#onPointerMove(e));
        this.#container.addEventListener("pointerup", e => this.#onPointerUp(e));
        this.#container.addEventListener("pointercancel", e => this.#onPointerCancel(e));
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
            case Geometry.glassWall:
                for (let offX = 0; offX < 1; offX += 0.25) {
                    for (let offY = 0; offY < 1; offY += 0.125) {
                        this.#ctx.fillRect(x + offX + (offY % 0.25), y + offY, 0.125, 0.125);
                    }
                }
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
            this.#ctx.fillStyle = "rgb(60, 132, 76)";
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
            this.#ctx.fillStyle = "rgb(32, 32, 32)";
            this.#ctx.beginPath();
            this.#ctx.ellipse(x + 0.5, y + 0.75, 1 * 0.25, 1 * 0.25, 0, 0, Math.PI * 2);
            this.#ctx.fill();
        }
        if (geo & Geometry.spear) {
            this.#ctx.strokeStyle = "rgb(32, 32, 32)";
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
            this.#ctx.fillStyle = "rgb(178, 32, 32)";
            for (let curX = (x + 1 / 6); curX <= (x + 5 / 6); curX += 1 / 3) {
                this.#ctx.beginPath();
                this.#ctx.rect(curX - r, y + r, r * 2, 1 - r);
                this.#ctx.ellipse(curX, y + r, r, r, 0, 0, Math.PI, true);
                this.#ctx.fill();
            }
        }
        if (geo & Geometry.waterfall) {
            this.#ctx.fillStyle = "rgb(65, 101, 225)";
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
                strokeStyle ||= "rgb(60, 176, 76)";
            case Geometry.scavengerHole:
                strokeStyle ||= "rgb(121, 92, 52)";

                this.#ctx.beginPath();
                this.#ctx.ellipse(x + 0.5, y + 0.5, 0.4, 0.4, 0, 0, Math.PI * 2);
                this.#ctx.lineWidth = 0.2;
                this.#ctx.strokeStyle = strokeStyle;
                this.#ctx.stroke();
                break;

            case Geometry.whackAMoleHole:
                this.#ctx.fillStyle = "rgb(255, 165, 0)";
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
    #onPointerDown(e) {
        if (e.pointerType !== "mouse") {
            this.#pointerCache.push({
                id: e.pointerId,
                x: e.offsetX,
                y: e.offsetY
            });
            if (this.#pointerCache.length === 2) {
                const [a, b] = this.#pointerCache;
                this.#prevSqDistBetweenPointers =
                    (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
            }
        }
        if (e.shiftKey || this.#tool.action === "none") return;

        const tile = this.#screenToLevelCoords(e.offsetX, e.offsetY);
        if (!this.levelData.isInBounds(tile)) return;

        // Handle selection
        if (this.#selectionType === "rect") {
            // Rect selection behavior
            if (!this.#initiatedRectSelection) {
                this.#initiatedRectSelection = true;
                this.#selection = { x1: tile.x, y1: tile.y, x2: tile.x, y2: tile.y };
            } else if (e.pointerType === "mouse") {
                this.#performEditAction(e.altKey);
                this.#initiatedRectSelection = false;
                this.#selection = { x1: tile.x, y1: tile.y, x2: tile.x, y2: tile.y };
            } else {
                this.#selection.x2 = tile.x;
                this.#selection.y2 = tile.y;
            }
        } else if (this.#selectionType === "paint") {
            // Paint selection behavior
            this.#selection = { x1: tile.x, y1: tile.y, x2: tile.x, y2: tile.y };
            this.#performEditAction(e.altKey);
        }

        this.#repaintUI();
    }
    #onPointerMove(e) {
        if ((e.shiftKey || this.#tool.action === "none") &&
            (e.buttons & 1 || e.pointerType !== "mouse")
        ) {
            let prevX, prevY;
            if (e.movementX !== undefined) {
                this.adjustPan(e.movementX, e.movementY);
            } else {
                // movementX/Y is undefined on mobile for some reason
                // so we calculate movement using the previous position of the pointer
                const pointerData = this.#pointerCache.find(pointer => pointer.id === e.pointerId);
                const { x: prevX, y: prevY } = pointerData;
                this.adjustPan(e.offsetX - prevX, e.offsetY - prevY);
                pointerData.x = e.offsetX;
                pointerData.y = e.offsetY;
            }
            if (this.#tool.action === "none" && this.#pointerCache.length === 2) {
                const [a, b] = this.#pointerCache;
                const newSqDist = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
                this.adjustZoom(
                    Math.sqrt(newSqDist / this.#prevSqDistBetweenPointers),
                    (a.x + b.x) / 2, (a.y + b.y) / 2,
                    true
                );
                this.#prevSqDistBetweenPointers = newSqDist;
            }
            return;
        }

        const tile = this.#screenToLevelCoords(e.offsetX, e.offsetY);
        if (!this.levelData.isInBounds(tile)) return;
        if (this.#selection && this.#selection.x2 === tile.x && this.#selection.y2 === tile.y) return;

        if (this.#selectionType === "rect" && this.#initiatedRectSelection) {
            // Move point 2 of targeted rect
            this.#selection.x2 = tile.x;
            this.#selection.y2 = tile.y;
        } else {
            // Target mouse position when idle
            this.#selection = { x1: tile.x, y1: tile.y, x2: tile.x, y2: tile.y };

            if (
                this.#selectionType === "paint" &&
                (e.buttons > 0 || e.pointerType !== "mouse")
            ) {
                // Paint if mouse pressed
                this.#performEditAction(e.altKey);
            }
        }
        this.#repaintUI();
    }
    #onPointerUp(e) {
        if (e.pointerType === "mouse") return;
        
        this.#pointerCache.splice(
            this.#pointerCache.findIndex(pointer => pointer.id === e.pointerId),
            1);
        
        if (this.#tool.action === "none") return;
        
        if (this.#initiatedRectSelection) {
            this.#performEditAction();
            this.#initiatedRectSelection = false;
            //this.#selection = { x1: tile.x, y1: tile.y, x2: tile.x, y2: tile.y };
        }
    }
    #onPointerCancel(e) {
        if (e.pointerType === "mouse") return;
        
        this.#pointerCache.splice(
            this.#pointerCache.findIndex(pointer => pointer.id === e.pointerId),
            1);
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
    adjustZoom(value, pivotX, pivotY, multiply = false) {
        this.#rawZoom = multiply ? this.#rawZoom * value : this.#rawZoom + value;
        this.#rawZoom = Math.max(Math.min(this.#rawZoom, this.maxZoom), this.minZoom);
        //Idk how this was working before with the rawZoom but it's not working now
        //this.setZoom(this.#rawZoom, pivotX, pivotY);
        let zoom = Math.floor(this.#rawZoom);
        if (this.zoom === zoom) return;
        
        this.zoom = zoom;
        this.pan.x = (this.pan.x - pivotX) * zoom * this.#invZoom + pivotX;
        this.pan.y = (this.pan.y - pivotY) * zoom * this.#invZoom + pivotY;
        this.#invZoom = 1 / zoom;
        
        this.#calculateOnscreenLevelBoundaries();
        this.#repaintAll();
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