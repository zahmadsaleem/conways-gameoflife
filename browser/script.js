const CANVAS_WIDTH = window.innerWidth - 20;
const CANVAS_HEIGHT = window.innerHeight - 20;
const CANVAS = document.querySelector("#canvas");
CANVAS.width = CANVAS_WIDTH;
CANVAS.height = CANVAS_HEIGHT;
const CTX = CANVAS.getContext("2d");

const PLAYGROUND_CONFIG_DEFAULTS = {
  debug: false,
  wait: 10,
  // infinite
  iterations: -1,
  fill_ratio: 0.35,
  show_grid: true,
  pixel_size: 10,
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

const CELL_BYTE_LENGTH = 8;

class Grid {
  constructor(rows, cols, random = false) {
    this.rows = rows;
    this.cols = cols;
    this.buffer = new ArrayBuffer(rows * cols * CELL_BYTE_LENGTH);
    this.u = new Uint16Array(this.buffer);
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const cell = this.getCell(row, col)
        if (random) {
          randomize(cell)
        }
        setCellPosition(cell, row, col)
      }
    }
  }

  getCell(row, col) {
    return new Uint16Array(this.buffer, (row * this.cols + col) * CELL_BYTE_LENGTH, 4)
  }

  clone() {
    const g = new Grid(this.rows, this.cols)
    g.buffer = this.buffer.slice(0, this.buffer.byteLength);
    return g
  }

  population() {
    return this.u.filter((m, i) => (i + 2) % 4 === 0 && m > 0).length
  }

  copyFromGrid(grid) {
    const rows = Math.min(grid.rows, this.rows)
    const cols = Math.min(grid.cols, this.cols)
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cell = this.getCell(row, col)
        copyCell(grid.getCell(row, col), cell)
      }
    }
  }
}


function setCellPosition(cell, row, col) {
  cell[0] = row
  cell[1] = col
}

function getCellPosition(cell) {
  return [cell[0], cell[1]]
}

function isCellAlive(cell) {
  return cell[2] > 0
}

function killCell(cell) {
  cell[2] = 0
  setCellGeneration(cell, 0)
}

function reviveCell(cell) {
  cell[2] = 1
}

function setCellGeneration(cell, g) {
  cell[3] = g
}

function getGeneration(cell) {
  return cell[3]
}

function incrementCellGeneration(cell) {
  cell[3] += 1
}

function copyCell(from, to) {
  to[2] = from[2]
}

function toggleLife(cell) {
  if (isCellAlive(cell)) {
    killCell(cell)
    return
  }
  reviveCell(cell)
}

function randomize(cell) {
  const alive = Math.random() < PLAYGROUND_CONFIG_DEFAULTS.fill_ratio ? 1 : 0;
  if (alive) {
    reviveCell(cell)
  }
}

function drawCell(cell, neighbor_count, pixelSize) {
  const debug = PLAYGROUND_CONFIG_DEFAULTS.debug

  if (isCellAlive(cell)) {
    CTX.fillStyle = PLAYGROUND_CONFIG_DEFAULTS.generation_color(
      getGeneration(cell)
    );
    CTX.fillRect(
      cell[1] * pixelSize,
      cell[0] * pixelSize,
      pixelSize,
      pixelSize
    );
  }
  if (debug) {
    CTX.fillStyle = "white";
    CTX.fillText(
      neighbor_count.toString(),
      cell[1] * pixelSize + pixelSize / 2,
      cell[0] * pixelSize + pixelSize / 2
    );
  }
}

class Playground {
  is_wrap_rows = true;
  is_wrap_columns = true;

  constructor(rows, columns) {
    this.rows = rows;
    this.columns = columns;
    this.field = this.generate();
    this.initial_state = this.field.clone();
  }

  generate(is_random) {
    return new Grid(this.rows, this.columns, is_random);
  }

