import LevelView from "./LevelView.mjs";
import { LevelData, Geometry } from "./LevelData.mjs";

const outputContainer = document.getElementById("graphical-display");

const levelData = new LevelData();
const levelView = new LevelView(outputContainer, levelData, { minZoom: 4, maxZoom: 40, zoom: 12 });

/* Camera & display settings */

// Zoom - range input
const zoomInput = document.getElementById("zoom-input");
zoomInput.min = levelView.minZoom;
zoomInput.max = levelView.maxZoom;
zoomInput.value = levelView.zoom;
zoomInput.addEventListener("input", () => {
    levelView.setZoom(+zoomInput.value);
});

// Zoom - mouse scroll
outputContainer.addEventListener("wheel", e => {
    levelView.adjustZoom(-e.deltaY * 0.008, e.offsetX, e.offsetY);
    zoomInput.value = levelView.zoom;
});

// Pan - shift & mouse drag
outputContainer.addEventListener("mousemove", e => {
    if (e.shiftKey && (e.buttons & 1)) {
        levelView.adjustPan(e.movementX, e.movementY);
    }
});

// Toggle grid - checkbox
const toggleGridCheckbox = document.getElementById("toggle-grid-input");
toggleGridCheckbox.addEventListener("change", () => {
    levelView.toggleGrid(toggleGridCheckbox.checked);
});


/* Editing */
levelView.setWorkLayer(0);
document.getElementById("work-layer-select").addEventListener("change", e => {
    levelView.setWorkLayer(e.target.value);
});

levelView.setSelectionType("paint");
document.getElementById("selection-type-select").addEventListener("change", e => {
    levelView.setSelectionType(e.target.value);
});

levelView.tool.action = "write";
levelView.tool.geometry = "wall";
document.getElementById("edit-action-select").addEventListener("change", e => {
    levelView.tool.action = e.target.value;
});
document.getElementById("edit-tool-select").addEventListener("change", e => {
    levelView.tool.geometry = e.target.value;
});


export default {
    importProjectData(leditorProjectFile) {
        levelData.importProjectData(leditorProjectFile);
    },
    exportProjectData() {
        return levelData.exportProjectData();
    },

    getLevelData() {
        return levelData;
    }
};
