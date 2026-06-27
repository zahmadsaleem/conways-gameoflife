const std = @import("std");
const Io = std.Io;
const assert = std.debug.assert;
const game = @import("lib_coglife");

const CliContext = struct {
    rows: u16 = 25,
    columns: u16 = 25,
    generations: u16 = 100,
    disable_render: bool = false,
    sleep_ms: u8 = 60,
    seed_file: ?[]const u8 = null,
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
        if (std.mem.eql(u8, arg, "--no-render")) {
            cli.disable_render = true;
        }
        if (std.mem.startsWith(u8, arg, "--sleep=")) {
            cli.sleep_ms = @intCast(try extractNumArg("sleep", arg));
        }
        if (std.mem.startsWith(u8, arg, "--seed=")) {
            cli.seed_file = arg["--seed=".len..];
        }
    }
    return cli;
}

const ProgramArgsError = error{
    InvalidArg,
};

const ProgramError = error{
    FileOpenFailed,
    FileTooBig,
    GridColumnMismatch,
    InvalidGridValue,
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
    const io = init.io;
    var playground: game.Playground = undefined;
    if (cli.seed_file != null) {
        const file = std.Io.Dir.openFile(std.Io.Dir.cwd(), io, cli.seed_file.?, .{}) catch {
            return ProgramError.FileOpenFailed;
        };
        defer file.close(io);
        var buff: [1024]u8 = undefined;
        const n = file.readPositionalAll(io, &buff, 0) catch {
            return ProgramError.FileTooBig;
        };
        var inputBuff = try std.ArrayList(u1).initCapacity(allocator, cli.rows * cli.columns);
        for (buff[0..n]) |i| {
            var value: u1 = 0;
            switch (i) {
                '\n' => continue,
                '-' => value = 0, // dead
                '0' => value = 1, // alive
                else => {
                    return ProgramError.InvalidGridValue;
                },
            }
            try inputBuff.append(allocator, value);
        }
        const u1buff = try inputBuff.toOwnedSlice(allocator);
        if (cli.columns * cli.rows != u1buff.len) {
            return ProgramError.GridColumnMismatch;
        }
        inputBuff.deinit(allocator);
        playground = try game.Playground.fromBuffer(allocator, cli.rows, cli.columns, u1buff);
        allocator.free(u1buff);
    } else {
        playground = try game.Playground.random(allocator, init.io, cli.rows, cli.columns);
    }
    var stdout_buffer: [1024]u8 = undefined;
    var stdout_file_writer: Io.File.Writer = .init(.stdout(), io, &stdout_buffer);
    const stdout_writer = &stdout_file_writer.interface;
    std.debug.print("running with args: #{}\n", .{cli});
    for (0..cli.generations) |_| {
        if (!cli.disable_render) {
            try playground.print(stdout_writer);
            try stdout_writer.flush();
        }
        playground.nextGen();
        if (cli.sleep_ms > 0) {
            try std.Io.sleep(init.io, std.Io.Duration.fromMilliseconds(cli.sleep_ms), std.Io.Clock.real);
        }
        if (cli.disable_render) continue;
        try playground.clearPrint(stdout_writer);
    }
}
