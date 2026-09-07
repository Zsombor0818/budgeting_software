const db = require("../config/db")

const createFamily = async (req, res) => {
    const {familyName} = req.body;
    const userId = req.user.id;

    const familyId = Math.floor(Math.random() * 90000) + 10000;
    const family = await db.query("INSERT INTO families (familyId, userId, familyName) VALUES (?,?,?)", [familyId, userId, familyName])
     return res.status(200).json({message: "ok"})
}

const deleteFamily = async (req, res) => {
    const {familyId} = req.body;
    const userId = req.user.id;
    const deleteFamily = await db.query("DELETE FROM families WHERE familyId = ? AND userId = ?", [familyId, userId])
    const deleteMebers = await db.query("DELETE FROM family_members WHERE familyId = ? AND userId = ?", [familyId, userId])
 return res.status(200).json({message: "ok"})
}

const updateFamily = async (req, res) => {
   const {familyId,familyName} = req.body;
   const userId = req.user.id;

   const updateFamily = await db.query("UPDATE families SET familyName = ? WHERE familyId = ? AND userId = ?", [familyName, familyId, userId])
 return res.status(200).json({message: "ok"})
}

const addMember = async (req, res) => {
    const {familyId} = req.body;
    const userId = req.user.id;
    const addMember = await db.query("INSERT INTO family_members (userId, familyId) VALUES (?,?)", [userId, familyId])
 return res.status(200).json({message: "ok"})
}

const removeMember = async (req, res) => {
    const {familyId} = req.body;
    const userId = req.user.id;
    const removeMember = await db.query("DELETE FROM family_members WHERE userId = ? AND familyId = ?", [userId, familyId])
 return res.status(200).json({message: "ok"})
}

const familyData = async (req, res) => {
    const familyId = req.user.familyId;
    const userId = req.user.id;

    const [family] = await db.query(
        "SELECT familyId, familyName, userId AS ownerId FROM families WHERE familyId = ?",
        [familyId]
    );

    const [members] = await db.query(
        `SELECT 
            u.id,
            u.username,
            u.email,
            CASE 
                WHEN f.userId = u.id THEN true
                ELSE false
            END AS owner
        FROM family_members fm
        JOIN users u ON fm.userId = u.id
        JOIN families f ON fm.familyId = f.familyId
        WHERE fm.familyId = ?`,
        [familyId]
    );

    return res.status(200).json({
        family: family[0],
        members
    });
};

module.exports = {
    createFamily, 
    deleteFamily,
    updateFamily,
    addMember,
    removeMember,
    familyData
}