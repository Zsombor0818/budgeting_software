const router = require("express").Router();
const path = require("path")

const userController = require("../controllers/userController")

router.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "../public", "login.html"));
});

router.get("/aks", (req, res) => {
    res.sendFile(path.join(__dirname, "../public", "aks.html"));
});


module.exports = router;