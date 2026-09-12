const std = @import("std");
const Io = std.Io;
const assert = std.debug.assert;

pub const Cell = struct {
    value: u8 = 0,

    fn nextCell(self: *const Cell, neigborCount: u8) Cell {
        assert(neigborCount <= 8);
        switch (neigborCount) {
            0...1 => return Cell{ .value = 0 },
            2 => return Cell{ .value = self.value },
            3 => return Cell{ .value = 1 },
            else => return Cell{ .value = 0 },
        }
    }
};

pub const Playground = struct {
    rows: u32,
    columns: u32,
    grid: [][]Cell,
    swap: [][]Cell = undefined,

    fn setNeigborsCorners(self: *Playground) void {
        self.swap[0][0] = self.grid[0][0].nextCell(self.grid[0][1].value +
            self.grid[1][1].value + self.grid[1][0].value);
        self.swap[0][self.columns - 1] = self.grid[0][self.columns - 1].nextCell(self.grid[0][self.columns - 2].value +
            self.grid[1][self.columns - 1].value + self.grid[1][self.columns - 2].value);
        self.swap[self.rows - 1][self.columns - 1] = self.grid[self.rows - 1][self.columns - 1].nextCell(self.grid[self.rows - 2][self.columns - 2].value + self.grid[self.rows - 2][self.columns - 1].value +
            self.grid[self.rows - 1][self.columns - 2].value);
        self.swap[self.rows - 1][0] = self.grid[self.rows - 1][0].nextCell(self.grid[self.rows - 2][0].value + self.grid[self.rows - 2][1].value +
            self.grid[self.rows - 1][1].value);
    }

    fn setNeighborsFirstRowInner(self: *Playground) void {
        const current_row = self.grid[0];
        const next_row = self.grid[1];
        for (1..self.columns - 1) |col| {
            var cell = current_row[col];
            const neighbors = current_row[col - 1].value + current_row[col + 1].value +
                next_row[col - 1].value + next_row[col].value + next_row[col + 1].value;
            self.swap[0][col] = cell.nextCell(neighbors);
        }
    }

    fn setNeighborsLastRowInner(self: *Playground) void {
        const prev_row = self.grid[self.rows - 2];
        const current_row = self.grid[self.rows - 1];
        for (1..self.columns - 1) |col| {
            var cell = current_row[col];
            const neighbors =
                prev_row[col - 1].value + prev_row[col].value + prev_row[col + 1].value +
                current_row[col - 1].value + current_row[col + 1].value;
            self.swap[self.rows - 1][col] = cell.nextCell(neighbors);
        }
    }

    fn setNeigborsFirstColInner(self: *Playground) void {
        const first_col = 0;
        for (1..self.rows - 1) |row| {
            var cell = self.grid[row][0];
            const neighbors =
                self.grid[row - 1][first_col].value + self.grid[row - 1][first_col + 1].value +
                self.grid[row][first_col + 1].value +
                self.grid[row + 1][first_col].value + self.grid[row + 1][first_col + 1].value;
            self.swap[row][first_col] = cell.nextCell(neighbors);
        }
    }

    fn setNeigborsLastColInner(self: *Playground) void {
        const last_col = self.columns - 1;
        for (1..self.rows - 1) |row| {
            var cell = self.grid[row][last_col];
            const neighbors =
                self.grid[row - 1][last_col - 1].value + self.grid[row + 1][last_col].value +
                self.grid[row][last_col - 1].value +
                self.grid[row + 1][last_col - 1].value + self.grid[row + 1][last_col].value;
            self.swap[row][last_col] = cell.nextCell(neighbors);
        }
    }

    pub fn print(self: *const Playground, writer: *std.Io.Writer) !void {
        for (0..self.rows) |row_index| {
            for (0..self.columns) |col_index| {
                const cell = self.grid[row_index][col_index];
                const display: u16 = switch (cell.value) {
                    0 => ' ',
                    1 => '\u{2593}',
                    else => unreachable,
                };
                try writer.printUnicodeCodepoint(display);
            }
            try writer.printAsciiChar('\n', std.fmt.Options{});
        }
    }

    fn setIslandCells(self: *Playground) void {
        for (1..self.rows - 1) |row_index| {
            const prev_row = self.grid[row_index - 1];
            const current_row = self.grid[row_index];
            const next_row = self.grid[row_index + 1];
            for (1..self.columns - 1) |col_index| {
                var cell = self.grid[row_index][col_index];
                const neighbors = prev_row[col_index - 1].value + prev_row[col_index].value + prev_row[col_index + 1].value +
                    current_row[col_index - 1].value + current_row[col_index + 1].value +
                    next_row[col_index - 1].value + next_row[col_index].value + next_row[col_index + 1].value;
                self.swap[row_index][col_index] = cell.nextCell(neighbors);
            }
        }
    }

    pub fn nextGen(self: *Playground) void {
        self.setNeigborsCorners();
        self.setNeighborsFirstRowInner();
        self.setNeighborsLastRowInner();
        self.setNeigborsFirstColInner();
        self.setNeigborsLastColInner();
        self.setIslandCells();
        const temp = self.grid;
        self.grid = self.swap;
        self.swap = temp;
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
        for (0..self.rows) |row_index| {
            allocator.free(self.grid[row_index]);
            allocator.free(self.swap[row_index]);
        }
        allocator.free(self.grid);
        allocator.free(self.swap);
    }

    pub fn new(allocator: std.mem.Allocator, rows: u32, columns: u32) !Playground {
        assert(rows >= 3);
        assert(columns >= 3);
        const grid = try allocator.alloc([]Cell, rows);
        for (0..rows) |row_index| {
            grid[row_index] = try allocator.alloc(Cell, columns);
        }
        const swap = try allocator.alloc([]Cell, rows);
        for (0..rows) |row_index| {
            swap[row_index] = try allocator.alloc(Cell, columns);
        }
        return Playground{ .rows = rows, .columns = columns, .grid = grid, .swap = swap };
    }

    pub fn fromBuffer(allocator: std.mem.Allocator, rows: u32, columns: u32, buff: []u1) !Playground {
        assert(buff.len == rows * columns);
        const playground = try Playground.new(allocator, rows, columns);
        for (0..rows) |row_index| {
            for (0..columns) |col_index| {
                playground.grid[row_index][col_index].value = buff[row_index * rows + col_index];
                playground.swap[row_index][col_index].value = 0;
            }
        }
        return playground;
    }

    pub fn random(allocator: std.mem.Allocator, io: std.Io, rows: u32, columns: u32) !Playground {
        var r = std.Random.DefaultPrng.init(@intCast(std.Io.Clock.real.now(io).toMilliseconds()));

        var playground = try Playground.new(allocator, rows, columns);
        for (0..rows) |row_index| {
            for (0..columns) |col_index| {
                const mycellval = r.random().uintAtMost(u1, 1);
                playground.grid[row_index][col_index] = Cell{ .value = mycellval };
                playground.swap[row_index][col_index] = Cell{ .value = 0 };
            }
        }
        return playground;
    }
};

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

    playgound.setNeigborsCorners();
    try std.testing.expectEqual(
        0,
        playgound.swap[0][0].value,
    );
    try std.testing.expectEqual(
        0,
        playgound.swap[0][2].value,
    );
    try std.testing.expectEqual(
        0,
        playgound.swap[2][2].value,
    );
    try std.testing.expectEqual(
        0,
        playgound.swap[2][0].value,
    );

    playgound.setNeighborsFirstRowInner();
    try std.testing.expectEqual(
        0,
        playgound.swap[0][1].value,
    );

    playgound.setNeighborsLastRowInner();
    try std.testing.expectEqual(
        0,
        playgound.swap[2][1].value,
    );

    playgound.setNeigborsFirstColInner();
    try std.testing.expectEqual(
        1,
        playgound.swap[1][0].value,
    );

    playgound.setNeigborsLastColInner();
    try std.testing.expectEqual(
        1,
        playgound.swap[1][2].value,
    );

    playgound.setIslandCells();
    try std.testing.expectEqual(
        1,
        playgound.swap[1][1].value,
    );
    var expected = [_]u1{
        0, 0, 0, // 000
        1, 1, 1, // 111
        0, 0, 0, // 000
    };
    var expectedP = try Playground.fromBuffer(std.testing.allocator, 3, 3, expected[0..]);
    defer expectedP.deinit(std.testing.allocator);
    try std.testing.expectEqualSlices(Cell, expectedP.grid[0], playgound.swap[0]);
    try std.testing.expectEqualSlices(Cell, expectedP.grid[1], playgound.swap[1]);
    try std.testing.expectEqualSlices(Cell, expectedP.grid[2], playgound.swap[2]);
}
