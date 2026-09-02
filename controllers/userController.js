const db = require("../config/db");
const bcrypt = require("bcrypt");

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

module.exports = {register};