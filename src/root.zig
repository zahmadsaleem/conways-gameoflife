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

    fn neighborLifeCount(self: *const Playground, row: u32, col: u32) u4 {
        assert(self.rows > row);
        assert(self.columns > col);
        const has_prev_row: u32 = @intFromBool(row > 0);
        const has_next_row: u32 = @intFromBool(row + 1 < self.rows);
        const has_prev_col: u32 = @intFromBool(col > 0);
        const has_next_col: u32 = @intFromBool(col + 1 < self.columns);
        var neighbors: u32 = 0;
        neighbors += self.grid[((row -| 1) * self.columns + col -| 1) * (has_prev_row & has_prev_col)].value * (has_prev_row & has_prev_col);
        neighbors += self.grid[((row -| 1) * self.columns + col) * (has_prev_row)].value * (has_prev_row);
        neighbors += self.grid[((row -| 1) * self.columns + col + 1) * (has_prev_row & has_next_col)].value * (has_prev_row & has_next_col);

        neighbors += self.grid[((row) * self.columns + col -| 1) * (has_prev_col)].value * (has_prev_col);
        neighbors += self.grid[((row) * self.columns + col + 1) * (has_next_col)].value * (has_next_col);

        neighbors += self.grid[((row + 1) * self.columns + col -| 1) * (has_next_row & has_prev_col)].value * (has_next_row & has_prev_col);
        neighbors += self.grid[((row + 1) * self.columns + col) * (has_next_row)].value * (has_next_row);
        neighbors += self.grid[((row + 1) * self.columns + col + 1) * (has_next_row & has_next_col)].value * (has_next_row & has_next_col);

        return @intCast(neighbors);
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
