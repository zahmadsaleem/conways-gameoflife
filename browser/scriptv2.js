const PIXEL_SIZE = 10;
const PADDING = 25;
const CANVAS_WIDTH = Math.floor((window.innerWidth - PADDING) / PIXEL_SIZE) * PIXEL_SIZE;
const CANVAS_HEIGHT = Math.floor((window.innerHeight - PADDING) / PIXEL_SIZE) * PIXEL_SIZE;

const canvas = document.getElementById("canvas");
canvas.height = CANVAS_HEIGHT;
canvas.width = CANVAS_WIDTH;
const GRID_ROWS = CANVAS_HEIGHT / PIXEL_SIZE;
const GRID_COLUMNS = CANVAS_WIDTH / PIXEL_SIZE;
const GRID_SIZE = GRID_ROWS * GRID_COLUMNS;
console.dir({ CANVAS_HEIGHT, CANVAS_WIDTH, PIXEL_SIZE, GRID_ROWS, GRID_COLUMNS, GRID_SIZE });

if (!navigator.gpu) {
  throw new Error("WebGPU is not supported on this browser.");
}


(async () => {
  const adapter = await navigator.gpu.requestAdapter();

  if (!adapter) {
    throw new Error("No WebGPU adapter found.");
  }

  const device = await adapter.requestDevice();

  const context = canvas.getContext("webgpu");
  const format = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device,
    format,
    alphaMode: "opaque",
  });

  const [vertexSource, fragmentSource] = await Promise.all([
    fetch("./vertex.wgsl").then((res) => res.text()),
    fetch("./fragment.wgsl").then((res) => res.text()),
  ]);

  const vertexModule = device.createShaderModule({
    code: vertexSource,
  });

  const fragmentModule = device.createShaderModule({
    code: fragmentSource,
  });



  const positions = new Uint32Array(Array(GRID_SIZE).fill(0).map((_, i) => i));

  const rand = Array(GRID_SIZE).fill(0).map(() => Math.round(Math.random()));
  const G = window.G;
  G.init(GRID_ROWS, GRID_COLUMNS, rand);
  const states = G.current();

  const pointCount = positions.length;
  const verticesPerPoint = 6;

  function createBuffer(device, data, usage) {
    const buffer = device.createBuffer({
      size: data.byteLength,
      usage: usage | GPUBufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(buffer, 0, data);

    return buffer;
  }

  const positionBuffer = createBuffer(
    device,
    positions,
    GPUBufferUsage.VERTEX
  );

  const stateBuffer = createBuffer(
    device,
    states,
    GPUBufferUsage.VERTEX
  );

  // resolution.x, resolution.y, pointSize, padding
  const uniformData = new Uint32Array([
    canvas.width,
    canvas.height,
    PIXEL_SIZE,
    0,
    GRID_COLUMNS,
    GRID_ROWS
  ]);

  const uniformBuffer = createBuffer(
    device,
    uniformData,
    GPUBufferUsage.UNIFORM
  );

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: {
          type: "uniform",
        },
      },
    ],
  });

  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: {
          buffer: uniformBuffer,
        },
      },
    ],
  });

  const pipeline = device.createRenderPipeline({
    layout: pipelineLayout,

    vertex: {
      module: vertexModule,
      entryPoint: "main",
      buffers: [
        {
          arrayStride: 4,// ?what is this?
          stepMode: "instance",
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: "uint32",
            },
          ],
        },
        {
          arrayStride: 4,
          stepMode: "instance",
          attributes: [
            {
              shaderLocation: 1,
              offset: 0,
              format: "uint32",
            },
          ],
        },
      ],
    },

    fragment: {
      module: fragmentModule,
      entryPoint: "main",
      targets: [
        {
          format,
        },
      ],
    },

    primitive: {
      topology: "triangle-list",
    },
  });

  function draw() {
    uniformData[0] = canvas.width;
    uniformData[1] = canvas.height;
    uniformData[2] = PIXEL_SIZE;
    uniformData[3] = 0;
    uniformData[4] = GRID_COLUMNS;
    uniformData[5] = GRID_ROWS;

    device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    const encoder = device.createCommandEncoder();

    const renderPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: {
            r: 0.08,
            g: 0.08,
            b: 0.08,
            a: 1.0,
          },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    renderPass.setPipeline(pipeline);
    renderPass.setBindGroup(0, bindGroup);

    renderPass.setVertexBuffer(0, positionBuffer);
    renderPass.setVertexBuffer(1, stateBuffer);

    renderPass.draw(verticesPerPoint, pointCount);

    renderPass.end();

    device.queue.submit([encoder.finish()]);

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
})();
