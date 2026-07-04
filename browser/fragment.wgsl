struct FragmentInput {
    @location(0) @interpolate(flat)
    state: u32,
};

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
    if (input.state == 0u) {
        return vec4<f32>(1.0, 0.3, 0.0, 1.0);
    } else if (input.state == 1u) {
        return vec4<f32>(0.0, 0.8, 1.0, 1.0);
    }

    return vec4<f32>(0.5, 0.5, 0.5, 1.0);
}
