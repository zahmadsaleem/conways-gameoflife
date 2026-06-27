const bytes = await fetch("./coglife.wasm").then((r) => r.arrayBuffer());

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

console.log(wasm.add(20, 22));

{
  const ptr = wasm.greeting_ptr();
  const len = wasm.greeting_len();
  const text = new TextDecoder().decode(
    new Uint8Array(wasm.memory.buffer, ptr, len),
  );
  console.log(text);
}

{
  const input = new TextEncoder().encode("hello wasm");

  const ptr = wasm.alloc(input.length);
  if (ptr === 0) throw new Error("wasm alloc failed");

  // Recreate views after calls that may grow memory.
  let mem = new Uint8Array(wasm.memory.buffer);
  mem.set(input, ptr);

  wasm.uppercase(ptr, input.length);

  mem = new Uint8Array(wasm.memory.buffer);
  const output = new TextDecoder().decode(mem.subarray(ptr, ptr + input.length));
  console.log(output);

  wasm.free(ptr, input.length);
}

