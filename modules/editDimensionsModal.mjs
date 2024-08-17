import { levelData, levelView } from "./Editor.mjs";

const modal = document.getElementById("edit-dimensions-modal");
const widthInput = document.getElementById("level-width-input");
const heightInput = document.getElementById("level-height-input");
const leftTopButton = document.getElementById("edit-dimensions-left-top");
const rightBottomButton = document.getElementById("edit-dimensions-right-bottom");
const errorDisplay = document.getElementById("edit-dimensions-error-display");

leftTopButton.addEventListener("click", e => {
    changeDimensionsAndCloseModal(widthInput.value, heightInput.value, false);
});
rightBottomButton.addEventListener("click", e => {
    changeDimensionsAndCloseModal(widthInput.value, heightInput.value, true);
});

function changeDimensionsAndCloseModal(newWidth, newHeight, rightBottomBorder) {
    try {
        let changedW = levelData.changeWidth(newWidth, rightBottomBorder);
        let changedH = levelData.changeHeight(newHeight, rightBottomBorder);
        if (changedW || changedH) levelView.levelDimensionsChanged();
        modal.close();
    } catch (e) {
        console.error(e);
        errorDisplay.textContent = e.stack;
    }
}
