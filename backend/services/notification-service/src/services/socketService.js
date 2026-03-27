const { Server } = require("socket.io");
const env = require("../config/env");

const attachSocketServer = (server) => {
  if (!env.enableSocketIo) {
    return null;
  }

  const io = new Server(server, {
    cors: {
      origin: env.corsOrigin === "*" ? true : env.corsOrigin.split(",")
    }
  });

  io.on("connection", (socket) => {
    socket.on("notification.join", (userId) => {
      if (userId) {
        socket.join(`user:${userId}`);
      }
    });
  });

  return io;
};

module.exports = { attachSocketServer };
