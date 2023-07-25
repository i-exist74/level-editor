import Editor from "./Editor.mjs";

// "Import project" modal interaction
const modal = document.getElementById("import-modal");

const inputEl = document.getElementById("project-file-input");
const loadButton = document.getElementById("import-project-button");

loadButton.addEventListener("click", e => {
    const file = inputEl.files[0];
    if (!file || file.type !== "text/plain") {
        alert("Invalid file");
        return;
    }

    // Read project data and send to editor
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = e => {
        Editor.importProjectData(reader.result);
        modal.close();
    };
});

