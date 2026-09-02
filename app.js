const express =require("express");
const app = express();


app.use(express.json());

app.get("/", (req, res) => {
    res.send("test")
})

module.exports = app;