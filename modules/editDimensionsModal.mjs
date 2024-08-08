import { levelData, levelView } from "./Editor.mjs";

const modal = document.getElementById("edit-dimensions-modal");
const widthInput = document.getElementById("level-width-input");
const heightInput = document.getElementById("level-height-input");
const leftTopButton = document.getElementById("edit-dimensions-left-top");
const rightBottomButton = document.getElementById("edit-dimensions-right-bottom");

leftTopButton.addEventListener("click", e => {
    changeDimensionsAndCloseModal(widthInput.value, heightInput.value, false);
});
rightBottomButton.addEventListener("click", e => {
    changeDimensionsAndCloseModal(widthInput.value, heightInput.value, true);
});

function changeDimensionsAndCloseModal(newWidth, newHeight, rightBottomBorder) {
    let changedW = levelData.changeWidth(newWidth, rightBottomBorder);
    let changedH = levelData.changeHeight(newHeight, rightBottomBorder);
    if (changedW || changedH) levelView.levelDimensionsChanged();
    modal.close();
}
