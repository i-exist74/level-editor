const importModal = document.getElementById("import-modal");
const exportModal = document.getElementById("export-modal");
const renderModal = document.getElementById("render-modal");
const editDimensionsModal = document.getElementById("edit-dimensions-modal");

const menuButtons = document.querySelectorAll("#main-menu .dropdown__option");
menuButtons.forEach(btn => {
    let modal;
    switch (btn.value) {
        case "openImportModal":
            modal = importModal;
            break;
        case "openExportModal":
            modal = exportModal;
            break;
        case "openRenderModal":
            modal = renderModal;
            break;
        case "openEditDimensionsModal":
            modal = editDimensionsModal;
    }
    btn.addEventListener("click", e => modal.openModal());
    btn.addEventListener("touchend", e => modal.openModal());
});

document.addEventListener("click", e => {
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

