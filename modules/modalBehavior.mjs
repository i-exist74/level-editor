// Set up close behavior for modals

const modals = document.getElementsByClassName("modal");
for (const modalEl of modals) {
    // Close modal when clicking on backdrop or close button
    modalEl.addEventListener("click", e => {
        if (
            e.target === modalEl ||
            e.target.classList.contains("modal__close-button")) {
            modalEl.close();
        }
    });

    /* Prevent the "Import"" modal from closing when a "cancel" event is triggered on the file input.
       I have no idea why this is a thing (stopping propagation on the input's cancel event has no effect,
       so instead I'm just opening the modal back up immediately after a premature close) but whatever */
    modalEl.addEventListener("cancel", e => {
        if (e.target === modalEl) return;

        modalEl.addEventListener("close", () => modalEl.showModal(), { once: true });
    });
}
