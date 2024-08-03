import Editor from "./Editor.mjs";

const modal = document.getElementById("edit-dimensions-modal");
const widthInput = document.getElementById("level-width-input");
const heightInput = document.getElementById("level-height-input");
const leftTopButton = document.getElementById("edit-dimensions-left-top");
const rightBottomButton = document.getElementById("edit-dimensions-right-bottom");

leftTopButton.addEventListener("click", e => {
    Editor.changeDimensions(widthInput.value, heightInput.value, false);
});
rightBottomButton.addEventListener("click", e => {
    Editor.changeDimensions(widthInput.value, heightInput.value, true);
});