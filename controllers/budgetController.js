const db = require("../config/db")

const addTransaction = async (req, res) => {
    console.log(JSON.stringify(req.user.familyId))
    const {type, title, description, amount} = req.body;
    const familyId = req.user.familyId;

    const [transaction] = await db.query("INSERT INTO transactions (familyId, type, title, description, amount) VALUES (?,?,?,?,?) ", [familyId, type, title, description, amount])

    return res.status(200).json({message: "ok"})
}

const getTransactions = async (req, res) => {
    const familyId = req.user.familyId; 

    const [transactions] = await db.query("SELECT * FROM transactions WHERE familyId = ?", [familyId])
      return res.status(200).json(transactions)
}

const deleteTransaction = async (req, res) => {
    const {transId} = req.body;
    const familyId = req.user.familyId;

    const [transaction] = await db.query("DELETE FROM transactions WHERE transId = ? AND familyId = ?", [transId, familyId])
  return res.status(200).json({message: "ok"})
}

const updateTransaction = async (req, res) => {
    const {transId,title, description, amount} = req.body;
    const familyId = req.user.familyId;

    const [transaction] = await db.query("UPDATE transactions SET title = ?, description = ?, amount = ? WHERE familyId = ? AND transId = ?", [title, description, amount, familyId, transId])

    return res.status(200).json({message: "ok"})
}

module.exports = {
addTransaction,
getTransactions,
deleteTransaction,
updateTransaction

}