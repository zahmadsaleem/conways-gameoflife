const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const mod = b.addModule("lib_coglife", .{
        .root_source_file = b.path("src/root.zig"),
        .target = target,
    });

    const exe = b.addExecutable(.{
        .name = "coglife",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .error_tracing = true,
            .target = target,
            .optimize = optimize,
            .imports = &.{
                .{ .name = "lib_coglife", .module = mod },
            },
        }),
    });

    // TODO: webgpu engine for neigbor calc

    // https://github.com/zig-gamedev/zgpu#getting-started
    // const zgpu = b.dependency("zgpu", .{});
    // exe.root_module.addImport("zgpu", zgpu.module("root"));
    //
    // // Adds platform-specific library search paths and links the
    // // prebuilt dawn library to the executable.
    // @import("zgpu").addLibraryPathsTo(exe);
    //
    // // Link the zdawn C/C++ wrapper artifact.
    // // exe.linkLibrary(zgpu.artifact("zdawn"));
    // b.installArtifact(exe);

    const run_step = b.step("run", "Run the app");

    const run_cmd = b.addRunArtifact(exe);
    run_step.dependOn(&run_cmd.step);

    run_cmd.step.dependOn(b.getInstallStep());

    if (b.args) |args| {
        run_cmd.addArgs(args);
    }

    const mod_tests = b.addTest(.{
        .root_module = mod,
    });

    const run_mod_tests = b.addRunArtifact(mod_tests);

    const exe_tests = b.addTest(.{
        .root_module = exe.root_module,
    });

    const run_exe_tests = b.addRunArtifact(exe_tests);

    const test_step = b.step("test", "Run tests");
    test_step.dependOn(&run_mod_tests.step);
    test_step.dependOn(&run_exe_tests.step);
    const wasm_target = b.resolveTargetQuery(.{
        .cpu_arch = .wasm32,
        .os_tag = .freestanding,
    });
    const wasm = b.addExecutable(.{
        .name = "coglife_wasm",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/wasm.zig"),
            .target = wasm_target,
            .optimize = optimize,
            .imports = &.{
                .{ .name = "lib", .module = mod },
            },
        }),
    });

    wasm.entry = .disabled;
    wasm.root_module.export_symbol_names = &[_][]const u8{
        "playground_init",
        "playground_destroy",
        "playground_grid",
        "playground_nextgen",
        "alloc_u8",
        "free_u8",
        "last_error_message_ptr",
        "last_error_message_len",
        "last_error_code",
    };
    b.installArtifact(wasm);
}
