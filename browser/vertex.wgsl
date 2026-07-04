struct Uniforms {
    resolution: vec2<f32>,
    pointSize: f32,
    _pad: f32,
};

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;

struct VertexInput {
    @builtin(vertex_index) vertexIndex: u32,

    // Per-instance pixel position.
    @location(0) position: vec2<f32>,

    // WebGPU has no uint8 scalar vertex format.
    // Use uint8x4 and read .x as the state.
    @location(1) stateBytes: vec4<u32>,
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
        vec2<f32>( 0.5, -0.5),
        vec2<f32>(-0.5,  0.5),

        vec2<f32>(-0.5,  0.5),
        vec2<f32>( 0.5, -0.5),
        vec2<f32>( 0.5,  0.5)
    );

    let corner = corners[input.vertexIndex];
    let pixelPosition = input.position + corner * uniforms.pointSize;

    let zeroToOne = pixelPosition / uniforms.resolution;
    let zeroToTwo = zeroToOne * 2.0;
    let ndc = zeroToTwo - vec2<f32>(1.0, 1.0);

    var output: VertexOutput;
    output.clipPosition = vec4<f32>(ndc * vec2<f32>(1.0, -1.0), 0.0, 1.0);
    output.state = input.stateBytes.x;

    return output;
}
