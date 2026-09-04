const jwt = require("jsonwebtoken");

const auth = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({
            code: "MISSING_TOKEN",
            message: "Nincs token megadva."
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(
            token,
            process.env.TOKEN_SECRET
        );

        req.user = decoded.user;
        next();
    } catch (error) {
        return res.status(401).json({
            code: "INVALID_TOKEN",
            message: "A token érvénytelen vagy lejárt."
        });
    }
};

module.exports = auth;