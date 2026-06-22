const std = @import("std");
const Io = std.Io;
const assert = std.debug.assert;
const game = @import("conways_gameoflife");

const CliContext = struct {
    rows: u16 = 25,
    columns: u16 = 25,
    generations: u16 = 100,
};

fn parseArgs(args: []const []const u8) !CliContext {
    var cli = CliContext{};
    for (args) |arg| {
        if (std.mem.startsWith(u8, arg, "--rows=")) {
            const num = try extractNumArg("rows", arg);
            cli.rows = num;
        }
        if (std.mem.startsWith(u8, arg, "--columns=")) {
            const num = try extractNumArg("columns", arg);
            cli.columns = num;
        }
        if (std.mem.startsWith(u8, arg, "--generations=")) {
            const num = try extractNumArg("generations", arg);
            cli.generations = num;
        }
    }
    return cli;
}

const ProgramArgsError = error{
    InvalidArg,
};

fn extractNumArg(name: []const u8, arg: []const u8) !u16 {
    if (arg.len < name.len + 3) { //-- <name> = <value>
        return ProgramArgsError.InvalidArg;
    }
    const value = arg[name.len + 3 .. arg.len];
    return std.fmt.parseInt(u16, value, 10);
}

pub fn main(init: std.process.Init) !void {
    const allocator: std.mem.Allocator = init.arena.allocator();
    const args = try init.minimal.args.toSlice(allocator);
    const cli = try parseArgs(args);
    var playground = try game.Playground.random(allocator, init.io, cli.rows, cli.columns);

    const io = init.io;
    var stdout_buffer: [1024]u8 = undefined;
    var stdout_file_writer: Io.File.Writer = .init(.stdout(), io, &stdout_buffer);
    const stdout_writer = &stdout_file_writer.interface;
    std.debug.print("running with args: #{}\n", .{cli});
    for (0..cli.generations) |_| {
        try playground.print(stdout_writer);
        try stdout_writer.flush();
        playground.nextGen();
        try std.Io.sleep(init.io, std.Io.Duration.fromMilliseconds(60), std.Io.Clock.real);
        try playground.clearPrint(stdout_writer);
    }
}
