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

class Cell {
  constructor(row, col, alive = false) {
    this.row = row;
    this.col = col;
    this.alive = alive;
    this.generation = 0;
  }

  die() {
    this.alive = false;
    this.generation = 0;
  }

  live() {
    this.alive = true;
  }
}

class Playground {
  is_wrap_rows = true;
  is_wrap_columns = true;

  constructor(rows, columns) {
    this.rows = rows;
    this.columns = columns;
    this.field = this.generate();
    this.initial_state = this.field;
  }

  generate(is_random) {
    let grid = [];
    for (let row = 0; row < this.rows; row++) {
      let _row = [];
      for (let col = 0; col < this.columns; col++) {
        let alive = is_random
          ? Math.random() < PLAYGROUND_CONFIG_DEFAULTS.fill_ratio
          : false;
        _row.push(new Cell(row, col, alive));
      }
      grid.push(_row);
    }
    return grid;
  }

  neighbours(cell) {
    let neighbour_list = [];
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        let row = cell.row + i;
        let col = cell.col + j;
        let neighbor;
        [row, col] = this.getValidIndex(row, col);
        // console.log(`${row},${col}`);
        if (row != null && col != null) neighbor = this.field[row][col];
        if (neighbor && neighbor !== cell && neighbor.alive)
          neighbour_list.push(neighbor);
      }
    }
    return neighbour_list;
  }

  restoreInitialField(field = null) {
    const process_cell = (cell) => {
      let grid = field ? field : this.initial_state;
      let row = grid[cell.row] || this.initial_state[cell.row];
      if (grid[cell.row]) {
        cell.alive = row[cell.col]
          ? row[cell.col].alive
          : field == null
          ? this.initial_state[cell.row][cell.col].alive
          : false;
      } else {
        cell.alive =
          field == null ? this.initial_state[cell.row][cell.col].alive : false;
      }

      cell.generation = 0;
    };
    this.apply(process_cell);
    this.initial_state = this.field;
  }

  update() {
    let grid = [];
    const process_cell = (cell) => {
      // new generated cell from grid
      let new_cell = new Cell(cell.row, cell.col, cell.alive);
      // copy state and generation
      new_cell.generation = cell.generation;
      // check neighbors of old cell
      let length = this.neighbours(cell).length;
      if (cell.alive) {
        if (length > 3 || length < 2) new_cell.die();
        else new_cell.generation++;
      } else {
        if (length === 3) new_cell.live();
      }
      grid[cell.row] = grid[cell.row] || [];
      grid[cell.row][cell.col] = new_cell;
    };
    this.apply(process_cell);
    this.field = grid;
  }

  apply(processCell) {
    // DRY code for looping through field
    for (let cell_row of this.field) {
      for (let cell of cell_row) {
        processCell(cell);
      }
    }
  }

  isValidCell(row, col) {
    return this.isValidColumn(col) && this.isValidRow(row);
  }

  isValidColumn(col) {
    return col >= 0 && col < this.columns;
  }

  isValidRow(row) {
    return row >= 0 && row < this.rows;
  }

  getValidIndex(row, col) {
    if (!this.isValidCell(row.col)) {
      // not a valid row
      if (!this.isValidRow(row)) {
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
      } else {
        // row is fine
      }

      if (!this.isValidColumn(col)) {
        if (this.is_wrap_columns) {
          if (col === this.columns) col = 0;
          else if (col === -1) col = this.columns - 1;
          else col = null;
        } else {
          col = null;
        }
      }
    }
    return [row, col];
  }

  killAllCells() {
    this.field = this.initial_state = this.generate(false);
  }

  randomizeField() {
    this.field = this.initial_state = this.generate(true);
  }

  resize(rows, columns) {
    let colDifference = columns - this.columns;
    let rowDifference = rows - this.rows;

    // add new rows
    if (rowDifference > 0) {
      this.addRowsToEnd(rowDifference, columns);
    }

    // shrink rows
    if (rowDifference < 0) {
      this.deleteRowsFromEnd(rowDifference);
    }

    // extend row
    if (colDifference > 0) {
      this.addColsToEnd(colDifference);
    }

    // shrink row
    if (colDifference < 0) {
      this.deleteColsFromEnd(colDifference);
    }
    this.rows = rows;
    this.columns = columns;
    this.initial_state = this.field;
  }

  addRowsToEnd(rowDifference, columns) {
    for (let i = 0; i < rowDifference; i++) {
      let row_index = this.rows + i;
      this.field[row_index] = this.generateRow(row_index, columns);
    }
  }

  deleteRowsFromEnd(rowDifference) {
    rowDifference = Math.abs(rowDifference);
    for (let i = 0; i < rowDifference; i++) {
      this.field.splice(0, rowDifference);
    }
  }

  addColsToEnd(colDifference) {
    this.field.map((row, i) => {
      row.concat(this.generateRow(i, colDifference, this.columns));
    });
  }

  deleteColsFromEnd(colDifference) {
    colDifference = Math.abs(colDifference);
    this.field.map((_, i) => {
      this.field[i].splice(0, colDifference);
    });
  }

  generateRow(row_index, num_columns, col_start = 0) {
    let row = [];
    for (let i = col_start; i < num_columns; i++)
      row.push(new Cell(row_index, i));
    return row;
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
  countWorker;
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

  draw(debug = PLAYGROUND_CONFIG_DEFAULTS.debug) {
    const process_cell = (cell) => {
      if (cell.alive) {
        CTX.fillStyle = PLAYGROUND_CONFIG_DEFAULTS.generation_color(
          cell.generation
        );
        CTX.fillRect(
          cell.col * this.#pixel_size,
          cell.row * this.#pixel_size,
          this.#pixel_size,
          this.#pixel_size
        );
      }
      if (debug) {
        CTX.fillStyle = "white";
        CTX.fillText(
          this.neighbours(cell).length.toString(),
          cell.col * this.#pixel_size + this.#pixel_size / 2,
          cell.row * this.#pixel_size + this.#pixel_size / 2
        );
      }
    };
    this.apply(process_cell);
  }

  clearCanvas(show_grid = PLAYGROUND_CONFIG_DEFAULTS.show_grid) {
    CTX.fillStyle = "black";
    CTX.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    CTX.strokeStyle = "#303030";
    if (show_grid) {
      CTX.beginPath();
      for (let i = 0; i < CANVAS_HEIGHT; i += this.#pixel_size) {
        CTX.moveTo(0, i);
        CTX.lineTo(CANVAS_WIDTH, i);
      }
      for (let i = 0; i < CANVAS_WIDTH; i += this.#pixel_size) {
        CTX.moveTo(i, 0);
        CTX.lineTo(i, CANVAS_HEIGHT);
      }
      CTX.closePath();
      CTX.stroke();
    }
    CTX.strokeStyle = null;
  }

  fitToCanvas() {
    this.resize(
      (CANVAS_HEIGHT / this.#pixel_size) >> 0,
      (CANVAS_WIDTH / this.#pixel_size) >> 0
    );
  }

  get pixel_size() {
    return this.#pixel_size;
  }

  set pixel_size(size) {
    let current_state = this.state;
    this.stop(true);
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
    this.draw();
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
    this.count();
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
    this.update();
    this.draw();
    this.iter_count++;
    document.getElementById(
      "iteration-number"
    ).innerText = this.iter_count.toString();
    this.count();
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

  count() {
    let _field = this.field;
    this.countWorker.postMessage({ action: "count-live", field: _field });
  }

  updateCountUI(count) {
    document.getElementById("live-count").innerHTML = count.toString();
  }

  initializeControls() {
    this.countWorker = new Worker("worker.js");
    this.countWorker.onmessage = (e) => this.updateCountUI(e.data);
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
      this.pixel_size = pixel_slider.value;
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
      let cell = this.controller.field[y / this.controller.pixel_size][
        x / this.controller.pixel_size
      ];
      if (cell) {
        cell.alive = !cell.alive;
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
  parse(content, char_map = { "-": false, "0": true }) {
    let string_rows = content.trim().split("\n");
    let char_grid = string_rows.map((r) => r.trim().split(""));
    if (!char_grid.every((row) => row.length === char_grid[0].length)) {
      return null;
    }
    return char_grid.map((row, row_index) =>
      row.map(
        (char, col_index) => new Cell(row_index, col_index, char_map[char])
      )
    );
  }

  stringify() {
    let grid = [];
    const process_cell = (cell) => {
      grid[cell.row] = grid[cell.row] || [];
      grid[cell.row].push(this.chars[Number(cell.alive)]);
    };
    this.controller.apply(process_cell);
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
