// index.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => {
    console.log("Connected to MongoDB");
});

// Define Mongoose schema for trade log
const tradeSchema = new mongoose.Schema({
    userId: String, // you can extend with auth later
    symbol: String,
    companyName: String,
    entryPrice: Number,
    exitPrice: Number,
    quantity: Number,
    positionSize: Number,
    tradeType: String,
    entryDate: Date,
    exitDate: Date,
    stopLoss: Number,
    takeProfit: Number,
    notes: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

const Trade = mongoose.model("Trade", tradeSchema);

// Serve static frontend files from 'public' folder
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/search-symbols", async (req, res) => {
    const userQuery = req.query.query || req.query.q; // Accept both ?query= and ?q=

    if (!userQuery) {
        return res.status(400).json({ error: "Query parameter is required" });
    }

    const url = `https://finnhub.io/api/v1/search?q=${userQuery}&token=${process.env.FINNHUB_API_KEY}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error("Error fetching symbols:", err);
        res.status(500).json({ error: "Something went wrong" });
    }
});

// API route: Get company profile by symbol
app.get("/api/company-profile", async (req, res) => {
    const symbol = req.query.symbol;
    if (!symbol)
        return res
            .status(400)
            .json({ error: "Symbol query parameter is required" });

    try {
        const response = await axios.get(
            "https://finnhub.io/api/v1/stock/profile2",
            {
                params: {
                    symbol,
                    token: process.env.FINNHUB_API_KEY,
                },
            }
        );
        res.json(response.data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch company profile" });
    }
});

// API route: Create a new trade log
app.post("/api/trades", async (req, res) => {
    try {
        const trade = new Trade(req.body);
        const savedTrade = await trade.save();
        res.status(201).json(savedTrade);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to save trade" });
    }
});

// API route: Get all trades (simple example, no auth)
app.get("/api/trades", async (req, res) => {
    try {
        const trades = await Trade.find().sort({ createdAt: -1 });
        res.json(trades);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to get trades" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
