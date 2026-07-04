/*
LANES:  ◄─────────── LANE 1 ───────────► ◄─────────── LANE 2 ───────────► ◄─────────── LANE 3 ───────────►
MEMORY ADDRESS:  0   1   2   3   4   5   6   7    8   9   10  11  12  13  14  15   16  17  18  19  20  21  22  23
                ┌───────────────────────────────┬───────────────┬───────────────┬───────────────────────────────┐
                │          resolution           │   pointSize   │  [ PADDING ]  │           gridSize            │
                │          (vec2<f32>)          │     (f32)     │   (4 bytes)   │          (vec2<u32>)          │
                └───────────────────────────────┴───────────────┴───────────────┴───────────────────────────────┘
*/
struct Uniforms {
    resolution: vec2<u32>,
    pointSize: u32,
    _pad: u32,
    gridSize: vec2<u32>,
}; 

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;

struct VertexInput {
    @builtin(vertex_index) vertexIndex: u32,

    // Per-instance pixel position.
    @location(0) position: u32,
    @location(1) state: u32,
};

struct VertexOutput {
    @builtin(position) clipPosition: vec4<f32>,
    @location(0) @interpolate(flat)
    state: u32,
};

@vertex
fn main(input: VertexInput) -> VertexOutput {
    var corners = array<vec2<f32>, 6>(
        vec2<f32>(-0.5, -0.5),
        vec2<f32>(0.5, -0.5),
        vec2<f32>(-0.5, 0.5),
//
        vec2<f32>(-0.5, 0.5),
        vec2<f32>(0.5, -0.5),
        vec2<f32>(0.5, 0.5)
    );

    let corner = corners[input.vertexIndex];
    let position = vec2<f32>(f32(input.position / uniforms.gridSize.y), f32(input.position % uniforms.gridSize.x));
    let pixelPosition = position + corner * f32(uniforms.pointSize);

    let zeroToOne = pixelPosition / vec2<f32>(f32(uniforms.resolution.x), f32(uniforms.resolution.y));
    let zeroToTwo = zeroToOne * 2.0;
    let ndc = zeroToTwo - vec2<f32>(1.0, 1.0);

    var output: VertexOutput;
    output.clipPosition = vec4<f32>(ndc * vec2<f32>(1.0, -1.0), 0.0, 1.0);
    output.state = input.state;

    return output;
}