  neighbours(cell, grid) {
    let neighbour_list = [];
    const [r, c] = getCellPosition(cell)
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        if (i === 0 && j === 0) {
          continue
        }
        let row = r + i;
        let col = c + j;
        let neighbor;
        [row, col] = this.getValidIndex(row, col);
        // console.log(`${row},${col}`);
        if (row != null && col != null) {
          neighbor = grid.getCell(row, col);
        }
        if (neighbor && isCellAlive(neighbor)) {
          neighbour_list.push(neighbor);
        }
      }
    }
    return neighbour_list;
  }

  restoreInitialField(field = null) {
    if (field) {
      this.field.copyFromGrid(field);
      this.initial_state.copyFromGrid(field);
      return
    }
    this.field = this.initial_state.clone();
  }

  update(draw) {
    const currentGrid = this.field.clone();
    const f = (cell) => {
      let length = this.neighbours(cell, currentGrid).length;
      if (isCellAlive(cell)) {
        if (length > 3 || length < 2) {
          killCell(cell);
        } else {
          incrementCellGeneration(cell);
        }
      } else {
        if (length === 3) {
          reviveCell(cell);
        }
      }
      draw(cell, length)
    };
    this.applyToCells(f, this.field);
  }

  applyToCells(processCell, grid) {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.columns; col++) {
        const cell = grid.getCell(row, col)
        processCell(cell);
      }
    }
    // DRY code for looping through field
  }

  isValidColumn(col) {
    return col >= 0 && col < this.columns;
  }

  isValidRow(row) {
    return row >= 0 && row < this.rows;
  }

  getValidIndex(row, col) {
    const isValidRow = this.isValidRow(row);
    const isValidCol = this.isValidColumn(col)
    const isValidCell = isValidRow && isValidCol

    if (isValidCell) {
      return [row, col]
    }

    if (!isValidRow) {
      // wrap ?
      if (this.is_wrap_rows) {
        // check conditions to wrap
        if (row === this.rows) row = 0;
        else if (row === -1) row = this.rows - 1;
        //  doesnt match ? (this condition is never met in neighbours)
        else row = null;
      } else {
        // dont wrap and invalid
        row = null;
      }
    }

    if (!isValidCol) {
      if (this.is_wrap_columns) {
        if (col === this.columns) col = 0;
        else if (col === -1) col = this.columns - 1;
        else col = null;
      } else {
        col = null;
      }
    }

    return [row, col];
  }

  killAllCells() {
    this.field = this.generate(false);
    this.initial_state = this.field.clone();
  }

  randomizeField() {
    this.field = this.generate(true);
    this.initial_state = this.field.clone();
  }

  resize(rows, columns) {
    const g = new Grid(rows, columns);
    g.copyFromGrid(this.field);
    this.field = g;
    this.rows = rows;
    this.columns = columns;
    this.initial_state = this.field.clone();
  }
}

class PlaygroundController extends Playground {
  STATUS = {
    running: 1,
    paused: 2,
    init: 0,
  };
  player = null;
  iter_count = 0;
  editor;
  translator;
  #wait = PLAYGROUND_CONFIG_DEFAULTS.wait;
  #pixel_size = PLAYGROUND_CONFIG_DEFAULTS.pixel_size;

  constructor(
    height,
    width,
    start = true,
    pixel_size = PLAYGROUND_CONFIG_DEFAULTS.pixel_size
  ) {
    let rows = (height / pixel_size) >> 0;
    let columns = (width / pixel_size) >> 0;
    super(rows, columns);
    this.#pixel_size = pixel_size;
    this.state = this.STATUS.init;
    this.editor = new PlaygroundEditor(this);
    this.translator = new PlaygroundTranslator(this);
    this.initializeControls();
    if (start) {
      this.init();
    }
  }

  clearCanvas(show_grid = PLAYGROUND_CONFIG_DEFAULTS.show_grid) {
    CTX.fillStyle = "black";
    CTX.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    if (show_grid) {
      this.drawGrid();
    }
  }

