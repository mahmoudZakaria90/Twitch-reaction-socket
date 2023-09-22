require("dotenv").config();
const express = require("express");
const session = require("express-session");
const app = express();
const fetch = require("node-fetch");
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: "http://localhost:8080",
});

const config = require("./config");

app.set("view engine", "ejs");
app.use(express.static(__dirname + "/views"));

app.get("/login", function (req, res, next) {
  const state = req.query.state;
  app.set("loginState", state);
  const authURL = `https://id.twitch.tv/oauth2/authorize?response_type=code&client_id=${config.VARS.client_id}&redirect_uri=${config.VARS.redirect_uri}&scope=chat%3Aread+chat%3Aedit&state=${state}`;
  res.redirect(authURL);
});

const redirect_uri_handle = async (req, res) => {
  const routeState = req.query.state;
  const loginState = app.get("loginState");

  if (routeState !== loginState) {
    res.status(400).render("index", { success: false });
    return;
  }
  try {
    const response = await fetch(`${config.VARS.oauth2_url}/token`, {
      method: "POST",
      headers: config.oauth2Headers,
      body: new URLSearchParams({
        ...config.oauth2Params,
        code: req.query.code,
      }),
    });
    if (response.ok) {
      const results = await response.json();
      io.to(req.query.state).emit("token", results.access_token);
      fetchUserName(res, results.access_token);
      return;
    }
    throw new Error(response.statusText);
  } catch (error) {
    console.error(error);
  }
};

const fetchUserName = async (res, token) => {
  try {
    const fetchUserName = await fetch(`${config.VARS.oauth2_url}/validate`, {
      headers: {
        "Content-Type": config.oauth2UserHeaders,
        Authorization: `OAuth ${token}`,
      },
    });
    if (fetchUserName.ok) {
      const username = await fetchUserName.json();
      res.render("index", { success: true, username: username.login });
      return;
    }
    throw new Error(fetchUserName.statusText);
  } catch (error) {
    console.error("Fetching username: ", error);
  }
};

app.get("/auth/twitch", redirect_uri_handle);

app.get("/index", function (req, res) {
  res.render("index", { success: true, username: "zekooo" });
});

io.on("connect", (socket) => {
  console.log("a user connected", socket.id);
  //Add reaction
  socket.on("addReaction", (payload) => {
    io.emit("addRemoveReactionBack", {
      id: payload.id,
      reactionsCount: Number(payload.reactionsCount) + 1,
    });
  });
  //Remove reaction
  socket.on("removeReaction", (payload) => {
    io.emit("addRemoveReactionBack", {
      id: payload.id,
      reactionsCount: Number(payload.reactionsCount) - 1,
    });
  });
});

server.listen(3000, () => {
  console.log("listening on *:3000");
});
