const db = require("../config/db")

const addTransaction = async (req, res) => {
    console.log(JSON.stringify(req.user.familyId))
    const {type, title, description, amount} = req.body;
    const familyId = req.user.familyId;
    try {
        const [transaction] = await db.query("INSERT INTO transactions (familyId, type, title, description, amount) VALUES (?,?,?,?,?) ", [familyId, type, title, description, amount])
        return res.status(201).json({message: "OK"})
    } catch(error) {
        return res.status(500).json({message: "Hiba történt a tranzakció létrehozásakor"})
    }
}

const getTransactions = async (req, res) => {
    const familyId = req.user.familyId; 
    try {
        const [transactions] = await db.query("SELECT * FROM transactions WHERE familyId = ?", [familyId])
        return res.status(200).json(transactions)
    } catch(error) {
        return res.status(500).json({message: "Hiba történt a tranzakciók lekérése során"})
    }
}

const deleteTransaction = async (req, res) => {
    const {transId} = req.body;
    const familyId = req.user.familyId;
    try {
        const [transaction] = await db.query("DELETE FROM transactions WHERE transId = ? AND familyId = ?", [transId, familyId])
        return res.status(200).json({message: "OK"})
    } catch(error){
        return res.status(500).json({message: "Hiba történt a tranzakció törlésekor"})
    }
}

const updateTransaction = async (req, res) => {
    const {transId,title, description, amount} = req.body;
    const familyId = req.user.familyId;
    try {
        const [transaction] = await db.query("UPDATE transactions SET title = ?, description = ?, amount = ? WHERE familyId = ? AND transId = ?", [title, description, amount, familyId, transId])
        return res.status(200).json({message: "OK"})
    } catch(error) {
        return res.status(500).json({message: "Hiba történt a tranzakció módosítása során"})
    }
}

module.exports = {
addTransaction,
getTransactions,
deleteTransaction,
updateTransaction

}