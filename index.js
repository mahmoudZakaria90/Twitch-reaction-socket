require("dotenv").config();
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const app = express();
const fetch = require("node-fetch");
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const cors = require("cors");

app.use(
  cors({
    origin: process.env.CLIENT_BASE_URL,
  })
);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_BASE_URL,
  },
});

const config = require("./config");

app.set("view engine", "ejs");
app.use(express.static(__dirname + "/views"));

app.get("/login", function (req, res, next) {
  const state = req.query.state;
  app.set("loginState", state);
  const authURL = `https://${config.VARS.oauth2_url}/authorize?response_type=code&client_id=${config.VARS.client_id}&redirect_uri=${config.VARS.redirect_uri}&scope=chat%3Aread+chat%3Aedit&state=${state}`;
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
    const fetchUserNameRequest = await fetch(
      `${config.VARS.oauth2_url}/validate`,
      {
        headers: {
          "Content-Type": config.oauth2UserHeaders,
          Authorization: `OAuth ${token}`,
        },
      }
    );
    if (fetchUserNameRequest.ok) {
      const username = await fetchUserNameRequest.json();
      res.render("index", { success: true, username: username.login });
      return;
    }
    throw new Error(fetchUserNameRequest.statusText);
  } catch (error) {
    console.error("Fetching username: ", error);
  }
};

app.get("/auth/twitch", redirect_uri_handle);

io.on("connect", (socket) => {
  console.log("a user connected", socket.id);
  // handle custom message
  socket.on("messageInExt", (payload) => {
    payload.user = { ...payload.user, id: uuidv4() };
    io.emit("messageInExtBackToAll", payload);
    io.to(payload.user.socketId).emit(
      "messageInExtBackToSocket",
      payload.message
    );
  });
  //Add reaction
  socket.on("addReaction", (payload) => {
    let reactors = payload.reactors;
    const newReactorUser = {
      displayName: payload.user.displayName,
      profilePic: payload.user.profilePic,
    };
    reactors = [...reactors, newReactorUser];
    io.emit("addRemoveReactionBack", {
      id: payload.id,
      reactionsCount: payload.reactionsCount + 1,
      reactors,
    });
  });
  //Remove reaction
  socket.on("removeReaction", (payload) => {
    const reactors = payload.reactors.filter(
      (reactor) => reactor.displayName !== payload.user.displayName
    );

    io.emit("addRemoveReactionBack", {
      id: payload.id,
      reactionsCount: payload.reactionsCount - 1,
      reactors,
    });
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log("listening on *:3000");
});
