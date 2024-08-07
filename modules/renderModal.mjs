import Editor from "./Editor.mjs";
import Renderer from "./Renderer.mjs";


// "Import project" modal interaction
const modal = document.getElementById("render-modal");

const renderButton = document.getElementById("render-project-button");
const renderOutputCanvas = document.getElementById("render-output-canvas");
const downloadButton = document.getElementById("download-render-canvas-button");

Renderer.init(renderOutputCanvas);

renderButton.addEventListener("click", e => {
    const levelData = Editor.getLevelData();

    Renderer.render(levelData);
});
downloadButton.addEventListener("click", e => {
    renderOutputCanvas.toBlob(blob => {
        //const link = document.createElement("a");
        //link.target = "_blank";
        //link.href = URL.createObjectURL(blob);
        //link.download = "image.png";
        //document.body.append(link);
        //link.click();
        //link.remove();
        const image = document.createElement("img");
        image.href = URL.createObjectURL(blob);
        image.width = "200";
        image.height = "100";
        modal.append(image);
    });
});


/*
1 - 30
31 - 60 for shadowed areas (0x1f, 0x29, 0x33)
61 - 90

91 - 120
121 - 150 for lighted areas (0x79, 0x83, 0x8D)
151 - 180

I don't think any red value after 180 is useful
[?] 181 - 210
[?] 211 - 240
[?] 241 - 270(255)
*/

// Original non-webgl code
/*
renderButton.addEventListener("click", async e => {
    const width = 1400, height = 800;
    const halfWidth = 700, halfHeight = 400;

    renderOutputCanvas.width = width;
    renderOutputCanvas.height = height;
    const ctx = renderOutputCanvas.getContext("2d");

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);

    const levelData = Editor.getLevelData();
    const cameraPos = levelData.cameraPositions[0];

    for (let l = 0; l < 30; l++) {
        for (let col = 0; col < width; col++) {
            for (let row = 0; row < height; row++) {
                let i = row * width + col << 2;

                if (imageData.data[i] !== 255) continue;

                let screenX = col - halfWidth;
                let screenY = row - halfHeight;

                let dx = screenX / halfWidth;
                let dy = screenY / halfHeight;

                let destinationX = screenX + dx * l + halfWidth + cameraPos.x;
                let destinationY = screenY + dy * l + halfHeight + cameraPos.y;

                let tileX = Math.floor(destinationX / 20);
                let tileY = Math.floor(destinationY / 20);
                let tileL = Math.floor(l / 10);

                if ((levelData.geometryAt(tileX, tileY, tileL) & Geometry.BLOCK_TYPE_MASK) === Geometry.wall) {
                    imageData.data[i] = 121 + l;
                    imageData.data[i + 1] = 0;
                    imageData.data[i + 2] = 0;
                    imageData.data[i + 3] = 255;
                }
            }
        }
    }

    ctx.putImageData(imageData, 0, 0);
});
*/

