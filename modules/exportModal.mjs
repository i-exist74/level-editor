import Editor from "./Editor.mjs";

const modal = document.getElementById("export-modal");
const outputEl = modal.querySelector("textarea");
const exportButton = document.getElementById("export-project-button");
const errorDisplay = document.getElementById("export-error-display");

exportButton.addEventListener("click", e => {
    try {
        const data = Editor.exportProjectData();
        //const blob = new Blob([data], { type: "text/plain" });
        const elem = document.createElement('a');
        //elem.href = URL.createObjectURL(blob);
        elem.href = "data:text/plain;charset=utf-8," + data;
        elem.target = "_blank";
        //elem.download = filename;        
        document.body.appendChild(elem);
        elem.click();
        document.body.removeChild(elem);
    } catch (e) {
        console.error(e);
        errorDisplay.textContent = `Export error: ${e}`;
    }
});
