const std = @import("std");
const Io = std.Io;
const assert = std.debug.assert;
const game = @import("conways_gameoflife");

fn randomCell(r: *std.Random.Xoshiro256) u2 {
    return r.random().uintAtMost(u1, 1);
}

pub fn main(init: std.process.Init) !void {
    var r = std.Random.DefaultPrng.init(@intCast(std.Io.Clock.real.now(init.io).toMilliseconds()));

    const arena: std.mem.Allocator = init.arena.allocator();
    const args = try init.minimal.args.toSlice(arena);
    for (args) |arg| {
        std.log.info("arg: {s}", .{arg});
    }

    const rows = 10;
    const columns = 10;
    var buff: [rows * columns]game.Cell = undefined;
    var playground = game.Playground{ .rows = rows, .columns = columns, .grid = &buff };
    for (0..rows * columns) |i| {
        const mycellval = randomCell(&r);
        playground.grid[i] = game.Cell{ .value = @as(u4, mycellval) << 1 };
    }

    const io = init.io;
    var stdout_buffer: [1024]u8 = undefined;
    var stdout_file_writer: Io.File.Writer = .init(.stdout(), io, &stdout_buffer);
    const stdout_writer = &stdout_file_writer.interface;

    for (0..100) |_| {
        try playground.print(stdout_writer);
        try stdout_writer.flush();
        playground.nextGen();
        try std.Io.sleep(init.io, std.Io.Duration.fromMilliseconds(1000), std.Io.Clock.real);
        try playground.clearPrint(stdout_writer);
    }
}
