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

export fn playground_init(rows: u32, cols: u32) usize {
    const ptr = lib.Playground.new(allocator, rows, cols) catch |err| {
        return fail(err);
    };
    return @intFromPtr(&ptr);
}

export fn playground_destroy(ptr: usize) void {
    var playground: *lib.Playground = @ptrFromInt(ptr);
    playground.deinit(allocator);
}

export fn playground_nextgen(ptr: usize) usize {
    var playground: *lib.Playground = @ptrFromInt(ptr);
    playground.nextGen();
}

fn playgroundFromPtr(ptr: usize) *lib.Playground {
    return @ptrFromInt(ptr);
}
