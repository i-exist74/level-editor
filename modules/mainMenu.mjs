const importModal = document.getElementById("import-modal");
const exportModal = document.getElementById("export-modal");
const renderModal = document.getElementById("render-modal");
const editDimensionsModal = document.getElementById("edit-dimensions-modal");

const menuButtons = document.querySelectorAll("#main-menu .dropdown__option");
menuButtons.forEach(btn => {
    switch (btn.value) {
        case "openImportModal":
            btn.addEventListener("click", e => importModal.showModal());
            break;
        case "openExportModal":
            btn.addEventListener("click", e => exportModal.showModal());
            break;
        case "openRenderModal":
            btn.addEventListener("click", e => renderModal.showModal());
            break;
        case "openEditDimensionsModal":
            btn.addEventListener("click", e => editDimensionsModal.showModal());
    }
});

