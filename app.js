require("dotenv").config();
const chokidar = require("chokidar");
const path = require("path");
const client = require("amqplib/callback_api");
const internalIp = require("internal-ip");
const express = require("express");
const app = express();

const {
  BROKER_IP,
  BROKER_PORT,
  BROKER_QUEUE,
  HOST_PORT,
  WATCH_FOLDER,
} = process.env;

app.use(express.static(path.join(__dirname, "..", WATCH_FOLDER)));

function bail(err) {
  console.error(err);
  process.exit(1);
}

// Publisher
function publisher(conn, msg) {
  conn.createChannel(on_open);
  function on_open(err, ch) {
    if (err != null) bail(err);
    ch.assertQueue(BROKER_QUEUE);
    ch.sendToQueue(BROKER_QUEUE, Buffer.from(JSON.stringify(msg)));
  }
}
function formatTofolderPath(eventPath) {
  let relativePath = eventPath.split(
    path.join(__dirname, "..", WATCH_FOLDER)
  )[1];
  //check if it is windows path and replace all \ to  /
  while (relativePath.includes("\\")) {
    relativePath = relativePath.replace("\\", "/");
  }
  relativePath = relativePath.slice(1);
  return relativePath;
}

client.connect(
  `amqp://${BROKER_IP}:${BROKER_PORT}`,
  async function (err, conn) {
    if (err != null) bail(err);
    const ip = internalIp.v4.sync();
    // One-liner for current directory
    chokidar
      .watch(path.join(__dirname, "..", WATCH_FOLDER))
      .on("addDir", (eventPath) => {
        let folderPath = formatTofolderPath(eventPath);
        const msg = {
          event: "addDir",
          folderPath,
          origin: ip,
        };
        publisher(conn, msg);
      })
      .on("unlinkDir", (eventPath) => {
        let folderPath = formatTofolderPath(eventPath);
        const msg = {
          event: "unlinkDir",
          folderPath,
          origin: ip,
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
          origin: ip,
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
          origin: ip,
        };
        const fileType = filename.split(".")[filename.split(".").length - 1];
        if (fileType !== "jpeg" && fileType !== "jpg" && fileType !== "png") {
          return;
        }
        publisher(conn, msg);
      });
  }
);

app.listen(HOST_PORT, () => {
  console.log(`server is running on ${HOST_PORT}`);
});