  drawGrid() {
    CTX.strokeStyle = "#303030";
    CTX.beginPath();
    for (let i = 0; i < CANVAS_HEIGHT; i += this.pixel_size) {
      CTX.moveTo(0, i);
      CTX.lineTo(CANVAS_WIDTH, i);
    }
    for (let i = 0; i < CANVAS_WIDTH; i += this.pixel_size) {
      CTX.moveTo(i, 0);
      CTX.lineTo(i, CANVAS_HEIGHT);
    }
    CTX.closePath();
    CTX.stroke();
    CTX.strokeStyle = null;
  }

  fitToCanvas() {
    this.resize(
      (CANVAS_HEIGHT / this.pixel_size) >> 0,
      (CANVAS_WIDTH / this.pixel_size) >> 0
    );
  }

  get pixel_size() {
    return this.#pixel_size;
  }

  set pixel_size(size) {
    let current_state = this.state;
    this.stop();
    this.#pixel_size = size;
    this.fitToCanvas();
    this.init();
    this.resumeState(current_state);
  }

  resumeState(state) {
    switch (state) {
      case this.STATUS.paused:
        this.pause();
        break;
      case this.STATUS.running:
        this.play();
        break;
    }
  }

  init(iterations = PLAYGROUND_CONFIG_DEFAULTS.iterations) {
    this.clearCanvas();
    this.applyToCells((c, n) => drawCell(c, n, this.pixel_size), this.field);
    if (this.player !== null)
      throw Error("initiated without stopping existing player");
    this.player = setInterval(() => {
      if (this.state === this.STATUS.running) {
        this.next();
        iterations--;
      }
      // status turns to init on reset
      if (iterations === 0) clearInterval(this.player);
    }, this.#wait);
    document.getElementById("pause-play").innerHTML = "start";
    this.updateCountUI();
  }

  pause() {
    this.state = this.STATUS.paused;
    document.getElementById("pause-play").innerHTML = "play";
  }

  play() {
    this.state = this.STATUS.running;
    document.getElementById("pause-play").innerHTML = "pause";
  }

  stop(is_pseudo_stop = false) {
    if (!is_pseudo_stop) {
      this.iter_count = 0;
      document.getElementById("iteration-number").innerText = "0";
    }
    clearInterval(this.player);
    this.player = null;
    this.state = this.STATUS.init;
  }

  restart(is_pseudo_stop = false) {
    this.stop(is_pseudo_stop);
    this.init();
  }

  reset(is_preserve = true) {
    if (this.state === this.STATUS.init && is_preserve) return;
    this.stop();
    is_preserve ? this.restoreInitialField() : this.killAllCells();
    this.init();
    if (this.editor.is_editing) {
      this.editor.saveCurrentImage();
    }
  }

  randomize() {
    this.stop();
    this.randomizeField();
    this.init();
  }

  next() {
    this.clearCanvas();
    if (this.state === this.STATUS.init) this.state = this.STATUS.paused;
    this.update((c, n) => drawCell(c, n, this.pixel_size));
    this.iter_count++;
    document.getElementById(
      "iteration-number"
    ).innerText = this.iter_count.toString();
    this.updateCountUI();
  }

  set wait(x) {
    let current = this.state;
    this.stop(true);
    this.#wait = x;
    this.init();
    if (current === this.STATUS.running) this.play();
  }

  setButtonsDisabled(is_disable = true) {
    let ids = ["load", "pause-play", "next", "reset", "randomize"];
    ids.map((id) => (document.getElementById(id).disabled = is_disable));
  }

  updateCountUI() {
    document.getElementById("live-count").innerHTML = this.field.population();
  }

  initializeControls() {
    let toggle_btn = document.getElementById("toggle-controls");
    toggle_btn.addEventListener("click", () => {
      document.getElementById("controls").classList.toggle("collapse");
      // console.log("collapse");
    });
    let pause_play_btn = document.querySelector("#pause-play");
    pause_play_btn.addEventListener("click", () => {
      if (this.state === this.STATUS.running) this.pause();
      else this.play();
      // console.log("play");
    });
    let next_btn = document.querySelector("#next");
    next_btn.addEventListener("click", () => {
      if (this.state === this.STATUS.init || this.state === this.STATUS.paused)
        this.next();
      // console.log("next");
    });
    let reset_btn = document.querySelector("#reset");
    reset_btn.addEventListener("click", () => {
      this.reset();
      // console.log("reset");
    });
    let clear_btn = document.querySelector("#clear");
    clear_btn.addEventListener("click", () => {
      this.reset(false);
      // console.log("clear");
    });
    let randomize_btn = document.querySelector("#randomize");
    randomize_btn.addEventListener("click", () => {
      this.randomize();
      // console.log("randomize");
    });
    let edit_btn = document.querySelector("#edit");
    edit_btn.addEventListener("click", () => {
      this.editor.is_editing = !this.editor.is_editing;
      if (this.editor.is_editing) edit_btn.innerHTML = "stop editing";
      else edit_btn.innerHTML = "edit";
      // console.log("edit");
    });
    let wait_slider = document.querySelector("#wait-slider");
    wait_slider.addEventListener("change", () => {
      this.wait = 1000 / wait_slider.value;
      document.getElementById("wait-duration").innerText = wait_slider.value;
      // console.log("wait", (1000 / wait_slider.value).toFixed(0));
    });

    let is_wrap_col = document.querySelector("#wrap-columns");
    is_wrap_col.addEventListener("change", () => {
      this.is_wrap_columns = is_wrap_col.checked;
      // console.log("wrap columns", is_wrap_col.value );
    });

    let is_wrap_row = document.querySelector("#wrap-rows");
    is_wrap_row.addEventListener("change", () => {
      this.is_wrap_rows = is_wrap_row.checked;
      // console.log("wrap columns", is_wrap_col.value );
    });

    let pixel_slider = document.querySelector("#pixel-slider");
    pixel_slider.addEventListener("change", () => {
      this.pixel_size = +pixel_slider.value;
      document.getElementById("pixel-size").innerText = pixel_slider.value;
    });
  }
}

class PlaygroundEditor {
  #is_editing = false;
  #is_drawing = false;
  current_image;

