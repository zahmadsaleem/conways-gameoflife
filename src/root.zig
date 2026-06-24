const std = @import("std");
const Io = std.Io;
const assert = std.debug.assert;

pub const Cell = struct {
    value: u1 = 0,

    fn setAlive(self: *Cell, alive: bool) void {
        self.value = @intFromBool(alive);
    }
};

pub const Playground = struct {
    rows: u32,
    columns: u32,
    grid: []Cell,
    swap: []Cell = undefined,

    fn neighborLifeCount(self: *const Playground, row: i64, col: i64) u4 {
        assert(self.rows > row);
        assert(self.columns > col);
        var neighbors: u4 = 0;
        for ([_]struct { i64, i64 }{
            .{ row - 1, col - 1 }, .{ row - 1, col },     .{ row - 1, col + 1 },
            .{ row, col - 1 },     .{ row, col + 1 },     .{ row + 1, col - 1 },
            .{ row + 1, col },     .{ row + 1, col + 1 },
        }) |index| {
            if (index[0] < 0 or index[1] < 0 or index[0] >= self.rows or index[1] >= self.columns) {
                continue;
            }
            neighbors += self.grid[@intCast(index[0] * self.columns + index[1])].value;
            if (neighbors > 3) break;
        }
        return neighbors;
    }

    pub fn print(self: *const Playground, writer: *std.Io.Writer) !void {
        for (0..self.rows) |row_index| {
            if (row_index > 0) {
                try writer.printAsciiChar('\n', std.fmt.Options{});
            }
            for (0..self.columns) |col_index| {
                const cell = self.grid[row_index * self.columns + col_index];
                const display: u16 = switch (cell.value) {
                    0 => ' ',
                    1 => '\u{259f}',
                };
                try writer.printUnicodeCodepoint(display);
            }
        }
        try writer.printAsciiChar('\n', std.fmt.Options{});
    }

    pub fn nextGen(self: *Playground) void {
        for (0..self.rows) |row_index| {
            for (0..self.columns) |col_index| {
                var cell = self.grid[self.cellIndex(row_index, col_index)];
                switch (self.neighborLifeCount(@intCast(row_index), @intCast(col_index))) {
                    0...1 => cell.setAlive(false),
                    2 => {},
                    3 => cell.setAlive(true),
                    else => cell.setAlive(false),
                }
                self.swap[self.cellIndex(row_index, col_index)] = cell;
            }
        }
        const temp = self.grid;
        self.grid = self.swap;
        self.swap = temp;
    }

    fn cellIndex(self: *const Playground, row_index: usize, col_index: usize) usize {
        return row_index * self.columns + col_index;
    }

    //
    // 1. Print multiline block once.
    // 2. Remember how many terminal rows it used.
    // 3. On the next update, move the cursor back up that many rows.
    // 4. Clear those rows.
    // 5. Print the new content in the same space.
    //
    // \x1b[{n}F   move cursor up n lines, to column 0
    // \x1b[{n}A   move cursor up n lines, same column
    // \x1b[2K     clear the current line
    // \x1b[J      clear from cursor to end of screen
    // \x1b[?25l   hide cursor
    // \x1b[?25h   show cursor

    pub fn clearPrint(self: *const Playground, w: *std.Io.Writer) !void {
        try w.print("\x1b[{d}F", .{self.rows});
        for (0..self.rows) |_| {
            try w.print("\x1b[2K\n", .{});
        }
        try w.print("\x1b[{d}F", .{self.rows});
    }

    pub fn deinit(self: *Playground, allocator: std.mem.Allocator) void {
        allocator.free(self.grid);
        allocator.free(self.swap);
    }

    pub fn new(allocator: std.mem.Allocator, rows: u32, columns: u32) !Playground {
        const grid = try allocator.alloc(Cell, rows * columns);
        const swap = try allocator.alloc(Cell, rows * columns);
        return Playground{ .rows = rows, .columns = columns, .grid = grid, .swap = swap };
    }

    pub fn fromBuffer(allocator: std.mem.Allocator, rows: u32, columns: u32, buff: []u1) !Playground {
        assert(buff.len == rows * columns);
        const playground = try Playground.new(allocator, rows, columns);
        for (0..rows * columns) |pos| {
            playground.grid[pos].value = buff[pos];
        }
        return playground;
    }

    pub fn random(allocator: std.mem.Allocator, io: std.Io, rows: u32, columns: u32) !Playground {
        var r = std.Random.DefaultPrng.init(@intCast(std.Io.Clock.real.now(io).toMilliseconds()));

        var playground = try Playground.new(allocator, rows, columns);
        for (0..rows * columns) |i| {
            const mycellval = r.random().uintAtMost(u1, 1);
            playground.grid[i] = Cell{ .value = mycellval };
        }
        return playground;
    }
};

test "playground neighbors works" {
    var stable = [_]u1{
        0, 1, 0, // 0x0
        1, 0, 1, // x0x
        0, 1, 0, // 0x0
    };
    // next generation should basically be the same
    var playgound = try Playground.fromBuffer(std.testing.allocator, 3, 3, stable[0..]);
    defer playgound.deinit(std.testing.allocator);
    try std.testing.expectEqual(2, playgound.neighborLifeCount(0, 0));
    try std.testing.expectEqual(2, playgound.neighborLifeCount(0, 1));
    try std.testing.expectEqual(2, playgound.neighborLifeCount(0, 2));
    try std.testing.expectEqual(2, playgound.neighborLifeCount(1, 0));
    try std.testing.expectEqual(4, playgound.neighborLifeCount(1, 1));
    try std.testing.expectEqual(2, playgound.neighborLifeCount(1, 2));
    try std.testing.expectEqual(2, playgound.neighborLifeCount(2, 0));
    try std.testing.expectEqual(2, playgound.neighborLifeCount(2, 1));
    try std.testing.expectEqual(2, playgound.neighborLifeCount(2, 2));
}

test "playground next generation works" {
    var stable = [_]u1{
        0, 1, 0, // 0x0
        0, 1, 0, // 0x0
        0, 1, 0, // 0x0
    };
    const stableSlice: []u1 = stable[0..];
    // next generation should basically be the same
    var playgound = try Playground.fromBuffer(std.testing.allocator, 3, 3, stableSlice);
    defer playgound.deinit(std.testing.allocator);
    playgound.nextGen();
    var expected = [_]u1{
        0, 0, 0, // 000
        1, 1, 1, // 111
        0, 0, 0, // 000
    };
    var playgound2 = try Playground.fromBuffer(std.testing.allocator, 3, 3, expected[0..]);
    defer playgound2.deinit(std.testing.allocator);
    try std.testing.expectEqualSlices(Cell, playgound2.grid, playgound.grid);
}
