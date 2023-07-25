import Editor from "./Editor.mjs";

const modal = document.getElementById("export-modal");
const outputEl = modal.querySelector("textarea");
const exportButton = document.getElementById("export-project-button");

exportButton.addEventListener("click", e => {
    outputEl.value = Editor.exportProjectData();
});
