/**
 * Original non-webGL attempt & info about the format of the rendered level png file in renderModa.mjs.
 */
import { Geometry } from "./LevelData.mjs";
import m4 from "./m4.mjs";

const vertexShaderSource = `#version 300 es
    in vec4 a_position;

    uniform mat4 u_worldMatrix;
    uniform mat4 u_projectionMatrix;

    out float z;

    void main() {
        vec4 worldPosition = u_worldMatrix * a_position;

        gl_Position = u_projectionMatrix * worldPosition;

        z = worldPosition.z;
    }
`;
const fragmentShaderSource = `#version 300 es
    precision highp float;

    in float z;
    out vec4 outColor;

    void main() {
        outColor = vec4((121.0 + z) / 255.0, 0, 0, 1);
    }
`;


/** @type {WebGL2RenderingContext} */
let gl;
let program;

// todo: refactor, do stuff with this uniforms var & stuff, while i'm in a mindset in which i'm actually capable of doing anything productive
const uniforms = {
    worldMatrix: -1,
    projectionMatrix: -1
};

function initializeGL(canvas) {
    gl = canvas.getContext("webgl2");

    // resize canvas and GL viewport
    canvas.width = 1400;
    canvas.height = 800;
    gl.viewport(0, 0, canvas.width, canvas.height);

    // create and link program
    const vertShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertShader, vertexShaderSource);
    gl.compileShader(vertShader);
    if (gl.getShaderParameter(vertShader, gl.COMPILE_STATUS) === false) {
        throw new Error(gl.getShaderInfoLog(vertShader));
    }

    const fragShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragShader, fragmentShaderSource);
    gl.compileShader(fragShader);
    if (gl.getShaderParameter(fragShader, gl.COMPILE_STATUS) === false) {
        throw new Error(gl.getShaderInfoLog(fragShader));
    }

    program = gl.createProgram();
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    gl.enable(gl.DEPTH_TEST);
}

/**
 * @param {import("LevelData.mjs").LevelData} levelData
 */
const render = function(levelData, cameraIndex = 0) {
    try {
    
    const cameraPos = levelData.cameraPositions[cameraIndex];
    
    // Create VAO for a 1x1 square centered around the origin
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const a_positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, a_positionBuffer);
    const positions = new Float32Array([
        -0.5, -0.5, -0.5,
        -0.5, 0.5, -0.5,
        0.5, -0.5, -0.5,
        0.5, 0.5, -0.5,
        0.5, -0.5, -0.5,
        -0.5, 0.5, -0.5,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const a_positionLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(a_positionLoc);
    gl.vertexAttribPointer(a_positionLoc, 3, gl.FLOAT, false, 0, 0);


    // matrix uniforms
    const u_worldMatrixLoc = gl.getUniformLocation(program, "u_worldMatrix");
    const u_projectionMatrixLoc = gl.getUniformLocation(program, "u_projectionMatrix");

    // Set up the canvas
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Use our perspective 3d program to draw rectangles
    gl.useProgram(program);
    gl.bindVertexArray(vao);

    let projectionMatrix = m4.translation(-1, -1, -1);
    projectionMatrix = m4.scale(projectionMatrix, 1 / 700, 1 / 400, 1 / 15);
    gl.uniformMatrix4fv(u_projectionMatrixLoc, false, projectionMatrix);

    for (let x = 0; x < levelData.levelWidth; x++) {
        for (let y = 0; y < levelData.levelHeight; y++) {
            for (let l = 0; l < levelData.layers; l++) {
                let geom = levelData.geometryAt(x, y, l);
                if ((geom & Geometry.BLOCK_TYPE_MASK) !== Geometry.wall) continue;
    
                let matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
                
                // Shift pixels by position of camera
                //matrix = m4.translate(matrix, -cameraPos.x, -cameraPos.y, 0);
                
                // Convert to pixels
                matrix = m4.scale(matrix, 20, 20, 1);
    
                // Position in level coords
                matrix = m4.translate(matrix, x, y, l * 10);
    
                // Convert unit square to level coords
                matrix = m4.scale(matrix, 1, 1, 10);
                matrix = m4.translate(matrix, 0.5, 0.5, 0.5);
                //matrix = m4.scale(matrix, 1, -1, 1);
                // Rotation around center of grid space (for floor, ceiling, wall tiles)
                //matrix = m4.xRotate(matrix, 0);
                //matrix = m4.yRotate(matrix, 0);
                //matrix = m4.zRotate(matrix, 0);
    
                gl.uniformMatrix4fv(u_worldMatrixLoc, false, matrix);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
                
                break;
            }
        }
    }
    } catch (e) {
        alert(e);
    }
}


export default {
    init: initializeGL,
    render: render
};
