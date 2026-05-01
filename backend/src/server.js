require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const { getAllowedOrigins } = require("./corsConfig");

const port = process.env.PORT || 4000;
const server = http.createServer(app);
const onlineByWorkspace = new Map();

const io = new Server(server, {
  cors: {
    origin: getAllowedOrigins(),
    credentials: true
  }
});

app.set("io", io);

io.on("connection", (socket) => {
  socket.on("joinWorkspace", ({ workspaceId, user }) => {
    if (!workspaceId || !user) {
      return;
    }
    socket.join(workspaceId);
    const online = onlineByWorkspace.get(workspaceId) || new Map();
    online.set(socket.id, user);
    onlineByWorkspace.set(workspaceId, online);
    io.to(workspaceId).emit("presence:update", Array.from(online.values()));

    socket.on("disconnect", () => {
      online.delete(socket.id);
      io.to(workspaceId).emit("presence:update", Array.from(online.values()));
    });
  });
});

server.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
