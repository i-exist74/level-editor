import { Geometry, Tiles } from "./LevelData.mjs";

export default class LevelView {
    levelData;

    #container;
    #levelCanvas;
    #gridCanvas;
    #uiCanvas;
    #canvases;
    #ctx;
    
    // Store pointer event data, for zoom/drag gesture behavior
    #pointerCache = [];
    #prevSqDistBetweenPointers = 0;

    // Camera
    minZoom;
    maxZoom;
    #defaultZoom;
    zoom; // effective zoom value (rounded to int)
    #rawZoom; // un-rounded zoom value is stored
    pan;
    
    // Editor
    #currentEditor = "geometry";
    
    // Tile editing
    #selection = {};
    #initiatedRectSelection = false;
    #workLayer = 0;
    #selectionType = "none";
    #tool = { geometry: "wall", action: "write" };

    // Camera editing
    #selectedCameraIndex = -1;
    #selectedCornerIndex = -1;

    // Display settings
    #showGrid = true;
    #showWorkLayerOnTop = false;
    cameraCenterRadius = 8;
    cameraCornerRadius = 6;

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
            const canvas = entries[0].target;
            this.#onResized(canvas.clientWidth, canvas.clientHeight);
        });
        observer.observe(this.#levelCanvas);

        this.width = this.#levelCanvas.width;
        this.height = this.#levelCanvas.height;

        this.levelData = levelData;
        this.levelData.on("init", () => {
            this.#resetCamera();

            this.#selection = {};
            this.#repaintAll();
        });
        this.levelData.on("edit geometry", (x1, y1, x2, y2) => {
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
    
    #onResized(newW, newH) {
        this.width = newW;
        this.height = newH;
        this.#canvases.forEach(canvas => {
            canvas.width = newW;
            canvas.height = newH;
        });
        this.#calculateOnscreenLevelBoundaries();
        this.#repaintAll();
    }
    
    levelDimensionsChanged() {
        this.#repaintAll();
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
        //this.#ctx.restore();
        this.#ctx.clearRect(0, 0, this.width, this.height);

        // Draw level
        let { start, end } = this.#onscreenLevelBoundaries;
        start = this.levelData.constrainToBounds(start);
        end = this.levelData.constrainToBounds(end);

        //this.#ctx.save();
        //this.#applyCameraTransformation(this.#ctx);

        // Draw geometry
        for (let x = start.x; x <= end.x; x++) {
            for (let y = start.y; y <= end.y; y++) {
                this.#drawLevelAt(x, y);
            }
        }
    }

    #repaintPartLevel(x1, y1, x2, y2) {
        this.#ctx = this.#levelCanvas.getContext("2d");
        this.#ctx.clearRect(
            x1 * this.zoom + this.pan.x, y1 * this.zoom + this.pan.y,
            (x2 - x1 + 1) * this.zoom, (y2 - y1 + 1) * this.zoom
        );

        for (let x = x1; x <= x2; x++) {
            for (let y = y1; y <= y2; y++) {
                this.#drawLevelAt(x, y);
            }
        }
    }

    // Draw all layers of one tile geometry
    #drawLevelAt(x, y) {
        const colors =  ["#000000A0", "#008800A0", "#880000A0"];
        
        try {
        
        for (let l = this.levelData.layers - 1; l >= 0; l--) {
            if (this.#showWorkLayerOnTop && l === this.#workLayer) {
                continue;
            }
            this.#drawGeometryTile(x, y, l, colors[l]);
            if (l === this.#workLayer && this.#currentEditor === "tile") {
                this.#drawTileAt(x, y, l);
            }
        }
        if (this.#showWorkLayerOnTop) {
            this.#drawGeometryTile(x, y, this.#workLayer, colors[this.#workLayer]);
            if (l === this.#workLayer && this.#currentEditor === "tile") {
                this.#drawTileAt(x, y, this.#workLayer);
            }
        }
        
        } catch (e) {
            alert(e);
            throw e;
        }
    }

    // Draw a single tile of geometry
    #drawGeometryTile(x, y, l, defaultColor) {
        const geo = this.levelData.geometryAt(x, y, l);
        
        x = Math.floor(x * this.zoom + this.pan.x);
        y = Math.floor(y * this.zoom + this.pan.y);
        
        const s = this.zoom;
        
        this.#ctx.textAlign = "center";
        this.#ctx.textBaseline = "middle";
        this.#ctx.font = `${s}px monospace`;

        this.#ctx.fillStyle = defaultColor;

        // Block type
        switch (geo & Geometry.BLOCK_TYPE_MASK) {
            case Geometry.wall:
                if (geo & Geometry.crack) {
                    this.#ctx.fillRect(x + 0.33*s, y + 0.33*s, 0.34*s, 0.34*s);
                } else {
                    this.#ctx.fillRect(x, y, s, s);
                }
                break;
            case Geometry.glassWall:
                let size = s/8;
                for (let offX = 0; offX < size; offX += size*2) {
                    for (let offY = 0; offY < size; offY += size) {
                        this.#ctx.fillRect(x + offX + (offY % (size*2)), y + offY, size, size);
                    }
                }
                break;
            case Geometry.slopeNE:
                this.#ctx.beginPath();
                this.#ctx.moveTo(x, y);
                this.#ctx.lineTo(x, y + s);
                this.#ctx.lineTo(x + s, y + s);
                this.#ctx.fill();
                break;
            case Geometry.slopeNW:
                this.#ctx.beginPath();
                this.#ctx.moveTo(x + s, y);
                this.#ctx.lineTo(x, y + s);
                this.#ctx.lineTo(x + s, y + s);
                this.#ctx.fill();
                break;
            case Geometry.slopeSE:
                this.#ctx.beginPath();
                this.#ctx.moveTo(x + s, y);
                this.#ctx.lineTo(x, y + s);
                this.#ctx.lineTo(x, y);
                this.#ctx.fill();
                break;
            case Geometry.slopeSW:
                this.#ctx.beginPath();
                this.#ctx.moveTo(x, y);
                this.#ctx.lineTo(x + s, y);
                this.#ctx.lineTo(x + s, y + s);
                this.#ctx.fill();
                break;
            case Geometry.floor:
                this.#ctx.fillRect(x, y, s, s / 2);
        }

        // Stackable objects
        if (geo & Geometry.garbageWormHole) {
            this.#ctx.fillStyle = "rgb(60, 132, 76)";
            this.#ctx.fillText("G", x + 0.5 * s, y + 0.5 * s);
        }
        if (geo & Geometry.horizontalPole) {
            this.#ctx.fillStyle = defaultColor;
            this.#ctx.fillRect(x, y + 0.4*s, s, 0.2 * s);
        }
        if (geo & Geometry.verticalPole) {
            this.#ctx.fillStyle = defaultColor;
            this.#ctx.fillRect(x + 0.4*s, y, 0.2*s, s);
        }
        if (geo & Geometry.rock) {
            this.#ctx.fillStyle = "rgb(32, 32, 32)";
            this.#ctx.beginPath();
            this.#ctx.ellipse(x + 0.5 * s, y + 0.75 * s, 0.25 * s, 0.25 * s, 0, 0, Math.PI * 2);
            this.#ctx.fill();
        }
        if (geo & Geometry.spear) {
            this.#ctx.strokeStyle = "rgb(32, 32, 32)";
            this.#ctx.lineWidth = 0.05 * s;
            this.#ctx.beginPath();
            this.#ctx.moveTo(x, y + s);
            this.#ctx.lineTo(x + s, y + 0.5 * s);
            this.#ctx.stroke();
        }
        if (geo & Geometry.hive) {
            this.#ctx.fillStyle = l === 0 ? "white" : defaultColor;
            this.#ctx.beginPath();
            this.#ctx.moveTo(x + s, y + s);
            this.#ctx.lineTo(x, y + s);
            this.#ctx.lineTo(x, y + 0.7 * s);
            for (let curX = x; curX < x + s;) {
                this.#ctx.lineTo(curX += s / 8, y);
                this.#ctx.lineTo(curX += s / 8, y + 0.7*s);
            }
            this.#ctx.fill();
        }
        if (geo & Geometry.wormGrass) {
            let r = 0.1*s;
            this.#ctx.fillStyle = "rgb(178, 32, 32)";
            for (let curX = (x + s / 6); curX <= x + s; curX += s / 3) {
                this.#ctx.fillRect(curX - r, y + r, r * 2, Math.floor(s - r));
                this.#ctx.beginPath();
                this.#ctx.ellipse(curX, y + r, r, r, 0, 0, Math.PI * 2);
                this.#ctx.fill();
            }
        }
        if (geo & Geometry.waterfall) {
            this.#ctx.fillStyle = "rgb(65, 101, 225)";
            this.#ctx.fillText("W", x + 0.5*s, y + 0.5*s);
        }
        if (geo & Geometry.forbidFlyChains) {
            this.#ctx.fillStyle = "red";
            this.#ctx.fillText("F", x + 0.5*s, y + 0.5*s);
        }

        // Shortcut elements
        let strokeStyle; // temp var
        switch (geo & Geometry.SHORTCUT_OBJECT_MASK) {
            case Geometry.shortcutEntrance:
                this.#ctx.fillStyle = "white";
                this.#ctx.fillText("S", x + 0.5*s, y + 0.5*s);
                break;

            case Geometry.shortcutPath:
                this.#ctx.fillStyle = "white";
                this.#ctx.fillRect(x + 0.45*s, y + 0.45*s, 0.1*s, 0.1*s);
                break;

            case Geometry.playerEntrance:
                strokeStyle = "white";
            case Geometry.dragonDen:
                strokeStyle ||= "rgb(60, 176, 76)";
            case Geometry.scavengerHole:
                strokeStyle ||= "rgb(121, 92, 52)";

                this.#ctx.beginPath();
                this.#ctx.ellipse(x + 0.5*s, y + 0.5*s, 0.4*s, 0.4*s, 0, 0, Math.PI * 2);
                this.#ctx.lineWidth = 0.2*s;
                this.#ctx.strokeStyle = strokeStyle;
                this.#ctx.stroke();
                break;

            case Geometry.whackAMoleHole:
                this.#ctx.fillStyle = "rgb(255, 165, 0)";
                this.#ctx.beginPath();
                this.#ctx.moveTo(x + 0.5*s, y);
                this.#ctx.lineTo(x + s, y + 0.5*s);
                this.#ctx.lineTo(x + 0.5*s, y + s);
                this.#ctx.lineTo(x, y + 0.5*s);
                this.#ctx.fill();
                break;
        }
    }
    
    #drawTileAt(x, y, l) {
        let tileData = this.levelData.tileAt(x, y, l);
        let geometry = this.levelData.geometryAt(x, y, l);
        
        if (tileData.tp === "material") {
            x = Math.floor(x * this.zoom + this.pan.x);
            y = Math.floor(y * this.zoom + this.pan.y);
            const s = this.zoom;
            
            this.#ctx.fillStyle = "red";
            switch (geometry & Geometry.BLOCK_TYPE_MASK) {
                case Geometry.wall:
                    this.#ctx.fillRect(x + s/3, y + s/3, s/3, s/3);
                    break;
                case Geometry.floor:
                    this.#ctx.fillRect(x + s/3, y + s/3, s/3, s/6);
                    break;
                case Geometry.slopeNW:
                    this.#ctx.beginPath();
                    this.#ctx.moveTo(x + s/3, y + s*2/3);
                    this.#ctx.lineTo(x + s*2/3, y + s*2/3);
                    this.#ctx.lineTo(x + s*2/3, y + s/3);
                    this.#ctx.fill();
                    break;
                case Geometry.slopeNE:
                    this.#ctx.beginPath();
                    this.#ctx.moveTo(x + s/3, y + s*2/3);
                    this.#ctx.lineTo(x + s*2/3, y + s*2/3);
                    this.#ctx.lineTo(x + s/3, y + s/3);
                    this.#ctx.fill();
                    break;
                case Geometry.slopeSW:
                    this.#ctx.beginPath();
                    this.#ctx.moveTo(x + s/3, y + s/3);
                    this.#ctx.lineTo(x + s*2/3, y + s*2/3);
                    this.#ctx.lineTo(x + s*2/3, y + s/3);
                    this.#ctx.fill();
                    break;
                case Geometry.slopeSE:
                    this.#ctx.beginPath();
                    this.#ctx.moveTo(x + s/3, y + s*2/3);
                    this.#ctx.lineTo(x + s*2/3, y + s/3);
                    this.#ctx.lineTo(x + s/3, y + s/3);
                    this.#ctx.fill();
                    break;
            }
        } else if (tileData.tp === "tileBody") {
            let headX = tileData.data[0].x - 1;
            let headY = tileData.data[0].y - 1;
            let headL = tileData.data[1] - 1;
            const head = this.levelData.tileAt(headX, headY, headL);
            
            const tile = Tiles.getTile(head.data[0].x, head.data[0].y);
            this.#drawTileFragment(x, y, headX, headY, tile);
        } else if (tileData.tp === "tileHead") {
            const tile = Tiles.getTile(tileData.data[0].x, tileData.data[0].y);
            this.#drawTileFragment(x, y, x, y, tile);
        }
    }
    
    #drawTileFragment(x, y, headX, headY, tile) {
        const s = this.zoom;
        let displayX = x * this.zoom + this.pan.x;
        let displayY = y * this.zoom + this.pan.y;
        
        let xInTile, yInTile;
        if (false) {
            
        } else {
            this.#ctx.fillStyle = "white";
            this.#ctx.font = `${s}px monospace`;
            this.#ctx.fillText("?", displayX + s/2, displayY + s/2);
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
            for (let x = start.x; x <= end.x + 1; x++) {
                this.#ctx.beginPath();
                this.#ctx.moveTo(x, start.y);
                this.#ctx.lineTo(x, end.y + 1);
                this.#ctx.stroke();
            }
            for (let y = start.y; y <= end.y + 1; y++) {
                this.#ctx.beginPath();
                this.#ctx.moveTo(start.x, y);
                this.#ctx.lineTo(end.x + 1, y);
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
        // this.#ctx.restore();
        this.#ctx.clearRect(0, 0, this.width, this.height);
        
        switch (this.#currentEditor) {
            case "geometry":
                this.#drawSelection();
                break;
            case "camera":
                this.#drawCameras();
        }
    }
    #drawSelection() {
        if (!this.#selection) return;
        
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
        // manually do transformations due to jank with some browsers rounding font size to integer
        this.#ctx.restore();
        this.#ctx.fillStyle = "#F00";
        this.#ctx.font = `12px Arial`;

        let text = `(${x1}, ${y1})`;
        if (this.#selectionType === "rect") {
            text += ` w: ${x2 - x1 + 1} h: ${y2 - y1 + 1}`;
        }
        this.#ctx.fillText(text,
            (x2 + 1) * this.zoom + this.pan.x + 4,
            (y2 + 1) * this.zoom + this.pan.y);
    }
    #drawCameras() {
        //this.#ctx.fillStyle = `rgb(from ${this.#container.style.backgroundColor} r g b / 0.5)`;
        this.#ctx.fillStyle = "#FFF8";
        this.#ctx.fillRect(0, 0, this.width, this.height);
        
        this.#ctx.save();
        this.#applyCameraTransformation(this.#ctx);
        
        for (let i = 0; i < this.levelData.cameraPositions.length; i++) {
            let { x, y } = this.levelData.cameraPositions[i];
            const quad = this.levelData.cameraQuads[i];
            
            const isSelectedCamera = this.#selectedCameraIndex === i;
            
            // quad
            this.#ctx.beginPath();
            this.#ctx.moveTo((x + quad[0].x) / 20, (y + quad[0].y) / 20);
            this.#ctx.lineTo((x + quad[1].x) / 20, (y + quad[1].y) / 20);
            this.#ctx.lineTo((x + quad[3].x) / 20, (y + quad[3].y) / 20);
            this.#ctx.lineTo((x + quad[2].x) / 20, (y + quad[2].y) / 20);
            this.#ctx.fillStyle = isSelectedCamera ? "#0F03" : "#0F02";
            this.#ctx.fill();
            
            // 1400x800
            this.#ctx.lineWidth = 0.08;
            this.#ctx.strokeStyle = "#000";
            this.#ctx.strokeRect(x / 20, y / 20, 70, 40);
            
            // 1366x768 (max res)
            this.#ctx.lineWidth = 0.06;
            this.#ctx.strokeStyle = "#80F";
            this.#ctx.strokeRect((x + 17) / 20, (y + 16) / 20, 68.3, 38.4);
            
            // 1024x768 (min res)
            this.#ctx.lineWidth = 0.1;
            this.#ctx.strokeStyle = "#F00";
            this.#ctx.strokeRect((x + 188) / 20, (y + 16) / 20, 51.2, 38.4);
            
            // center
            this.#ctx.beginPath();
            this.#ctx.fillStyle = isSelectedCamera ?
                "rgb(255, 100, 0)" : "rgb(0, 160, 0)";
            this.#ctx.ellipse((x + 700) / 20, (y + 400) / 20, this.cameraCenterRadius * this.#invZoom, this.cameraCenterRadius * this.#invZoom, 0, 0, Math.PI * 2);
            this.#ctx.fill();
            
            // corners
            for (let j = 0; j < quad.length; j++) {
                this.#ctx.beginPath();
                this.#ctx.fillStyle =
                    isSelectedCamera && this.#selectedCornerIndex === j ?
                    "rgb(255, 100, 0)" : "rgb(0, 160, 0)";
                this.#ctx.ellipse((x + quad[j].x) / 20, (y + quad[j].y) / 20, this.cameraCornerRadius * this.#invZoom, this.cameraCornerRadius * this.#invZoom, 0, 0, Math.PI * 2);
                this.#ctx.fill();
            }
        }
        
        this.#ctx.restore();
    }

    /* UI */
    #onPointerDown(e) {
        // store pointer data
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
        
        // Camera selection
        if (this.#currentEditor === "camera") {
            let { x, y } = this.#screenToLevelTransform(e.offsetX, e.offsetY);
            x *= 20;
            y *= 20;
            let buttonRadius = this.cameraCenterRadius * this.#invZoom * 20;
            for (let i = 0; i < this.levelData.cameraPositions.length; i++) {
                let { x: camX, y: camY } = this.levelData.cameraPositions[i];
                let dx = camX + 700 - x, dy = camY + 400 - y;
                if (dx * dx + dy * dy < buttonRadius * buttonRadius) {
                    this.#selectedCameraIndex = i;
                    this.#repaintUI();
                    break;
                }
            }
            return;
        }
        
        // Tile selection
        if (e.shiftKey || this.#tool.action === "none") {
            return;
        }
        
        let tile = this.#screenToLevelCoords(e.offsetX, e.offsetY);
        if (this.#selectionType === "rect") {
            // Rect selection behavior
            tile = this.levelData.constrainToBounds(tile);
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
            if (!this.levelData.isInBounds(tile)) return;
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

        let tile = this.#screenToLevelCoords(e.offsetX, e.offsetY);
        if (this.#selection && this.#selection.x2 === tile.x && this.#selection.y2 === tile.y) return;

        if (this.#selectionType === "rect" && this.#initiatedRectSelection) {
            // Move point 2 of targeted rect
            tile = this.levelData.constrainToBounds(tile);
            this.#selection.x2 = tile.x;
            this.#selection.y2 = tile.y;
        } else if (this.levelData.isInBounds(tile)) {
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
    switchEditor(editor) {
        const oldEditor = this.#currentEditor;
        this.#currentEditor = editor;
        
        if (oldEditor === "camera" || editor === "camera") {
            this.#repaintUI();
        }
        if (oldEditor === "tile" || editor === "tile") {
            this.#repaintLevel();
        }
    }
    
    setWorkLayer(layer) {
        if (this.#workLayer === +layer) return;
        
        this.#workLayer = +layer;
        if (this.#showWorkLayerOnTop) {
            this.#repaintLevel();
        }
    }
    
    setSelectionType(type) {
        this.#selectionType = type;
        this.#repaintUI();
    }

    setEditAction(action) {
        this.#tool.action = action;
    }
    
    setGeometryTool(geometry) {
        this.#tool.geometry = geometry;
    }

    // Perform edit with current selection
    #performEditAction(forceRemove) {
        let { x1, y1, x2, y2 } = this.#selection;
        if (x1 > x2) [x1, x2] = [x2, x1];
        if (y1 > y2) [y1, y2] = [y2, y1];

        this.levelData.rectGeometryAction({
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
        if (this.#showGrid !== show) {
            this.#showGrid = show;
            this.#repaintGrid();
        }
    }
    toggleShowWorkLayerOnTop(value) {
        if (this.#showWorkLayerOnTop !== value) {
            this.#showWorkLayerOnTop = value;
            this.#repaintLevel();
        }
    }
}