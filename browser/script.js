const PIXEL_SIZE = 10;
const CANVAS_WIDTH = window.innerWidth - 20;
const CANVAS_HEIGHT = window.innerHeight - 20;
const CANVAS = document.querySelector("#canvas");
CANVAS.width = CANVAS_WIDTH;
CANVAS.height = CANVAS_HEIGHT;
const CTX = CANVAS.getContext("2d");

const PLAYGROUND_CONFIG_DEFAULTS = {
  debug: false,
  wait: 300,
  // infinite
  iterations: -1,
  wait_increment: 25,
  fill_ratio: 0.35,
  show_grid: true,
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
    this.drawCrossHair(x + PIXEL_SIZE / 2, y + PIXEL_SIZE / 2);
    this.fillClosestPixel(x, y);
  };

  fillClosestPixel(x, y) {
    CTX.strokeRect(x, y, PIXEL_SIZE, PIXEL_SIZE);
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
    x = x - (x % PIXEL_SIZE);
    y = y - (y % PIXEL_SIZE);
    return [x, y];
  }

  changeCell = (e) => {
    if (this.#is_drawing) {
      let [x, y] = this.getMouseRowCol(e.offsetX, e.offsetY);
      let cell = this.controller.playground.field[y / PIXEL_SIZE][
        x / PIXEL_SIZE
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

class PlaygroundController {
  STATUS = {
    running: 1,
    paused: 2,
    init: 0,
  };
  player = null;
  #wait = PLAYGROUND_CONFIG_DEFAULTS.wait;
  iter_count = 0;
  editor;
  translator;
  constructor(playground, start = true) {
    this.playground = playground;
    this.state = this.STATUS.init;
    this.editor = new PlaygroundEditor(this);
    this.translator = new PlaygroundTranslator(this);
    if (start) {
      this.initializeControls();
      this.init();
    }
  }

  init(iterations = PLAYGROUND_CONFIG_DEFAULTS.iterations) {
    clearCanvas();
    this.playground.draw();
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
    is_preserve
      ? this.playground.restoreInitialField()
      : this.playground.killAllCells();
    this.init();
    if (this.editor.is_editing) {
      this.editor.saveCurrentImage();
    }
  }

  randomize() {
    this.stop();
    this.playground.randomizeField();
    this.init();
  }

  next() {
    clearCanvas();
    if (this.state === this.STATUS.init) this.state = this.STATUS.paused;
    this.playground.update();
    this.playground.draw();
    this.iter_count++;
    document.getElementById(
      "iteration-number"
    ).innerText = this.iter_count.toString();
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

  initializeControls() {
    let toggle_btn = document.getElementById("toggle-controls");
    toggle_btn.addEventListener("click", () => {
      document.getElementById("controls").classList.toggle("collapse");
      console.log("collapse");
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
      document.getElementById("wait-duration").innerText =
        wait_slider.value + " fps";
      // console.log("wait", (1000 / wait_slider.value).toFixed(0));
    });
  }
}

class Playground {
  constructor(rows, columns) {
    this.rows = rows;
    this.columns = columns;
    this.field = this.generate(true);
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

  draw(debug = PLAYGROUND_CONFIG_DEFAULTS.debug) {
    const process_cell = (cell) => {
      if (cell.alive) {
        CTX.fillStyle = PLAYGROUND_CONFIG_DEFAULTS.generation_color(
          cell.generation
        );
        CTX.fillRect(
          cell.col * PIXEL_SIZE,
          cell.row * PIXEL_SIZE,
          PIXEL_SIZE,
          PIXEL_SIZE
        );
      }
      if (debug) {
        CTX.fillStyle = "white";
        CTX.fillText(
          cell.neighbours(this).length.toString(),
          cell.col * PIXEL_SIZE + PIXEL_SIZE / 2,
          cell.row * PIXEL_SIZE + PIXEL_SIZE / 2
        );
      }
    };
    this.apply(process_cell);
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
    let grid = this.generate(false);
    const process_cell = (cell) => {
      // new generated cell from grid
      let new_cell = grid[cell.row][cell.col];
      // copy state and generation
      new_cell.alive = cell.alive;
      new_cell.generation = cell.generation;
      // check neighbors of old cell
      let length = cell.neighbours(this).length;
      if (cell.alive) {
        if (length > 3 || length < 2) new_cell.die();
        else new_cell.generation++;
      } else {
        if (length === 3) new_cell.live();
      }
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
    return col >= 0 && col < this.columns && row >= 0 && row < this.rows;
  }

  killAllCells() {
    this.field = this.initial_state = this.generate(false);
  }

  randomizeField() {
    this.field = this.initial_state = this.generate(true);
  }
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
    this.controller.playground.apply(process_cell);
    return grid.map((x) => x.join("")).join("\n");
  }
  save() {
    let blob = new Blob([this.stringify()]);
    return URL.createObjectURL(blob);
  }
  load(content) {
    let grid = this.parse(content);
    if (grid) {
      this.controller.restart();
      this.controller.playground.restoreInitialField(grid);
      console.log("loaded");
    } else {
      console.log("invalid field");
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

function clearCanvas(show_grid = PLAYGROUND_CONFIG_DEFAULTS.show_grid) {
  CTX.fillStyle = "black";
  CTX.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  CTX.strokeStyle = "#303030";
  if (show_grid) {
    CTX.beginPath();
    for (let i = 0; i < CANVAS_HEIGHT; i += PIXEL_SIZE) {
      CTX.moveTo(0, i);
      CTX.lineTo(CANVAS_WIDTH, i);
    }
    for (let i = 0; i < CANVAS_WIDTH; i += PIXEL_SIZE) {
      CTX.moveTo(i, 0);
      CTX.lineTo(i, CANVAS_HEIGHT);
    }
    CTX.closePath();
    CTX.stroke();
  }
  CTX.strokeStyle = null;
}

function run() {
  let plg = new Playground(
    CANVAS_HEIGHT / PIXEL_SIZE,
    CANVAS_WIDTH / PIXEL_SIZE
  );
  new PlaygroundController(plg);
}

run();
