require("dotenv").config();

const cors = require("cors");
const cookieParser = require("cookie-parser");
const express = require("express");
const actionItems = require("./routes/actionItems");
const announcements = require("./routes/announcements");
const auth = require("./routes/auth");
const goals = require("./routes/goals");
const users = require("./routes/users");
const workspaces = require("./routes/workspaces");
const { corsOrigin } = require("./corsConfig");

const app = express();

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "team-hub-api" });
});

app.use("/api/auth", auth);
app.use("/api/users", users);
app.use("/api/workspaces", workspaces);
app.use("/api", goals);
app.use("/api", announcements);
app.use("/api", actionItems);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Unexpected server error" });
});

module.exports = app;
