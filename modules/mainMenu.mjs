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

document.addEventListener("pointerdown", e => {
    /*if (e.target.classList.contains("dropdown__button")) {
        e.target.parentNode.classList.toggle("open");
    } else if (e.target.classList.contains("dropdown__option")) {
        
    }*/
    if (
        e.target.classList.contains("dropdown__button") ||
        e.target.classList.contains("dropdown__option")
    ) {
        e.target.focus();
    }
});

