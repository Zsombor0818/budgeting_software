const db = require("../config/db")

const addEvent = async (req, res) => {
    console.log(JSON.stringify(req.user.familyId))
    const {title, description, date} = req.body;
    const familyId = req.user.familyId;

    const [event] = await db.query("INSERT INTO calendar (familyId, title, description, date) VALUES (?,?,?,?) ", [familyId, title, description, date])

    return res.status(200).json({message: "ok"})
}

const getEvent = async (req, res) => {
    const familyId = req.user.familyId; 

    const [events] = await db.query("SELECT * FROM calendar WHERE familyId = ?", [familyId])
      return res.status(200).json(events)
}

const deleteEvent = async (req, res) => {
    const {eventId} = req.body;
    const familyId = req.user.familyId;

    const [event] = await db.query("DELETE FROM calendar WHERE eventId = ? AND familyId = ?", [eventId, familyId])
  return res.status(200).json({message: "ok"})
}

const updateEvent = async (req, res) => {
    const {eventId,title, description, date} = req.body;
    const familyId = req.user.familyId;

    const [event] = await db.query("UPDATE calendar SET title = ?, description = ?, date = ? WHERE familyId = ? AND eventId = ?", [title, description, date, familyId, eventId])

    return res.status(200).json({message: "ok"})
}

module.exports = {
addEvent,
getEvent,
deleteEvent,
updateEvent

}