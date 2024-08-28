import LevelView from "./LevelView.mjs";
import { LevelData, Geometry } from "./LevelData.mjs";

const outputContainer = document.getElementById("graphical-display");
const toolInfoEl = document.getElementById("tool-info");

const levelData = new LevelData();
const levelView = new LevelView(outputContainer, levelData, { minZoom: 2, maxZoom: 40, zoom: 12 });


const toggleGridCheckbox = document.getElementById("toggle-grid-input");
toggleGridCheckbox.addEventListener("change", () => {
    levelView.toggleGrid(toggleGridCheckbox.checked);
});

levelView.setWorkLayer(0);
document.getElementById("work-layer-select").addEventListener("change", e => {
    levelView.setWorkLayer(e.target.value);
});

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
document.getElementById("geometry-tool-select").addEventListener("change", e => {
    levelView.setGeometryTool(e.target.value);
    toolInfoEl.textContent = e.target.dataset.description;
});

const openEditorButtons = document.getElementsByClassName("open-editor-button");
let currentlyActiveButton;

for (const button of openEditorButtons) {
    button.addEventListener("click", editorButtonClicked);
}
editorButtonClicked.call(openEditorButtons[0]);

function editorButtonClicked() {
    let editorName = this.value;
    for (const el of document.getElementsByClassName("editor-exclusive")) {
        if (el.classList.contains(`${editorName}-editor`)) {
            el.classList.remove("hide");
        } else {
            el.classList.add("hide");
        }
    }
    currentlyActiveButton?.classList.remove("active");
    (currentlyActiveButton = this).classList.add("active");
    levelView.switchEditor(editorName);
}

export { levelData, levelView };
