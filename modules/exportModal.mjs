import Editor from "./Editor.mjs";

const modal = document.getElementById("export-modal");
const outputEl = modal.querySelector("textarea");
const exportButton = document.getElementById("export-project-button");
const errorDisplay = document.getElementById("export-error-display");

exportButton.addEventListener("click", e => {
    try {
        outputEl.value = Editor.exportProjectData();
    } catch (e) {
        console.error(e);
        errorDisplay.textContent = `Export error: ${e}`;
    }
});
