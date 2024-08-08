import { levelData } from "./Editor.mjs";

// "Import project" modal interaction
const modal = document.getElementById("import-modal");

const inputEl = document.getElementById("project-file-input");
const loadButton = document.getElementById("import-project-button");
const errorDisplay = document.getElementById("import-error-display");

loadButton.addEventListener("click", e => {
    const file = inputEl.files[0];
    if (!file) {
        alert("Invalid file");
        return;
    }

    // Read project data and send to editor
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = e => {
        try {
            levelData.importProjectData(reader.result);
            modal.close();
        } catch (e) {
            console.error(e);
            errorDisplay.textContent = e;
        }
    };
});

