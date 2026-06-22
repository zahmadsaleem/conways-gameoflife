const std = @import("std");
const Io = std.Io;
const assert = std.debug.assert;

pub const Cell = struct {
    value: u4 = 0b0000, // 3 generations, each bit holds a generations value, g3-g2-g1-temp, temp is used for state management across generations

    fn isAlive(self: *const Cell) bool {
        return (self.value & 0b0010) == 0b0010;
    }

    fn isAliveInt(self: *const Cell) u4 {
        return (self.value & 0b0010) >> 1;
    }

    fn setAliveTemp(self: *Cell, alive: bool) void {
        if (!alive) {
            self.value = (self.value & 0b1110) << 1;
            return;
        }
        self.value = (self.value | 0b0001) << 1;
    }

    fn getGenerationLife(self: *const Cell, comptime gen: u2) bool {
        assert(gen < 3);
        const mask = 0b0010 << gen;
        return ((self.value & mask) >> gen) == 0b0010;
    }

    fn age(self: *const Cell) u2 {
        if (!self.isAlive()) {
            return 0;
        }
        switch (self.value & 0b1110) {
            0b0110 => return 2,
            0b1110 => return 3,
            else => {
                return 1;
            },
        }
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
        var neighbors: u4 = 0;

        const prev_row = (row -| 1) * self.columns;
        const current_row = row * self.columns;
        const next_row = (row + 1) * self.columns;
        const prev_col = col -| 1;
        const next_col = col + 1;
        if (row > 0) {
            if (col > 0) {
                neighbors += self.grid[prev_row + prev_col].isAliveInt();
            }
            neighbors += self.grid[prev_row + col].isAliveInt();
            if (col < self.columns - 1) {
                neighbors += self.grid[prev_row + next_col].isAliveInt();
            }
        }

        if (col > 0) {
            neighbors += self.grid[current_row + prev_col].isAliveInt();
        }
        if (col < self.columns - 1) {
            neighbors += self.grid[current_row + next_col].isAliveInt();
        }
        if (row < self.rows - 1) {
            if (col > 0) {
                neighbors += self.grid[next_row + prev_col].isAliveInt();
            }
            neighbors += self.grid[next_row + col].isAliveInt();
            if (col < self.columns - 1) {
                neighbors += self.grid[next_row + next_col].isAliveInt();
            }
        }
        return neighbors;
    }

    fn size(self: *const Playground) usize {
        return self.rows * self.columns;
    }

    pub fn valueBuffer(self: *const Playground, allocator: std.mem.Allocator, omit_history: bool) ![]u4 {
        var buff = try allocator.alloc(u4, self.rows * self.columns);
        for (0..self.size()) |i| {
            buff[i] = if (omit_history) self.grid[i].value & 0b0010 else self.grid[i].value;
        }
        return buff;
    }

    pub fn print(self: *const Playground, writer: *std.Io.Writer) !void {
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

    pub fn nextGen(self: *Playground) void {
        for (0..self.rows) |row_index| {
            for (0..self.columns) |col_index| {
                var cell = self.grid[self.cellIndex(row_index, col_index)];
                switch (self.neighborLifeCount(@intCast(row_index), @intCast(col_index))) {
                    0...1 => cell.setAliveTemp(false),
                    2 => cell.setAliveTemp(cell.isAlive()),
                    3 => cell.setAliveTemp(true),
                    else => cell.setAliveTemp(false),
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

    pub fn fromBuffer(allocator: std.mem.Allocator, rows: u32, columns: u32, buff: []u4) !Playground {
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
            playground.grid[i] = Cell{ .value = @as(u4, mycellval) << 1 };
        }
        return playground;
    }
};

test "cell value works" {
    var cell = Cell{ .value = 0b1000 };
    assert(!cell.isAlive());
    assert(cell.isAliveInt() == 0);
    assert(!cell.getGenerationLife(0));
    assert(!cell.getGenerationLife(1));
    assert(cell.getGenerationLife(2));
    cell.setAliveTemp(true);
    std.debug.print("setAliveTemp: cell value {b}\n", .{cell.value});
    assert(cell.isAlive());
    assert(cell.isAliveInt() == 1);
    try std.testing.expectEqual(1, cell.age());
    cell.setAliveTemp(true);
    try std.testing.expectEqual(2, cell.age());
    cell.setAliveTemp(false);
    assert(!cell.isAlive());
    try std.testing.expectEqual(cell.age(), 0);
}

test "playground neighbors works" {
    var stable = [_]u4{
        0b0000, 0b0010, 0b0000, // 0x0
        0b0010, 0b0000, 0b0010, // x0x
        0b0000, 0b0010, 0b0000, // 0x0
    };
    const stableSlice: []u4 = stable[0..];
    // next generation should basically be the same
    var playgound = try Playground.fromBuffer(std.testing.allocator, 3, 3, stableSlice);
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
    var stable = [_]u4{
        0b0000, 0b0010, 0b0000, // 0x0
        0b0000, 0b0010, 0b0000, // 0x0
        0b0000, 0b0010, 0b0000, // 0x0
    };
    const stableSlice: []u4 = stable[0..];
    // next generation should basically be the same
    var playgound = try Playground.fromBuffer(std.testing.allocator, 3, 3, stableSlice);
    defer playgound.deinit(std.testing.allocator);
    playgound.nextGen();
    var expected = [_]u4{
        0b0000, 0b0000, 0b0000, // 000
        0b0010, 0b0010, 0b0010, // xxx
        0b0000, 0b0000, 0b0000, // 000
    };
    const expectedSlice: []u4 = expected[0..];
    const got = try playgound.valueBuffer(std.testing.allocator, true);
    defer std.testing.allocator.free(got);
    try std.testing.expectEqualSlices(u4, expectedSlice, got);
}
