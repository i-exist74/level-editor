const importModal = document.getElementById("import-modal");
const exportModal = document.getElementById("export-modal");
const renderModal = document.getElementById("render-modal");
const editDimensionsModal = document.getElementById("edit-dimensions-modal");

const menuButtons = document.querySelectorAll("#main-menu .dropdown__option");
menuButtons.forEach(btn => {
    switch (btn.value) {
        case "openImportModal":
            btn.addEventListener("pointerup", e => importModal.showModal());
            break;
        case "openExportModal":
            btn.addEventListener("pointerup", e => exportModal.showModal());
            break;
        case "openRenderModal":
            btn.addEventListener("pointerup", e => renderModal.showModal());
            break;
        case "openEditDimensionsModal":
            btn.addEventListener("pointerup", e => editDimensionsModal.showModal());
    }
});

// for mobile - focus button when clicked
document.addEventListener("pointerup", e => {
    if (
        !e.target.classList.contains("dropdown__button") &&
        !e.target.classList.contains("dropdown__option")
    ) return;
    
    e.target.focus();
});

