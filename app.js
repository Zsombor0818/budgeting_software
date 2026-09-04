const express =require("express");
const app = express();
const path = require("path")

app.use(express.json());


app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

const apiRouter = require("./routes/api");
app.use("/api", apiRouter);

const publicRouter = require("./routes/publicRoutes");
app.use("/", publicRouter)

module.exports = app;