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

router.get("/transactions", (req, res) => {
    res.sendFile(path.join(__dirname, "../public", "transactions.html"));
});

router.get("/calendar", (req, res) => {
    res.sendFile(path.join(__dirname, "../public", "calendar.html"));
});

router.get("/family", (req, res) => {
    res.sendFile(path.join(__dirname, "../public", "family.html"));
});

module.exports = router; 