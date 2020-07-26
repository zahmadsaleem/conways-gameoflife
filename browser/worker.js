self.onmessage = (e) => {
  let response;
  if (!e.data.field) {
    response = respondNoAction();
    postMessage(response);
    return;
  }
  switch (e.data.action) {
    case "update":
      response = update(e.data.field);
      break;
    case "count-live":
      response = countLive(e.data.field);
      break;
    default:
      response = respondNoAction();
  }
  postMessage(response);
};

function respondNoAction() {}

function update(field) {}

function countLive(field) {
  return field
    .flatMap((cells) => cells)
    .reduce((acc, cell) => (cell.alive ? acc + 1 : acc), 0);
}

function applyToField(field, processCell) {
  for (let cell_row of field) {
    for (let cell of cell_row) {
      processCell(cell);
    }
  }
}
