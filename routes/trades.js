const express = require("express");
const router = express.Router();

// Test GET route
router.get("/", (req, res) => {
    res.json({ message: "Trades endpoint works!" });
});

module.exports = router;
