const app = require("./app")
require("dotenv").config();

app.listen(process.env.PORT,() => {
  console.log("started on port 3000")
})