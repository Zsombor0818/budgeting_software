const router = require("express").Router();
const path = require("path")
const auth = require("../middleware/auth")

const userController = require("../controllers/userController")

router.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "../public", "login.html"));
});

router.get("/register", (req, res) => {
    res.sendFile(path.join(__dirname, "../public", "register.html"));
});

router.get("/dashboard", (req, res) => {
    res.sendFile(path.join(__dirname, "../public", "dashboard.html"));
});


module.exports = router; 