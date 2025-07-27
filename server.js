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
// Analyst recommendations route
app.get("/api/recommendations", async (req, res) => {
    const symbol = req.query.symbol;
    if (!symbol) {
        return res
            .status(400)
            .json({ error: "Symbol query parameter is required" });
    }

    try {
        const url = `https://finnhub.io/api/v1/stock/recommendation?symbol=${encodeURIComponent(
            symbol
        )}&token=${process.env.FINNHUB_API_KEY}`;
        const response = await axios.get(url);

        // Finnhub returns an array of recommendations (usually sorted by date desc)
        // We'll return the most recent entry (first element)
        if (response.data && response.data.length > 0) {
            res.json(response.data[0]);
        } else {
            res.status(404).json({ error: "No recommendation data found" });
        }
    } catch (error) {
        console.error("Error fetching recommendations:", error.message);
        res.status(500).json({ error: "Failed to fetch recommendations" });
    }
});
// Insider Sentiment route
app.get("/api/insider-sentiment", async (req, res) => {
    const symbol = req.query.symbol;
    const from = req.query.from;
    const to = req.query.to;

    if (!symbol || !from || !to) {
        return res.status(400).json({
            error: "symbol, from, and to query parameters are required",
        });
    }

    try {
        const url = `https://finnhub.io/api/v1/stock/insider-sentiment?symbol=${encodeURIComponent(
            symbol
        )}&from=${from}&to=${to}&token=${process.env.FINNHUB_API_KEY}`;
        const response = await axios.get(url);

        if (
            response.data &&
            response.data.data &&
            response.data.data.length > 0
        ) {
            res.json(response.data);
        } else {
            res.status(404).json({ error: "No insider sentiment data found" });
        }
    } catch (error) {
        console.error("Error fetching insider sentiment:", error.message);
        res.status(500).json({ error: "Failed to fetch insider sentiment" });
    }
});

// IPO Calendar route
app.get("/api/ipo-calendar", async (req, res) => {
    const from = req.query.from;
    const to = req.query.to;

    if (!from || !to) {
        return res
            .status(400)
            .json({ error: "'from' and 'to' query parameters are required" });
    }

    try {
        const url = `https://finnhub.io/api/v1/calendar/ipo?from=${from}&to=${to}&token=${process.env.FINNHUB_API_KEY}`;
        const response = await axios.get(url);

        if (response.data && response.data.ipoCalendar) {
            res.json(response.data);
        } else {
            res.status(404).json({ error: "No IPO calendar data found" });
        }
    } catch (error) {
        console.error("Error fetching IPO calendar:", error.message);
        res.status(500).json({ error: "Failed to fetch IPO calendar" });
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

// Updated server.js news route with better filtering
app.get("/api/news", async (req, res) => {
    const symbol = req.query.symbol;
    if (!symbol) {
        return res
            .status(400)
            .json({ error: "Symbol query parameter is required" });
    }

    try {
        // Use both the symbol (e.g. AAPL) and company name (e.g. Apple Inc) to broaden match
        const company = await Trade.findOne({ symbol }).sort({ updatedAt: -1 });
        const companyName = company?.companyName || "";

        const query = `${symbol} OR \"${companyName}\"`;

        const response = await axios.get("https://newsapi.org/v2/everything", {
            params: {
                q: query,
                sortBy: "publishedAt",
                language: "en",
                apiKey: process.env.NEWS_API_KEY, // moved to env
                pageSize: 5,
                sources: [
                    "bloomberg",
                    "cnbc",
                    "business-insider",
                    "financial-post",
                    "the-wall-street-journal",
                    "reuters",
                ].join(","), // target financial news sources only
            },
        });

        res.json(response.data);
    } catch (err) {
        console.error("Error fetching news:", err.message);
        res.status(500).json({ error: "Failed to fetch news articles" });
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
