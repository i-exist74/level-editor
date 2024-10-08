import { levelData } from "./Editor.mjs";

const modal = document.getElementById("export-modal");
const outputEl = document.getElementById("export-text-output");
const outputToTextareaButton = document.getElementById("output-project-to-textarea-button");
const downloadButton = document.getElementById("download-project-button");
const errorDisplay = document.getElementById("export-error-display");

outputToTextareaButton.addEventListener("click", e => {
    try {
        outputEl.value = levelData.exportProjectData();
        outputEl.focus();
        outputEl.select();
        //outputEl.setSelectionRange(0, outputEl.value.length);
    } catch (e) {
        console.error(e);
        errorDisplay.textContent = `Export error: ${e}`;
    }
});
downloadButton.addEventListener("click", e => {
    try {
        const data = levelData.exportProjectData();
        const blob = new Blob([data], { type: "text/plain" });
        const elem = document.createElement('a');
        elem.href = URL.createObjectURL(blob);
        elem.target = "_blank";
        elem.download = "file.txt";        
        document.body.appendChild(elem);
        elem.click();
        document.body.removeChild(elem);
    } catch (e) {
        console.error(e);
        errorDisplay.textContent = `Export error: ${e}`;
    }
});
