const router = require("express").Router();
const auth = require("../middleware/auth")

const userController = require("../controllers/userController")
const familyController = require("../controllers/familyController")

router.post("/register", userController.register)
router.post("/login", userController.login)
router.get("/user", auth, userController.user)

router.get("/family", auth, familyController.familyData)
router.post("/family", auth, familyController.createFamily)
router.put("/family", auth, familyController.updateFamily)
router.delete("/family", auth, familyController.deleteFamily)

router.post("/member", auth, familyController.addMember)
router.delete("/member", auth, familyController.removeMember)

module.exports = router;