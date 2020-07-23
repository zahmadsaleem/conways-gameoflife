const PIXEL_SIZE = 5;
const CANVAS_WIDTH = window.innerWidth;
const CANVAS_HEIGHT = window.innerHeight;
const canvas = document.querySelector("#canvas");
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;
const ctx = canvas.getContext("2d");

class Playground {
  constructor(rows, columns) {
    this.rows = rows;
    this.columns = columns;
    this.field = this.generate();
  }

  generate(randomize = true) {
    let grid = [];
    for (let row = 0; row < this.rows; row++) {
      let _row = [];
      for (let col = 0; col < this.columns; col++) {
        let alive = randomize ? Math.random() > 0.5 : false;
        _row.push(new Cell(row, col, alive));
      }
      grid.push(_row);
    }
    return grid;
  }

  draw(ctx) {
    for (let row of this.field) {
      for (let cell of row) {
        if (cell.alive) {
          ctx.fillStyle = "green";
          ctx.fillRect(
            cell.col * PIXEL_SIZE,
            cell.row * PIXEL_SIZE,
            PIXEL_SIZE,
            PIXEL_SIZE
          );
        }
      }
    }
  }

  update() {
    let grid = [];
    for (let cell_row of this.field) {
      let _row = [];
      for (let _cell of cell_row) {
        let cell = new Cell(_cell.row, _cell.col, _cell.alive);
        let length = _cell.neighbours(this).length;
        if (cell.alive) {
          if (length > 3 || length < 2) cell.die();
        } else {
          if (length === 3) cell.live();
        }
        _row.push(cell);
      }
      grid.push(_row);
    }
    this.field = grid;
  }

  isValidCell(row, col) {
    return col >= 0 && col < this.columns && row > 0 && row < this.rows;
  }

  play(ctx, i, wait = 10) {
    let loop = setInterval(() => {
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      this.draw(ctx);
      this.update();
      i--;
      if (i === 0) clearInterval(loop);
    }, wait);
  }
}

class Cell {
  constructor(row, col, alive = false) {
    this.row = row;
    this.col = col;
    this.alive = alive;
  }

  neighbours(playground) {
    let neighbour_list = [];
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        let row = this.row + i;
        let col = this.col + j;
        let neighbor;
        if (playground.isValidCell(row, col))
          neighbor = playground.field[row][col];
        if (neighbor && neighbor !== this && neighbor.alive)
          neighbour_list.push(neighbor);
      }
    }
    return neighbour_list;
  }

  die() {
    this.alive = false;
  }

  live() {
    this.alive = true;
  }
}

let plg = new Playground(CANVAS_HEIGHT / 5, CANVAS_WIDTH / 5);
plg.play(ctx, -1);
