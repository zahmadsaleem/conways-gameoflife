self.onmessage = (e) => {
  let response;
  switch (e.data.action) {
    case "count-live":
      response = countLive(e.data.field);
      break;
    default:
      response = respondNoAction();
  }
  postMessage(response);
};

function respondNoAction() {}

function countLive(field) {
  return field
    .flatMap((cells) => cells)
    .reduce((acc, cell) => (cell.alive ? acc + 1 : acc), 0);
}
