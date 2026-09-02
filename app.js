const express =require("express");
const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.send("test")
})

const apiRouter = require("./routes/api");

app.use("/api", apiRouter);

module.exports = app;