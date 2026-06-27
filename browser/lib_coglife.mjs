(async () => {
  const bytes = await fetch("http://localhost:8080/coglife_wasm.wasm").then((r) => r.arrayBuffer());

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

  const last_err = () => {
    const code = wasm.last_error_code();
    const errptr = wasm.last_error_message_ptr();
    const len = wasm.last_error_message_len();
    const mem = new Uint8Array(wasm.memory.buffer, errptr, len);
    console.log("last_err_code: " + code + " last_err: " + new TextDecoder().decode(mem));
  }

  const seed = wasm.alloc_u8(9);
  console.log("seed ptr", seed);

  const mem = new Uint8Array(wasm.memory.buffer, seed, 9);
  mem.set([0, 0, 0, 1, 1, 1, 0, 0, 0], 0);
  console.log("set", mem);

  const playground = wasm.playground_init(3, 3, seed);
  wasm.free_u8(seed, 9);
  console.log("playground_ptr", playground);
  last_err();

  const current = wasm.playground_grid(playground);
  const grid = new Uint8Array(wasm.memory.buffer, current, 9);
  console.log("current", grid);

  const next_gen = wasm.playground_nextgen();
  const next_grid = new Uint8Array(wasm.memory.buffer, next_gen, 9);
  console.log("nextgen", next_grid);

  wasm.playground_destroy(playground);
})();
