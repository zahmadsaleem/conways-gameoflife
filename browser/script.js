const PIXEL_SIZE = 2;
const CANVAS_WIDTH = window.innerWidth;
const CANVAS_HEIGHT = window.innerHeight;
const canvas = document.querySelector("#canvas");
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;
const ctx = canvas.getContext("2d");

const PLAYGROUND_CONFIG_DEFAULTS = {
  wait: 110,
  // infinite
  iterations: -1,
  wait_increment: 50,
  fill_ratio: 0.65,
  generation_color(x) {
    let color;
    switch (true) {
      case x === 0:
        color = "red";
        break;
      case x > 0 && x < 3:
        color = "orange";
        break;
      case x >= 3 && x < 6:
        color = "yellow";
        break;
      default:
        color = "green";
    }
    return color;
  },
};

class Playground {
  STATUS = {
    running: 1,
    paused: 2,
    init: 0,
  };
  player = null;
  wait = PLAYGROUND_CONFIG_DEFAULTS.wait;
  constructor(rows, columns) {
    this.rows = rows;
    this.columns = columns;
    this.field = this.generate();
    this.state = this.STATUS.init;
    this.initial_state = this.field;
  }

  generate(randomize = true) {
    let grid = [];
    for (let row = 0; row < this.rows; row++) {
      let _row = [];
      for (let col = 0; col < this.columns; col++) {
        let alive = randomize
          ? Math.random() < PLAYGROUND_CONFIG_DEFAULTS.fill_ratio
          : false;
        _row.push(new Cell(row, col, alive));
      }
      grid.push(_row);
    }
    return grid;
  }

  draw() {
    for (let row of this.field) {
      for (let cell of row) {
        if (cell.alive) {
          ctx.fillStyle = PLAYGROUND_CONFIG_DEFAULTS.generation_color(
            cell.generation
          );
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

  resetField() {
    let grid = [];
    for (let cell_row of this.initial_state) {
      let _row = [];
      for (let _cell of cell_row) {
        let cell = new Cell(_cell.row, _cell.col, _cell.alive);
        _row.push(cell);
      }
      grid.push(_row);
    }
    this.field = grid;
  }

  update() {
    let grid = [];
    for (let cell_row of this.field) {
      let _row = [];
      for (let _cell of cell_row) {
        let cell = new Cell(_cell.row, _cell.col, _cell.alive);
        cell.generation = _cell.generation;
        let length = _cell.neighbours(this).length;
        if (cell.alive) {
          if (length > 3 || length < 2) cell.die();
          else cell.generation++;
        } else {
          if (length === 3) cell.live();
        }
        _row.push(cell);
      }
      grid.push(_row);
    }
    this.field = grid;
  }

  apply(processCell = null, processBeforeRow = null, processAfterRow = null) {
    for (let cell_row of this.field) {
      let results;
      if (processBeforeRow) results = processBeforeRow(cell_row);
      for (let cell of cell_row) {
        if (processCell) {
          processCell(cell);
        }
      }
      if (processAfterRow) processAfterRow(cell_row, results);
    }
  }

  isValidCell(row, col) {
    return col >= 0 && col < this.columns && row > 0 && row < this.rows;
  }

  init(iteration = PLAYGROUND_CONFIG_DEFAULTS.iterations) {
    clearCanvas();
    this.draw();
    this.player = setInterval(() => {
      if (this.state === this.STATUS.running) {
        clearCanvas();
        this.draw();
        this.update();
        iteration--;
      }
      // status turns to init on reset
      if (iteration === 0) clearInterval(this.player);
    }, this.wait);
  }

  pause() {
    this.state = this.STATUS.paused;
  }

  play() {
    this.state = this.STATUS.running;
  }

  reset() {
    if (this.state !== this.STATUS.init) {
      this.stop();
      this.resetField();
      this.init();
    }
  }

  changeWait(x) {
    let current = this.state;
    this.stop();
    if (
      x > 0 ||
      !(x < 0 && this.wait <= PLAYGROUND_CONFIG_DEFAULTS.wait_increment)
    ) {
      this.wait += x * PLAYGROUND_CONFIG_DEFAULTS.wait_increment;
    }
    this.init();
    if (current === this.STATUS.running) this.play();
  }

  slower() {
    this.changeWait(1);
  }

  faster() {
    this.changeWait(-1);
  }

  stop() {
    clearInterval(this.player);
    this.player = null;
    this.state = this.STATUS.init;
  }
}

class Cell {
  constructor(row, col, alive = false) {
    this.row = row;
    this.col = col;
    this.alive = alive;
    this.generation = 0;
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
    this.generation = 0;
  }

  live() {
    this.alive = true;
  }
}

function clearCanvas() {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function initializeControls(playground) {
  let play = document.querySelector("#play");
  play.addEventListener("click", () => {
    console.log("play");
    playground.play();
  });
  let pause = document.querySelector("#pause");
  pause.addEventListener("click", () => {
    console.log("pause");
    if (playground.state === playground.STATUS.running) playground.pause();
  });
  let reset = document.querySelector("#reset");
  reset.addEventListener("click", () => {
    console.log("reset");
    playground.reset();
  });
  let faster = document.querySelector("#faster");
  faster.addEventListener("click", () => {
    playground.faster();
    // console.log("faster", playground.wait);
  });
  let slower = document.querySelector("#slower");
  slower.addEventListener("click", () => {
    playground.slower();
    // console.log("slower", playground.wait);
  });
}

function run() {
  let plg = new Playground(
    CANVAS_HEIGHT / PIXEL_SIZE,
    CANVAS_WIDTH / PIXEL_SIZE
  );
  initializeControls(plg);
  plg.init();
}

run();
