const jwt = require("jsonwebtoken");
const db = require("../config/db");

const auth = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({message: "Nincs token megadva."});
    }
    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(
            token,
            process.env.TOKEN_SECRET
        );

        const [users] = await db.query(`SELECT users.id, users.username, users.email, family_members.familyId FROM users LEFT JOIN family_members ON users.id = family_members.userId WHERE users.id = ?`, [decoded.userId]);
        if (users.length === 0) {
            return res.status(401).json({message: "A felhasználó nem létezik."});
        }
        req.user = users[0];
        next();

    } catch (error) {
        return res.status(401).json({message: "Érvénytelen vagy lejárt token."});
    }
};

module.exports = auth;