const std = @import("std");
const Io = std.Io;
const assert = std.debug.assert;

const Cell = struct {
    value: u4 = 0b0000, // 3 generations, each bit holds a generations value, g3-g2-g1-temp, temp is used for state management across generations

    fn isAlive(self: *const Cell) bool {
        return (self.value & 0b0010) == 0b0010;
    }

    fn setAliveTemp(self: *Cell, alive: bool) void {
        if (!alive) {
            self.value = self.value & 0b1110;
            return;
        }
        self.value = self.value | 0b0001;
    }

    fn incrGeneration(self: *Cell) void {
        self.value = self.value << 1;
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

const Playground = struct {
    rows: u16,
    columns: u16,
    grid: []Cell,

    fn neighborLifeCount(self: *const Playground, row: u16, col: u16) u4 {
        assert(self.rows > row);
        assert(self.columns > col);
        const indices = [8][2]i2{
            [2]i2{ -1, -1 }, [2]i2{ -1, 0 }, [2]i2{ -1, 1 }, // previous row
            [2]i2{ 0, -1 }, [2]i2{ 0, 1 }, // current row
            [2]i2{ 1, -1 }, [2]i2{ 1, 0 }, [2]i2{ 1, 1 }, // next row
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
            if (col == self.columns - 1 and i[1] == 1) {
                continue;
            }
            const row_index: u16 = @intCast(@as(i32, row) + i[0]);
            const col_index: u16 = @intCast(@as(i32, col) + i[1]);
            if (self.grid[row_index * self.columns + col_index].isAlive()) {
                neighbors += 1;
            }
        }
        assert(neighbors < 9);
        return neighbors;
    }

    fn print(self: *const Playground, writer: *std.Io.Writer) !void {
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

    fn nextGen(self: *Playground) void {
        for (0..self.rows) |row_index| {
            for (0..self.columns) |col_index| {
                var cell = self.grid[row_index * self.columns + col_index];
                switch (self.neighborLifeCount(@intCast(row_index), @intCast(col_index))) {
                    0...1 => cell.setAliveTemp(false),
                    2...3 => cell.setAliveTemp(true),
                    else => cell.setAliveTemp(false),
                }
                self.grid[row_index * self.columns + col_index] = cell;
            }
        }
        for (0..self.rows) |row_index| {
            for (0..self.columns) |col_index| {
                var cell = self.grid[row_index * self.columns + col_index];
                cell.incrGeneration();
                self.grid[row_index * self.columns + col_index] = cell;
            }
        }
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

    fn clearPrint(self: *const Playground, w: *std.Io.Writer) !void {
        try w.print("\x1b[{d}F", .{self.rows});
        for (0..self.rows) |_| {
            try w.print("\x1b[2K\n", .{});
        }
        try w.print("\x1b[{d}F", .{self.rows});
    }
};

fn randomCell(r: *std.Random.Xoshiro256) u2 {
    return r.random().uintAtMost(u1, 1);
}

pub fn main(init: std.process.Init) !void {
    var r = std.Random.DefaultPrng.init(@intCast(std.Io.Clock.real.now(init.io).toMilliseconds()));
    const arena: std.mem.Allocator = init.arena.allocator();
    const rows = 100;
    const columns = 100;
    var buff: [rows * columns]Cell = undefined;
    var playground = Playground{ .rows = rows, .columns = columns, .grid = &buff };
    for (0..rows * columns) |i| {
        const mycellval = randomCell(&r);
        playground.grid[i] = Cell{ .value = @as(u4, mycellval) << 1 };
    }

    const args = try init.minimal.args.toSlice(arena);
    for (args) |arg| {
        std.log.info("arg: {s}", .{arg});
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

test "cell value works" {
    var cell = Cell{ .value = 0b1000 };
    assert(!cell.isAlive());
    assert(!cell.getGenerationLife(0));
    assert(!cell.getGenerationLife(1));
    assert(cell.getGenerationLife(2));
    cell.setAliveTemp(true);
    std.debug.print("setAliveTemp: cell value {b}\n", .{cell.value});
    cell.incrGeneration();
    std.debug.print("incrGeneration: cell value {b}\n", .{cell.value});
    assert(cell.isAlive());
    try std.testing.expectEqual(1, cell.age());
    cell.setAliveTemp(true);
    cell.incrGeneration();
    try std.testing.expectEqual(2, cell.age());
    cell.setAliveTemp(false);
    cell.incrGeneration();
    assert(!cell.isAlive());
    try std.testing.expectEqual(cell.age(), 0);
}
