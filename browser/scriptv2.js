const G = window.G;

const canvas = document.getElementById("canvas");
const gl = canvas.getContext("webgl2");

if (!gl) {
    throw new Error("WebGL 2 not supported on this browser!");
}

const vsSource = `#version 300 es
    in vec2 a_position;
    in uint a_state;

    uniform vec2 u_resolution;

    flat out uint v_state;

    void main() {
        vec2 zeroToOne = a_position / u_resolution;
        vec2 zeroToTwo = zeroToOne * 2.0;
        vec2 ndcSpace = zeroToTwo - 1.0;

        gl_Position = vec4(ndcSpace * vec2(1.0, -1.0), 0.0, 1.0);
        gl_PointSize = 5.0;

        v_state = a_state;
    }
`;

const fsSource = `#version 300 es
    precision mediump float;
    precision mediump int;

    flat in uint v_state;

    out vec4 fragColor;

    void main() {
        if (v_state == 0u) {
            fragColor = vec4(1.0, 0.3, 0.0, 1.0);
        } else if (v_state == 1u) {
            fragColor = vec4(0.0, 0.8, 1.0, 1.0);
        } else {
            fragColor = vec4(0.5, 0.5, 0.5, 1.0);
        }
    }
`;

function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(info);
    }

    return shader;
}

const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vsSource);
const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);

const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);

if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program));
}

const posLocation = gl.getAttribLocation(program, "a_position");
const stateLocation = gl.getAttribLocation(program, "a_state");
const resolutionUniformLocation = gl.getUniformLocation(program, "u_resolution");

const positions = new Float32Array([
    0.0, 0.0,
    100.0, 100.0,
  120,120,
]);

const states = new Uint8Array([
    0,
  0,
  1
]);

const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

const stateBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, stateBuffer);
gl.bufferData(gl.ARRAY_BUFFER, states, gl.STATIC_DRAW);

const vao = gl.createVertexArray();
gl.bindVertexArray(vao);

gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.vertexAttribPointer(posLocation, 2, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(posLocation);

gl.bindBuffer(gl.ARRAY_BUFFER, stateBuffer);
gl.vertexAttribIPointer(stateLocation, 1, gl.UNSIGNED_BYTE, 0, 0);
gl.enableVertexAttribArray(stateLocation);

gl.bindVertexArray(null);

function draw() {
    gl.viewport(0, 0, canvas.width, canvas.height);

    gl.clearColor(0.08, 0.08, 0.08, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);

    gl.uniform2f(
        resolutionUniformLocation,
        canvas.width,
        canvas.height
    );

    gl.bindVertexArray(vao);
    gl.drawArrays(gl.POINTS, 0, positions.length/2);

    requestAnimationFrame(draw);
}

requestAnimationFrame(draw);
