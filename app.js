const chokidar = require("chokidar");
const path = require("path");
const client = require("amqplib/callback_api");

var q = "import_images";

function bail(err) {
  console.error(err);
  process.exit(1);
}

// Publisher
function publisher(conn, msg) {
  conn.createChannel(on_open);
  function on_open(err, ch) {
    if (err != null) bail(err);
    ch.assertQueue(q);
    ch.sendToQueue(q, Buffer.from(JSON.stringify(msg)));
  }
}
function formatTofolderPath(eventPath) {
  let relativePath = eventPath.split(path.join(__dirname, ".."))[1];
  //check if it is windows path and replace all \ to  /
  while (relativePath.includes("\\")) {
    relativePath = relativePath.replace("\\", "/");
  }
  relativePath = relativePath.slice(1);
  return relativePath;
}
client.connect("amqp://localhost", function (err, conn) {
  if (err != null) bail(err);

  // One-liner for current directory
  chokidar
    .watch(path.join(__dirname, "..", "images"))
    .on("addDir", (eventPath) => {
      let folderPath = formatTofolderPath(eventPath);
      const msg = {
        event: "addDir",
        folderPath,
      };
      publisher(conn, msg);
    })
    .on("unlinkDir", (eventPath) => {
      let folderPath = formatTofolderPath(eventPath);
      const msg = {
        event: "unlinkDir",
        folderPath,
      };
      publisher(conn, msg);
    })
    .on("add", (eventPath) => {
      let relativePath = formatTofolderPath(eventPath);
      const filename = relativePath.split("/")[
        relativePath.split("/").length - 1
      ];
      const folderPath = relativePath.split(filename)[0].slice(0, -1);
      const msg = {
        event: "add",
        folderPath,
        filename,
      };
      const fileType = filename.split(".")[filename.split(".").length - 1];
      if (fileType !== "jpeg" && fileType !== "jpg" && fileType !== "png") {
        return;
      }
      publisher(conn, msg);
    })
    .on("unlink", (eventPath) => {
      let relativePath = formatTofolderPath(eventPath);
      const filename = relativePath.split("/")[
        relativePath.split("/").length - 1
      ];
      const folderPath = relativePath.split(filename)[0].slice(0, -1);
      const msg = {
        event: "unlink",
        folderPath,
        filename,
      };
      const fileType = filename.split(".")[filename.split(".").length - 1];
      if (fileType !== "jpeg" && fileType !== "jpg" && fileType !== "png") {
        return;
      }
      publisher(conn, msg);
    });
});
