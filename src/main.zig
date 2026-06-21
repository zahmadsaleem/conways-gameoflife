const std = @import("std");
const Io = std.Io;
const assert = std.debug.assert;
const game = @import("conways_gameoflife");

pub fn main(init: std.process.Init) !void {
    const allocator: std.mem.Allocator = init.arena.allocator();
    const args = try init.minimal.args.toSlice(allocator);
    for (args) |arg| {
        std.log.info("arg: {s}", .{arg});
    }

    const rows = 10;
    const columns = 10;
    var playground = try game.Playground.random(allocator, init.io, rows, columns);

    const io = init.io;
    var stdout_buffer: [1024]u8 = undefined;
    var stdout_file_writer: Io.File.Writer = .init(.stdout(), io, &stdout_buffer);
    const stdout_writer = &stdout_file_writer.interface;

    for (0..100) |_| {
        try playground.print(stdout_writer);
        try stdout_writer.flush();
        playground.nextGen();
        try std.Io.sleep(init.io, std.Io.Duration.fromMilliseconds(60), std.Io.Clock.real);
        try playground.clearPrint(stdout_writer);
    }
}