  constructor(controller) {
    this.controller = controller;
  }

  initialize() {
    this.saveCurrentImage();
    CANVAS.addEventListener("mousemove", this.refreshCrossHair);
    CANVAS.addEventListener("mousemove", this.debouncedChangeCell);
    CANVAS.addEventListener("mousedown", this.startEdit);
    window.addEventListener("mouseup", this.stopEdit);
  }

  refreshCrossHair = (e) => {
    let [x, y] = this.getMouseRowCol(e.offsetX, e.offsetY);
    CTX.putImageData(this.current_image, 0, 0);
    CTX.strokeStyle = "white";
    this.drawCrossHair(
      x + this.controller.pixel_size / 2,
      y + this.controller.pixel_size / 2
    );
    this.fillClosestPixel(x, y);
  };

  fillClosestPixel(x, y) {
    CTX.strokeRect(
      x,
      y,
      this.controller.pixel_size,
      this.controller.pixel_size
    );
  }

  saveCurrentImage() {
    this.current_image = CTX.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  drawCrossHair = (x, y) => {
    CTX.beginPath();
    CTX.moveTo(x, 0);
    CTX.lineTo(x, CANVAS_HEIGHT);
    CTX.moveTo(0, y);
    CTX.lineTo(CANVAS_WIDTH, y);
    CTX.closePath();
    CTX.stroke();
  };

  destroy() {
    CANVAS.removeEventListener("mousemove", this.refreshCrossHair);
    CANVAS.removeEventListener("mousemove", this.debouncedChangeCell);
    CANVAS.removeEventListener("mousedown", this.startEdit);
    window.removeEventListener("mouseup", this.stopEdit);
  }

  getMouseRowCol(x, y) {
    x = x - (x % this.controller.pixel_size);
    y = y - (y % this.controller.pixel_size);
    return [x, y];
  }

  changeCell = (e) => {
    if (this.#is_drawing) {
      let [x, y] = this.getMouseRowCol(e.offsetX, e.offsetY);
      let cell = this.controller.field.getCell(
        y / this.controller.pixel_size,
        x / this.controller.pixel_size
      );
      if (cell) {
        toggleLife(cell);
      }

      this.controller.restart(true);
      this.saveCurrentImage();
    }
  };

  get is_editing() {
    return this.#is_editing;
  }

  set is_editing(val) {
    if (val === true) {
      this.controller.stop();
      this.controller.setButtonsDisabled(true);
      this.initialize();
    } else {
      if (this.#is_editing) {
        this.destroy();
        this.controller.restart(true);
        this.saveCurrentImage();
        this.controller.setButtonsDisabled(false);
      }
    }
    this.#is_editing = !this.#is_editing;
  }

  startEdit = (e) => {
    this.#is_drawing = true;
    this.debouncedChangeCell(e);
  };

  debouncedChangeCell = (e) => {
    let debounced;
    (() => {
      clearTimeout(debounced);
      debounced = setTimeout(() => this.changeCell(e), 30);
    })();
  };

  stopEdit = () => {
    this.#is_drawing = false;
  };
}

class PlaygroundTranslator {
  chars = {
    0: "-",
    1: "0",
  };

