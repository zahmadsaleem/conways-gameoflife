const std = @import("std");
const allocator = @import("std").heap.wasm_allocator;
const lib = @import("lib");

extern fn host_log(ptr: usize, len: usize) void;

const ErrCode = enum(u32) {
    ok = 0,
    invalid_argument = 1,
    invalid_handle = 2,
    out_of_memory = 3,
    buffer_too_small = 4,
};

const WasmError = error{
    InvalidArgument,
    InvalidHandle,
    OutOfMemory,
    BufferTooSmall,
};

var last_code: ErrCode = .ok;
var last_msg: []const u8 = "";

fn codeFromError(err: WasmError) ErrCode {
    return switch (err) {
        error.InvalidArgument => .invalid_argument,
        error.InvalidHandle => .invalid_handle,
        error.OutOfMemory => .out_of_memory,
        error.BufferTooSmall => .buffer_too_small,
    };
}

fn msgFromCode(code: ErrCode) []const u8 {
    return switch (code) {
        .ok => "ok",
        .invalid_argument => "invalid argument",
        .invalid_handle => "invalid handle",
        .out_of_memory => "out of memory",
        .buffer_too_small => "buffer too small",
    };
}

fn ok() u32 {
    last_code = .ok;
    last_msg = "";
    return @intFromEnum(ErrCode.ok);
}

fn fail(err: WasmError) u32 {
    const code = codeFromError(err);
    last_code = code;
    last_msg = msgFromCode(code);
    return @intFromEnum(code);
}

export fn last_error_code() u32 {
    return @intFromEnum(last_code);
}

export fn last_error_message_ptr() usize {
    if (last_msg.len == 0) return 0;
    return @intFromPtr(last_msg.ptr);
}

export fn last_error_message_len() usize {
    return last_msg.len;
}

export fn alloc_u8(len: usize) usize {
    const buff = allocator.alloc(u8, len) catch |err| {
        return fail(err);
    };
    return @intFromPtr(&buff);
}

export fn free_u8(ptr_addr: usize, len: usize) void {
    const ptr: [*]u8 = @ptrFromInt(ptr_addr);
    allocator.free(ptr[0..len]);
}

var global_playground: lib.Playground = undefined;

/// playground_init creates a playground from existing buffer
export fn playground_init(rows: u32, cols: u32, buffptr: usize) usize {
    const buff: [*]u1 = @ptrFromInt(buffptr);
    const ptr = lib.Playground.fromBuffer(allocator, rows, cols, buff[0..(rows * cols)]) catch {
        return fail(WasmError.OutOfMemory);
    };
    global_playground = ptr;
    const msgbuf: []u8 = allocator.alloc(u8, 255) catch {
        return fail(WasmError.OutOfMemory);
    };
    const message = std.fmt.bufPrint(msgbuf, "values {any}", .{ptr.grid}) catch {
        // too large to bufPrint
        return fail(WasmError.OutOfMemory);
    };
    const hello = "initializing...";
    host_log(@intFromPtr(hello), hello.len);
    host_log(@intFromPtr(message.ptr), message.len);
    return @intFromPtr(&global_playground);
}

export fn playground_grid() usize {
    return @intFromPtr(global_playground.grid.ptr);
}

export fn playground_destroy() void {
    global_playground.deinit(allocator);
}

/// playground_nextgen returns the pointer to the grid
export fn playground_nextgen() usize {
    global_playground.nextGen();
    return @intFromPtr(global_playground.grid.ptr);
}
