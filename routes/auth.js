const express = require("express");
const router = express.Router();

// Test route
router.get("/", (req, res) => {
    res.json({ message: "🔐 Auth endpoint works!" });
});

module.exports = router;
