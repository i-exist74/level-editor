import LevelView from "./LevelView.mjs";
import { LevelData, Geometry } from "./LevelData.mjs";

const outputContainer = document.getElementById("graphical-display");
const toolInfoEl = document.getElementById("tool-info");

const levelData = new LevelData();
const levelView = new LevelView(outputContainer, levelData, { minZoom: 4, maxZoom: 40, zoom: 12 });


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
document.getElementById("edit-tool-select").addEventListener("change", e => {
    levelView.setGeometryTool(e.target.value);
    toolInfoEl.textContent = e.target.dataset.description;
});

for (const button of document.getElementsByClassName("open-editor-button")) {
    button.addEventListener("click", editorButtonClicked);
}
function editorButtonClicked() {
    let editorName = this.value;
    for (const el of document.getElementsByClassName("editor-exclusive")) {
        if (el.classList.contains(editorName)) {
            el.classList.remove("hide");
        } else {
            el.classList.add("hide");
        }
    }
}

export { levelData, levelView };
