require("dotenv").config();
const chokidar = require("chokidar");
const path = require("path");
const client = require("amqplib/callback_api");
const internalIp = require("internal-ip");
const express = require("express");
const fs = require("fs");
const app = express();
const dirTree = require("directory-tree");
const ip = internalIp.v4.sync();

const { BROKER_IP, BROKER_PORT, BROKER_QUEUE, WATCH_FOLDER } = process.env;

app.use(express.static(path.join(__dirname, "..", WATCH_FOLDER)));

function bail(err) {
  console.error(err);
  process.exit(1);
}

// Publisher
function publisher(ch, msg) {
  ch.assertQueue(BROKER_QUEUE);
  ch.sendToQueue(BROKER_QUEUE, Buffer.from(JSON.stringify(msg)));
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
// const dirs = [];
// const files = [];

// function parseDir(dirObject) {
//   if (dirObject.children) {
//     dirs.push([formatTofolderPath(dirObject.path), ip, new Date()]);
//     dirObject.children.forEach((obj) => parseDir(obj));
//   } else {
//     let relativePath = formatTofolderPath(dirObject.path);
//     const filename = relativePath.split("/")[
//       relativePath.split("/").length - 1
//     ];
//     const folderPath = relativePath.split(filename)[0].slice(0, -1);
//     files.push({ folderPath, filename, origin: ip });
//   }
//   return { dirs, files };
// }

//stats = fs.statSync
// const filteredTree = dirTree(watchPath, {
//   extensions: /\.(jpg|jpeg|png)$/,
// });
// const { dirs: updatedDirs, files: updatedFiles } = parseDir(filteredTree);
// console.log(updatedDirs);
// console.log(updatedFiles);

client.connect(
  `amqp://${BROKER_IP}:${BROKER_PORT}`,
  async function (err, conn) {
    if (err != null) bail(err);
    const channel = await conn.createChannel();
    // One-liner for current directory
    const watchPath = path.join(__dirname, "..", WATCH_FOLDER);

    chokidar
      .watch(watchPath)
      .on("addDir", (eventPath) => {
        let folderPath = formatTofolderPath(eventPath);
        const msg = {
          event: "addDir",
          folderPath,
          origin: ip,
        };
        publisher(channel, msg);
      })
      .on("unlinkDir", (eventPath) => {
        let folderPath = formatTofolderPath(eventPath);
        const msg = {
          event: "unlinkDir",
          folderPath,
          origin: ip,
        };
        publisher(channel, msg);
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
        publisher(channel, msg);
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
        publisher(channel, msg);
      });
  }
);

app.listen(80, () => {
  console.log(`server is running on 80`);
});
