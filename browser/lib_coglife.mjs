(async () => {
  const bytes = await fetch("coglife_wasm.wasm").
    then((r) => r.arrayBuffer());

  let wasm;

  const imports = {
    env: {
      host_log(ptr, len) {
        const mem = new Uint8Array(wasm.memory.buffer, ptr, len);
        console.log(new TextDecoder().decode(mem));
      },
    },
  };

  const { instance } = await WebAssembly.instantiate(bytes, imports);
  wasm = instance.exports;

  const err = () => {
    const code = wasm.last_error_code();
    const errptr = wasm.last_error_message_ptr();
    const len = wasm.last_error_message_len();
    const mem = new Uint8Array(wasm.memory.buffer, errptr, len);
    return { code, msg: new TextDecoder().decode(mem) };
  }


  let grid_size = 0;
  let initialized = false;
  const checkinit = () => {
    if (!initialized) throw new Error("playground not initialized");
  }
  window.G = {
    init: (rows, cols, seed) => {
      if (initialized) {
        throw new Error("playground already initialized");
      }
      grid_size = rows * cols;
      if (!seed || seed.length !== rows * cols) {
        throw new Error("seed doesnt match grid")
      }
      const seed_ptr = wasm.alloc_u8(grid_size);
      const mem = new Uint8Array(wasm.memory.buffer, seed_ptr, grid_size);
      mem.set(seed, 0);
      wasm.playground_init(rows, cols, seed_ptr);
      wasm.free_u8(seed_ptr, grid_size);
      initialized = true;
    },
    next: () => {
      checkinit();
      const next_gen = wasm.playground_nextgen();
      return Uint32Array.from(new Uint8Array(wasm.memory.buffer, next_gen, grid_size));
    },
    current: () => {
      checkinit();
      const current_grid = wasm.playground_grid();
      return Uint32Array.from(new Uint8Array(wasm.memory.buffer, current_grid, grid_size));
    },
    destroy: () => {
      checkinit();
      wasm.playground_destroy();
      grid_size = 0;
    },
    err,
  }
  console.log("coglife init", window.G, wasm);
})();
