import LevelView from "./LevelView.mjs";
import { LevelData, Geometry } from "./LevelData.mjs";

const outputContainer = document.getElementById("graphical-display");

const levelData = new LevelData();
const levelView = new LevelView(outputContainer, levelData, { minZoom: 4, maxZoom: 40, zoom: 12 });

/* Camera & display settings */

// Toggle grid - checkbox
const toggleGridCheckbox = document.getElementById("toggle-grid-input");
toggleGridCheckbox.addEventListener("change", () => {
    levelView.toggleGrid(toggleGridCheckbox.checked);
});


/* Editing */

// Work layer
levelView.setWorkLayer(0);
document.getElementById("work-layer-select").addEventListener("change", e => {
    levelView.setWorkLayer(e.target.value);
});

// Selection type
levelView.setSelectionType("paint");
document.getElementById("selection-type-select").addEventListener("change", e => {
    levelView.setSelectionType(e.target.value);
});

// Edit action
levelView.setEditAction("write");
levelView.setGeometryTool("wall");
document.getElementById("edit-action-select").addEventListener("change", e => {
    levelView.setEditAction(e.target.value);
});
document.getElementById("edit-tool-select").addEventListener("change", e => {
    levelView.setGeometryTool(e.target.value);
});


export default {
    levelData,
    levelView
};
