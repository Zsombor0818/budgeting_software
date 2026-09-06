const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const auth = require("../middleware/auth")
require("dotenv").config();

const register = async (req, res) => {
    const {username, email, password, password_again} = req.body;

    if (password !== password_again) {
        return res.send("A jelszavak nem egyeznek")
    }

    const hashed_password = await bcrypt.hash(password, 10);

    const [users] = await db.query("SELECT username, email FROM users WHERE username = ? OR email = ?", [username, email])
    
    if (users.length > 0) {
        if (users.some(user => user.username === username)) {
           return res.send("foglalt username")
        } else if (users.some(user => user.email === email)) {
           return res.send("foglalt email")
        }
    } 

    //register

    const user = await db.query("INSERT INTO users (username, email, password) VALUES (?,?,?)", [username, email, hashed_password])
    return res.send("siker")
}

const login = async (req, res) => {
    const {username, password} = req.body;
    console.log(username, password)
    const [user] = await db.query(`
    SELECT users.*, family_members.familyId
    FROM users
    LEFT JOIN family_members ON users.id = family_members.userId
    WHERE users.username = ? OR users.email = ?
`, [username, username]);
    if (user.length != 0 && await bcrypt.compare(password, user[0].password)) {

        const {password, ...userWithoutPassword} = user[0];
        const token = jwt.sign({
            user: userWithoutPassword,
        }, process.env.TOKEN_SECRET, {expiresIn: process.env.TOKEN_EXPIRATION})

        return res.status(200).json({
            code: "LOGIN_SUCCESSUL",
            message: "Sikeres bejelentkezés",
            token: token
        })
    } else {
        return res.status(401).json({
            code: "INVALID_CREDENTIALS",
            message: "Hibás email cím vagy jelszó" 
        })
    }
}

const user = (req, res) => {
    res.status(200).json({
        user: req.user,
        code: "ACCESS_GRANTED"
    })
}
module.exports = {register, login, user};