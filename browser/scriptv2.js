const G = window.G;

const canvas = document.getElementById("canvas");

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

  const positions = new Float32Array([
    100.0, 100.0,
    300.0, 200.0,
    500.0, 300.0,
  ]);

  // WebGPU does not support uint8x1 as a vertex format.
  // Use uint8x4 and store the state in the first byte of each 4-byte record.
  const states = new Uint8Array([
    0, 0, 0, 0,
    1, 0, 0, 0,
    0, 0, 0, 0,
  ]);

  const pointCount = positions.length / 2;
  const verticesPerPoint = 6;
  const pointSize = 16.0;

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
  const uniformData = new Float32Array([
    canvas.width,
    canvas.height,
    pointSize,
    0.0,
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
          arrayStride: 8,
          stepMode: "instance",
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: "float32x2",
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
              format: "uint8x4",
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
    uniformData[2] = pointSize;

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
