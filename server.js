require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // Serves index.html and static files

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => {
    console.log("✅ Connected to MongoDB");
});

// Trade Schema & Model
const tradeSchema = new mongoose.Schema({
    userId: String,
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

// --- API Routes ---

// Search symbols
app.get("/api/search-symbols", async (req, res) => {
    const userQuery = req.query.q || req.query.query;
    if (!userQuery) {
        return res
            .status(400)
            .json({ error: "Query parameter 'q' is required" });
    }

    const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(
        userQuery
    )}&token=${process.env.FINNHUB_API_KEY}`;

    try {
        const response = await axios.get(url);
        res.json(response.data);
    } catch (err) {
        console.error("Error fetching symbols:", err);
        res.status(500).json({
            error: "Something went wrong fetching symbols",
        });
    }
});

// Get company profile
app.get("/api/company-profile", async (req, res) => {
    const symbol = req.query.symbol;
    if (!symbol) {
        return res
            .status(400)
            .json({ error: "Symbol query parameter is required" });
    }

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
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch company profile" });
    }
});

// Create trade
app.post("/api/trades", async (req, res) => {
    try {
        const trade = new Trade(req.body);
        const savedTrade = await trade.save();
        res.status(201).json(savedTrade);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to save trade" });
    }
});

// Get all trades
app.get("/api/trades", async (req, res) => {
    try {
        const trades = await Trade.find().sort({ exitDate: -1, entryDate: -1 });
        res.json(trades);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to get trades" });
    }
});

// Get single trade
app.get("/api/trades/:id", async (req, res) => {
    try {
        const trade = await Trade.findById(req.params.id);
        if (!trade) {
            return res.status(404).json({ error: "Trade not found" });
        }
        res.json(trade);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch trade" });
    }
});

// Serve journal entry page
app.get("/journal/:id", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "journal-entry.html"));
});

// Catch-all: redirect to index.html for SPA routing fallback (Express 5 fix)
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
