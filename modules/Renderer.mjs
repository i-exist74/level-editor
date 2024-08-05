/**
 * Original non-webGL attempt & info about the format of the rendered level png file in renderModa.mjs.
 */
import { Geometry } from "./LevelData.mjs";

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

var m4 = {

    perspective: function (fieldOfViewInRadians, aspect, near, far) {
        var f = Math.tan(Math.PI * 0.5 - 0.5 * fieldOfViewInRadians);
        var rangeInv = 1.0 / (near - far);

        return [
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (near + far) * rangeInv, -1,
            0, 0, near * far * rangeInv * 2, 0,
        ];
    },

    projection: function (width, height, depth) {
        // Note: This matrix flips the Y axis so 0 is at the top.
        return [
            2 / width, 0, 0, 0,
            0, -2 / height, 0, 0,
            0, 0, 2 / depth, 0,
            -1, 1, 0, 1,
        ];
    },

    multiply: function (a, b) {
        var a00 = a[0 * 4 + 0];
        var a01 = a[0 * 4 + 1];
        var a02 = a[0 * 4 + 2];
        var a03 = a[0 * 4 + 3];
        var a10 = a[1 * 4 + 0];
        var a11 = a[1 * 4 + 1];
        var a12 = a[1 * 4 + 2];
        var a13 = a[1 * 4 + 3];
        var a20 = a[2 * 4 + 0];
        var a21 = a[2 * 4 + 1];
        var a22 = a[2 * 4 + 2];
        var a23 = a[2 * 4 + 3];
        var a30 = a[3 * 4 + 0];
        var a31 = a[3 * 4 + 1];
        var a32 = a[3 * 4 + 2];
        var a33 = a[3 * 4 + 3];
        var b00 = b[0 * 4 + 0];
        var b01 = b[0 * 4 + 1];
        var b02 = b[0 * 4 + 2];
        var b03 = b[0 * 4 + 3];
        var b10 = b[1 * 4 + 0];
        var b11 = b[1 * 4 + 1];
        var b12 = b[1 * 4 + 2];
        var b13 = b[1 * 4 + 3];
        var b20 = b[2 * 4 + 0];
        var b21 = b[2 * 4 + 1];
        var b22 = b[2 * 4 + 2];
        var b23 = b[2 * 4 + 3];
        var b30 = b[3 * 4 + 0];
        var b31 = b[3 * 4 + 1];
        var b32 = b[3 * 4 + 2];
        var b33 = b[3 * 4 + 3];
        return [
            b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30,
            b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31,
            b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32,
            b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33,
            b10 * a00 + b11 * a10 + b12 * a20 + b13 * a30,
            b10 * a01 + b11 * a11 + b12 * a21 + b13 * a31,
            b10 * a02 + b11 * a12 + b12 * a22 + b13 * a32,
            b10 * a03 + b11 * a13 + b12 * a23 + b13 * a33,
            b20 * a00 + b21 * a10 + b22 * a20 + b23 * a30,
            b20 * a01 + b21 * a11 + b22 * a21 + b23 * a31,
            b20 * a02 + b21 * a12 + b22 * a22 + b23 * a32,
            b20 * a03 + b21 * a13 + b22 * a23 + b23 * a33,
            b30 * a00 + b31 * a10 + b32 * a20 + b33 * a30,
            b30 * a01 + b31 * a11 + b32 * a21 + b33 * a31,
            b30 * a02 + b31 * a12 + b32 * a22 + b33 * a32,
            b30 * a03 + b31 * a13 + b32 * a23 + b33 * a33,
        ];
    },

    translation: function (tx, ty, tz) {
        return [
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            tx, ty, tz, 1,
        ];
    },

    xRotation: function (angleInRadians) {
        var c = Math.cos(angleInRadians);
        var s = Math.sin(angleInRadians);

        return [
            1, 0, 0, 0,
            0, c, s, 0,
            0, -s, c, 0,
            0, 0, 0, 1,
        ];
    },

    yRotation: function (angleInRadians) {
        var c = Math.cos(angleInRadians);
        var s = Math.sin(angleInRadians);

        return [
            c, 0, -s, 0,
            0, 1, 0, 0,
            s, 0, c, 0,
            0, 0, 0, 1,
        ];
    },

    zRotation: function (angleInRadians) {
        var c = Math.cos(angleInRadians);
        var s = Math.sin(angleInRadians);

        return [
            c, s, 0, 0,
            -s, c, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1,
        ];
    },

    scaling: function (sx, sy, sz) {
        return [
            sx, 0, 0, 0,
            0, sy, 0, 0,
            0, 0, sz, 0,
            0, 0, 0, 1,
        ];
    },

    translate: function (m, tx, ty, tz) {
        return m4.multiply(m, m4.translation(tx, ty, tz));
    },

    xRotate: function (m, angleInRadians) {
        return m4.multiply(m, m4.xRotation(angleInRadians));
    },

    yRotate: function (m, angleInRadians) {
        return m4.multiply(m, m4.yRotation(angleInRadians));
    },

    zRotate: function (m, angleInRadians) {
        return m4.multiply(m, m4.zRotation(angleInRadians));
    },

    scale: function (m, sx, sy, sz) {
        return m4.multiply(m, m4.scaling(sx, sy, sz));
    },

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
function render(levelData, cameraIndex) {
    // Create VAO for a 1x1 rectangle centered around the origin
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
    
                // Convert to pixels
                matrix = m4.scale(matrix, 20, -20, 1);
    
                // Position in level coords
                matrix = m4.translate(matrix, x, y, l * 10);
    
                // Convert to level coords
                matrix = m4.scale(matrix, 1, 1, 10);
                matrix = m4.translate(matrix, 0.5, 0.5, 0.5);
    
                // Rotation around center of grid space (for floor, ceiling, wall tiles)
                matrix = m4.xRotate(matrix, 0);
                matrix = m4.yRotate(matrix, 0);
                matrix = m4.zRotate(matrix, 0);
    
                gl.uniformMatrix4fv(u_worldMatrixLoc, false, matrix);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
                
                break;
            }
        }
    }
}


export default {
    init: initializeGL,
    render: render
};
