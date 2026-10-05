const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const auth = require("../middleware/auth")
require("dotenv").config();

const register = async (req, res) => {
    const {username, email, password, password_again} = req.body;
    if (password !== password_again) {
        return res.status(400).json({message: "A jelsavak nem egyeznek"})
    }
    const hashed_password = await bcrypt.hash(password, 10);

    try {
        const [users] = await db.query("SELECT username, email FROM users WHERE username = ? OR email = ?", [username, email])
            if (users.length > 0) {
                if (users.some(user => user.username === username)) {
                    return res.status(409).json("A felhasználónév már foglalt")
                } else if (users.some(user => user.email === email)) {
                    return res.status(409).json("Az email cím már foglalt")
                }
            } 
            const user = await db.query("INSERT INTO users (username, email, password) VALUES (?,?,?)", [username, email, hashed_password])
            return res.status(201).json({message: "OK"})
    } catch(error) {
        return res.status(500).json({message: "Hiba történt a regisztráció során"})
    }
    
}

const login = async (req, res) => {
    const { username, password } = req.body;
    try {
        const [users] = await db.query(`SELECT users.* FROM users WHERE users.username = ? OR users.email = ? `, [username, username]);
            if (users.length !== 0 && await bcrypt.compare(password, users[0].password)) {
                const token = jwt.sign({
                        userId: users[0].id
                }, process.env.TOKEN_SECRET, {expiresIn: process.env.TOKEN_EXPIRATION});
                return res.status(200).json({message: "OK", token});
            }
            return res.status(401).json({message: "Hibás email cím vagy jelszó"});
    } catch(error) {
        return res.status(500).json({message: "Hiba történt a bejelentkezés során"})
    }   
};

const user = async (req, res) => {
    try {
    const [users] = await db.query(`SELECT users.id, users.username, users.email, family_members.familyId FROM users LEFT JOIN family_members ON users.id = family_members.userId WHERE users.id = ? `, [req.user.id]);
        if (users.length === 0) {
            return res.status(401).json({message: "A felhasználó nem létezik"});
        }
        return res.status(200).json({user: users[0]});
    } catch(error) {
        return res.status(500).json({message: "Hiba történt a felhasználó lekérése során"})
    }
    
};

module.exports = {
    register,
    login,
    user
};