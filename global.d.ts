export { };

type Game = {
  init(rows: number, cols: number, seed: Array<number>);
  destroy();
  next(): Uint8Array;
  current(): Uint8Array;
  err(): { msg: string, code: number };
};

declare global {
  interface Window {
    G: Game;
  }
}