  constructor(controller) {
    this.controller = controller;
    this.initializeTranslator();
  }

  parse(content, char_map = {"-": false, "0": true}) {
    let string_rows = content.trim().split("\n");
    let char_grid = string_rows.map((r) => r.trim().split(""));
    if (!char_grid.every((row) => row.length === char_grid[0].length)) {
      return null;
    }
    const grid = new Grid(string_rows.length, char_grid[0].length)
    char_grid.forEach((row, row_index) =>
      row.forEach(
        (char, col_index) => {
          const cell = grid.getCell(row_index, col_index)
          if (char_map[char]) {
            reviveCell(cell)
          }
        }
      )
    );

    return grid;
  }

  stringify() {
    let grid = [];
    const f = (cell) => {
      const [row, col] = getCellPosition(cell)
      grid[row] = grid[row] || [];
      grid[row][col] = this.chars[Number(isCellAlive(cell))];
    };
    this.controller.applyToCells(f, this.controller.field);
    return grid.map((x) => x.join("")).join("\n");
  }

  save() {
    let blob = new Blob([this.stringify()]);
    return URL.createObjectURL(blob);
  }

  load(content) {
    let grid = this.parse(content);
    if (grid) {
      this.controller.restoreInitialField(grid);
      this.controller.restart();
      // console.log("loaded");
    } else {
      console.error("invalid field");
    }
  }

  async loadFromURL(url) {
    let request = new Request(url);
    let res = await fetch(request);
    if (res.ok) {
      let blob = await res.blob();
      let content = await blob.text();
      this.load(content);
    }
  }

  initializeTranslator() {
    let link = document.createElement("a");
    let save_button = document.querySelector("#save");
    save_button.addEventListener("click", () => {
      link.href = this.save();
      link.download = `GOL-${Date.now()}.txt`;
      link.click();
      window.URL.revokeObjectURL(link.href);
      // console.log("save");
    });

    let load_button = document.querySelector("#load");
    // prompt to open file
    let file_element = document.getElementById("file-select");
    load_button.addEventListener("click", () => {
      file_element.click();
      // console.log("load-returned");
    });

    file_element.addEventListener("input", () => {
      let file = file_element.files[0];
      if (file) {
        file.text().then((content) => {
          this.load(content);
          file_element.value = "";
        });
      }
    });

    let save_image_btn = document.querySelector("#save-image");
    save_image_btn.addEventListener("click", () => {
      link.href = this.saveImage();
      link.download = `GOL-${Date.now()}.png`;
      link.click();
      window.URL.revokeObjectURL(link.href);
      // console.log("save-image");
    });
  }

  saveImage() {
    return CTX.canvas.toDataURL();
  }
}

function run() {
  let controller = new PlaygroundController(CANVAS_HEIGHT, CANVAS_WIDTH, false);
  controller.translator
    .loadFromURL(
      "https://raw.githubusercontent.com/zahmadsaleem/conways-gameoflife/master/samples/hammer-head-spaceship.txt"
    )
    .then(() => controller.play());
}

run();