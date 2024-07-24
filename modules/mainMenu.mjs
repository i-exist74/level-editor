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
    btn.addEventListener("click", e => modal.showModal());
    // I don't know why just the click handler doesn't work for mobile;
    // if I tap on an option it just defocuses the dropdown button and the click handler doesn't trigger
    btn.addEventListener("touchend", e => modal.showModal());
});

document.addEventListener("click", e => {
    /*if (e.target.classList.contains("dropdown__button")) {
        e.target.parentNode.classList.toggle("open");
    } else if (e.target.classList.contains("dropdown__option")) {
        
    }*/
    if (document.activeElement && e.target !== document.activeElement) {
        document.activeElement.blur();
    }
    if (
        e.target.classList.contains("dropdown__button") ||
        e.target.classList.contains("dropdown__option")
    ) {
        e.target.focus();
    }
});

