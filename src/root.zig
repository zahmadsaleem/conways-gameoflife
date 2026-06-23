const std = @import("std");
const Io = std.Io;
const assert = std.debug.assert;

pub const Cell = struct {
    value: u8 = 0b00000000, // 8 lives, each bit holds a life value.

    fn isAlive(self: *const Cell, index: u3) bool {
        const _index = 7 - index;
        return ((self.value & (@as(u8, 1) << _index)) >> _index) == 1;
    }

    fn isAliveInt(self: *const Cell, index: u3) u4 {
        const _index = 7 - index;
        return @intCast((self.value & (@as(u8, 1) << _index)) >> _index);
    }

    fn setAlive(self: *Cell, index: u3, alive: bool) void {
        const _index = 7 - index;
        if (!alive) {
            self.value = (self.value & (~(@as(u8, 1)) << _index));
            return;
        }
        self.value = self.value | ((@as(u8, 1) << _index));
    }
};

const CellIndex = .{ usize, u3 };

pub const Playground = struct {
    rows: u32,
    columns: u32,
    grid: []Cell,
    swap: []Cell,

    fn neighborLifeCount(self: *const Playground, row: u32, col: u32) u4 {
        assert(self.rows > row);
        assert(self.columns > col);
        var neighbors: u4 = 0;

        // c0, c1, c2
        // c3, --, c4
        // c5, c6, c7
        const c0 = self.cellIndex(row -| 1, col -| 1);
        const c1 = self.cellIndex(row -| 1, col);
        const c2 = self.cellIndex(row -| 1, col + 1);
        const c3 = self.cellIndex(row, col -| 1);
        const c4 = self.cellIndex(row, col + 1);
        const c5 = self.cellIndex(row + 1, col -| 1);
        const c6 = self.cellIndex(row + 1, col);
        const c7 = self.cellIndex(row + 1, col + 1);
        // std.debug.print("row:{} col:{}\n", .{ row, col });
        if (row > 0) {
            if (col > 0) {
                // std.debug.print("c0:{}", .{c0});
                neighbors += self.grid[c0[0]].isAliveInt(c0[1]);
            } else {
                // std.debug.print("\t\t", .{});
            }

            // std.debug.print(" c1:{} ", .{c1});
            neighbors += self.grid[c1[0]].isAliveInt(c1[1]);
            if (col < self.columns - 1) {
                // std.debug.print("c2:{}\n", .{c2});
                neighbors += self.grid[c2[0]].isAliveInt(c2[1]);
            } else {
                // std.debug.print("\n", .{});
            }
        }

        if (col > 0) {
            // std.debug.print("c3:{}", .{c3});
            neighbors += self.grid[c3[0]].isAliveInt(c3[1]);
        } else {
            // std.debug.print("\t\t", .{});
        }
        std.debug.print("\t\t", .{});
        if (col < self.columns - 1) {
            // std.debug.print("c4:{}\n", .{c4});
            neighbors += self.grid[c4[0]].isAliveInt(c4[1]);
        } else {
            // std.debug.print("\n", .{});
        }

        if (row < self.rows - 1) {
            if (col > 0) {
                // std.debug.print("c5:{} ", .{c5});
                neighbors += self.grid[c5[0]].isAliveInt(c5[1]);
            } else {
                // std.debug.print("\t\t", .{});
            }
            // std.debug.print(" c6:{} ", .{c6});
            neighbors += self.grid[c6[0]].isAliveInt(c6[1]);
            if (col < self.columns - 1) {
                // std.debug.print("c7:{}", .{c7});
                neighbors += self.grid[c7[0]].isAliveInt(c7[1]);
            }
        }
        // std.debug.print("\n\n", .{});
        return neighbors;
    }

    fn size(self: *const Playground) usize {
        return self.rows * self.columns;
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
                var cellPos: usize = undefined;
                var lifePos: u3 = undefined;
                cellPos, lifePos = self.cellIndex(row_index, col_index);
                var cell = self.grid[cellPos];
                switch (self.neighborLifeCount(@intCast(row_index), @intCast(col_index))) {
                    0...1 => cell.setAlive(lifePos, cell.isAlive(lifePos)),
                    2 => cell.setAlive(lifePos, cell.isAlive(lifePos)),
                    3 => cell.setAlive(lifePos, true),
                    else => cell.setAlive(lifePos, false),
                }
                self.swap[cellPos] = cell;
            }
        }
        const temp = self.grid;
        self.grid = self.swap;
        self.swap = temp;
    }

    fn cellIndex(self: *const Playground, row_index: usize, col_index: usize) struct { usize, u3 } {
        const mod: u3 = @intCast((row_index * self.columns + col_index) % 8);
        return .{
            ((row_index * self.columns + col_index) / 8),
            mod,
        };
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
        const numCells = if (rows * columns % 8 > 0) (rows * columns / 8) + 1 else (rows * columns / 8);
        const grid = try allocator.alloc(Cell, numCells);
        @memset(grid, Cell{ .value = 0 });
        const swap = try allocator.alloc(Cell, numCells);
        @memset(swap, Cell{ .value = 0 });
        return Playground{ .rows = rows, .columns = columns, .grid = grid, .swap = swap };
    }

    pub fn fromBuffer(allocator: std.mem.Allocator, rows: u32, columns: u32, aliveIndices: []u16) !Playground {
        const playground = try Playground.new(allocator, rows, columns);
        assert(playground.grid[0].value == 0);
        for (aliveIndices) |pos| {
            const cellPos = pos / 8;
            const lifePos = pos % 8;
            var cell = playground.grid[cellPos];
            std.debug.print("setAlive: before val:{b}\n", .{cell.value});
            cell.setAlive(@intCast(lifePos), true);
            playground.grid[cellPos] = cell;
            std.debug.print("setAlive: pos:{} after val:{b}\n", .{ lifePos, cell.value });
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
    var cell = Cell{ .value = 0b10001000 }; // 2x4 grid, (0,0) (1,0) alive, i.e bit index 1, 4
    assert(cell.isAlive(0));
    assert(cell.isAliveInt(0) == 1);
    assert(!cell.isAlive(1));
    assert(cell.isAliveInt(1) == 0);
    assert(!cell.isAlive(2));
    assert(cell.isAliveInt(2) == 0);
    assert(!cell.isAlive(3));
    assert(cell.isAliveInt(3) == 0);
    assert(cell.isAlive(4));
    assert(cell.isAliveInt(4) == 1);
    assert(!cell.isAlive(5));
    assert(cell.isAliveInt(5) == 0);
    assert(!cell.isAlive(6));
    assert(cell.isAliveInt(6) == 0);
    assert(!cell.isAlive(7));
    assert(cell.isAliveInt(7) == 0);

    cell.setAlive(2, true);
    std.debug.print("setAlive: cell value {b}\n", .{cell.value});
    assert(cell.isAlive(2));
    assert(cell.isAliveInt(2) == 1);
    std.debug.print("setAlive: cell value {b}\n", .{cell.value});
    cell.setAlive(2, false);
    std.debug.print("setAlive: cell value {b}\n", .{cell.value});
    assert(!cell.isAlive(2));
    assert(cell.isAliveInt(2) == 0);
}

test "cellIndex works" {
    var playground = try Playground.new(std.testing.allocator, 3, 3);
    assert(playground.grid.len == 2);
    defer playground.deinit(std.testing.allocator);
    try std.testing.expectEqual(.{ 0, @as(u3, 0) }, playground.cellIndex(0, 0));
    try std.testing.expectEqual(.{ 0, @as(u3, 1) }, playground.cellIndex(0, 1));
    try std.testing.expectEqual(.{ 0, @as(u3, 2) }, playground.cellIndex(0, 2));
    try std.testing.expectEqual(.{ 0, @as(u3, 3) }, playground.cellIndex(1, 0));
    try std.testing.expectEqual(.{ 0, @as(u3, 4) }, playground.cellIndex(1, 1));
    try std.testing.expectEqual(.{ 0, @as(u3, 5) }, playground.cellIndex(1, 2));
    try std.testing.expectEqual(.{ 0, @as(u3, 6) }, playground.cellIndex(2, 0));
    try std.testing.expectEqual(.{ 0, @as(u3, 7) }, playground.cellIndex(2, 1));
    try std.testing.expectEqual(.{ 1, @as(u3, 0) }, playground.cellIndex(2, 2));
}

test "playground neighbors works" {
    // 0x0 0,1,2
    // x0x 3,4,5
    // 0x0 6,7,8
    var stable = [_]u16{ 1, 3, 5, 7 };
    // next generation should basically be the same
    var playgound = try Playground.fromBuffer(std.testing.allocator, 3, 3, stable[0..]);
    defer playgound.deinit(std.testing.allocator);
    try std.testing.expectEqual(0b01010101, playgound.grid[0].value);
    assert(playgound.grid[0].isAlive(1));
    assert(!playgound.grid[0].isAlive(2));
    assert(playgound.grid[0].isAlive(3));
    assert(!playgound.grid[0].isAlive(4));
    assert(playgound.grid[0].isAlive(5));
    assert(!playgound.grid[0].isAlive(6));
    assert(playgound.grid[0].isAlive(7));
    assert(!playgound.grid[1].isAlive(1));
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
    // 0x0 0,1,2
    // 0x0 3,4,5
    // 0x0 6,7,8
    var testAlive = [_]u16{ 1, 4, 7 };
    var playgound = try Playground.fromBuffer(std.testing.allocator, 3, 3, testAlive[0..]);
    defer playgound.deinit(std.testing.allocator);
    playgound.nextGen();
    var expecteddAlive = [_]u16{ 3, 4, 5 };
    var got = try Playground.fromBuffer(std.testing.allocator, 3, 3, expecteddAlive[0..]);
    defer got.deinit(std.testing.allocator);
    try std.testing.expectEqualSlices(Cell, playgound.grid, got.grid);
}
