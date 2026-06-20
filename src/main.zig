const std = @import("std");
const Io = std.Io;
const assert = std.debug.assert;

const conways_gameoflife = @import("conways_gameoflife");

const Cell = struct {
    value: u4 = 0b0000, // 4 generations, each bit holds a generations value, latest says if alive or not

    fn isAlive(self: *const Cell) bool {
        return (self.value & 0b0001) == 0b0001;
    }

    fn setAlive(self: *Cell, alive: bool) void {
        if (!alive) {
            self.value = self.value << 1;
            assert(!self.isAlive());
            return;
        }
        self.value = (self.value << 1) + 1;
        assert(self.isAlive());
    }

    fn getGenerationLife(self: *Cell, comptime gen: u2) bool {
        const mask = 0b0001 << gen;
        return ((self.value & mask) >> gen) == 0b0001;
    }

    fn age(self: *Cell) u3 {
        if (!self.isAlive()) {
            return 0;
        }
        switch (self.value & 0b1111) {
            0b0011 => return 2,
            0b0111 => return 3,
            0b1111 => return 4,
            else => {
                return 1;
            },
        }
    }
};

const Playground = struct {
    rows: u16,
    columns: u16,
    grid: []Cell,

    fn neighborLifeCount(self: *Playground, row: u16, col: u16) u4 {
        assert(self.rows > row);
        assert(self.columns > col);
        const indices = [8][2]u16{
            [2]u16{ -1, -1 }, [2]u16{ -1, 0 }, [2]u16{ -1, 1 }, // previous row
            [2]u16{ 0, -1 }, [2]u16{ 0, 1 }, // current row
            [2]u16{ 1, -1 }, [2]u16{ 1, 0 }, [2]u16{ 1, 1 }, // next row
        };
        var neighbors: u4 = 0;
        for (indices) |i| {
            if (row == 0 and i[0] == -1) {
                continue;
            }
            if (col == 0 and i[1] == -1) {
                continue;
            }
            if (row == self.rows - 1 and i[0] == 1) {
                continue;
            }
            if (col == self.columns and i[1] == 1) {
                continue;
            }
            const row_index = row + i[0];
            const col_index = col + i[1];
            if (self.grid[row_index * self.columns + col_index].isAlive()) {
                neighbors += 1;
            }
        }
        return neighbors;
    }

    fn print(self: *Playground, writer: *std.Io.Writer) !void {
        for (0..self.rows) |row_index| {
            if (row_index > 0) {
                try writer.printAsciiChar('\n', std.fmt.Options{});
            }
            for (0..self.columns) |col_index| {
                const cell = self.grid[row_index * self.columns + col_index];
                const display: u16 = switch (cell.isAlive()) {
                    false => ' ',
                    true => '\u{259f}',
                };
                try writer.printUnicodeCodepoint(display);
            }
        }
        try writer.printAsciiChar('\n', std.fmt.Options{});
    }
};

fn randomCell(r: *std.Random.Xoshiro256) u2 {
    return r.random().uintAtMost(u1, 1);
}

pub fn main(init: std.process.Init) !void {
    var r = std.Random.DefaultPrng.init(99);
    const arena: std.mem.Allocator = init.arena.allocator();
    const rows = 10;
    const columns = 10;
    var buff: [rows * columns]Cell = undefined;
    var playground = Playground{ .rows = rows, .columns = columns, .grid = &buff };
    for (0..rows * columns) |i| {
        const mycellval = randomCell(&r);
        playground.grid[i] = Cell{ .value = @as(u4, mycellval) };
    }

    // Accessing command line arguments:
    const args = try init.minimal.args.toSlice(arena);
    for (args) |arg| {
        std.log.info("arg: {s}", .{arg});
    }

    // In order to do I/O operations need an `Io` instance.
    const io = init.io;

    // Stdout is for the actual output of your application, for example if you
    // are implementing gzip, then only the compressed bytes should be sent to
    // stdout, not any debugging messages.
    var stdout_buffer: [1024]u8 = undefined;
    var stdout_file_writer: Io.File.Writer = .init(.stdout(), io, &stdout_buffer);
    const stdout_writer = &stdout_file_writer.interface;
    try playground.print(stdout_writer);

    try stdout_writer.flush(); // Don't forget to flush!
}

test "simple test" {
    const gpa = std.testing.allocator;
    var list: std.ArrayList(i32) = .empty;
    defer list.deinit(gpa); // Try commenting this out and see if zig detects the memory leak!
    try list.append(gpa, 42);
    try std.testing.expectEqual(@as(i32, 42), list.pop());
}

test "cell value works" {
    var cell = Cell{ .value = 0b0100 };
    assert(!cell.isAlive());
    assert(!cell.getGenerationLife(0));
    assert(!cell.getGenerationLife(1));
    assert(cell.getGenerationLife(2));
    assert(!cell.getGenerationLife(3));
    cell.setAlive(true);
    assert(cell.age() == 1);
    cell.setAlive(false);
    assert(cell.age() == 0);
}
