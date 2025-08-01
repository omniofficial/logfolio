require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const axios = require("axios");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3000;

const User = require("./models/User");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => {
    console.log("✅ Connected to MongoDB");
});

// --- MODELS ---
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

// --- MIDDLEWARE ---
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) return res.status(401).json({ message: "Missing token" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ message: "Invalid token" });
    }
}

function authorize(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        next();
    };
}

// --- AUTH ROUTES ---
app.post("/register", async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: "Email already in use" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            role: role || "user",
        });

        await newUser.save();

        const token = jwt.sign(
            { id: newUser._id, role: newUser.role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({ token });
    } catch (err) {
        console.error("Register error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res
                .status(400)
                .json({ message: "Missing email or password" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        console.log(`A User connected: ${token}`);

        res.json({ token });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

app.post("/logout", (req, res) => {
    const token =
        req.headers.authorization?.split(" ")[1] || req.body.token || null;
    console.log("Authorization header:", req.headers.authorization);
    console.log("Logout route hit. Token received:", token);

    if (token) {
        console.log(`A User disconnected: ${token}`);
    } else {
        console.log("Logout requested but no token provided");
    }

    res.json({ message: "Logged out" });
});

// --- TRADE ROUTES ---
app.post("/api/trades", authenticate, async (req, res) => {
    try {
        const trade = new Trade({
            ...req.body,
            userId: req.user.id,
        });
        const savedTrade = await trade.save();
        res.status(201).json(savedTrade);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to save trade" });
    }
});

app.get("/api/trades", authenticate, async (req, res) => {
    try {
        const filter = req.user.role === "admin" ? {} : { userId: req.user.id };
        const trades = await Trade.find(filter).sort({
            exitDate: -1,
            entryDate: -1,
        });

        res.json(trades);
    } catch (err) {
        console.error("Error fetching user trades:", err);
        res.status(500).json({ error: "Failed to fetch user trades" });
    }
});

app.get("/api/trades/:id", authenticate, async (req, res) => {
    try {
        const trade = await Trade.findById(req.params.id);

        if (!trade) {
            return res.status(404).json({ error: "Trade not found" });
        }

        if (trade.userId !== req.user.id && req.user.role !== "admin") {
            return res.status(403).json({ error: "Unauthorized" });
        }

        res.json(trade);
    } catch (err) {
        console.error("Error fetching trade:", err);
        res.status(500).json({ error: "Failed to fetch trade" });
    }
});
// PATCH /api/trades/:id - update trade except symbol & companyName
app.patch("/api/trades/:id", authenticate, async (req, res) => {
    try {
        const tradeId = req.params.id;
        const userId = req.user.id;
        const updates = { ...req.body };
        console.log(
            `PATCH /api/trades/${tradeId} called by user ${userId} with data:`,
            updates
        );
        // Prevent updating symbol and companyName
        if ("symbol" in updates) delete updates.symbol;
        if ("companyName" in updates) delete updates.companyName;

        updates.updatedAt = new Date();

        // Find trade owned by user and update
        const filter =
            req.user.role === "admin"
                ? { _id: tradeId }
                : { _id: tradeId, userId };

        const updatedTrade = await Trade.findOneAndUpdate(
            filter,
            { $set: updates },
            { new: true }
        );

        if (!updatedTrade) {
            return res
                .status(404)
                .json({ error: "Trade not found or unauthorized" });
        }

        res.json(updatedTrade);
    } catch (err) {
        console.error("Error updating trade:", err);
        res.status(500).json({ error: "Failed to update trade" });
    }
});

// DELETE /api/trades/:id - delete a trade owned by user
app.delete("/api/trades/:id", authenticate, async (req, res) => {
    try {
        const tradeId = req.params.id;
        const userId = req.user.id;

        const filter =
            req.user.role === "admin"
                ? { _id: tradeId }
                : { _id: tradeId, userId };

        const deletedTrade = await Trade.findOneAndDelete(filter);

        if (!deletedTrade) {
            return res
                .status(404)
                .json({ error: "Trade not found or unauthorized" });
        }

        res.json({ message: "Trade deleted successfully" });
    } catch (err) {
        console.error("Error deleting trade:", err);
        res.status(500).json({ error: "Failed to delete trade" });
    }
});

// --- PAGE ROUTES ---
// Serve journal entry page with dynamic param
app.get("/journal/:id", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "journal-entry.html"));
});

// Explicit route to serve journal-entry.html when accessed directly (with query params)
app.get("/journal-entry.html", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "journal-entry.html"));
});

// --- EXTERNAL API ROUTES ---
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
        res.json(response.data?.[0] || { message: "No recommendation data" });
    } catch (error) {
        console.error("Error fetching recommendations:", error.message);
        res.status(500).json({ error: "Failed to fetch recommendations" });
    }
});

app.get("/api/insider-sentiment", async (req, res) => {
    const { symbol, from, to } = req.query;

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
        res.json(
            response.data?.data?.length ? response.data : { message: "No data" }
        );
    } catch (error) {
        console.error("Error fetching insider sentiment:", error.message);
        res.status(500).json({ error: "Failed to fetch insider sentiment" });
    }
});

app.get("/api/ipo-calendar", async (req, res) => {
    const { from, to } = req.query;

    if (!from || !to) {
        return res
            .status(400)
            .json({ error: "'from' and 'to' query parameters are required" });
    }

    try {
        const url = `https://finnhub.io/api/v1/calendar/ipo?from=${from}&to=${to}&token=${process.env.FINNHUB_API_KEY}`;
        const response = await axios.get(url);
        res.json(
            response.data.ipoCalendar
                ? response.data
                : { message: "No IPO data" }
        );
    } catch (error) {
        console.error("Error fetching IPO calendar:", error.message);
        res.status(500).json({ error: "Failed to fetch IPO calendar" });
    }
});

app.get("/api/news", async (req, res) => {
    const symbol = req.query.symbol;
    if (!symbol) {
        return res
            .status(400)
            .json({ error: "Symbol query parameter is required" });
    }

    try {
        const company = await Trade.findOne({ symbol }).sort({ updatedAt: -1 });
        const companyName = company?.companyName || "";

        const query = `${symbol} OR "${companyName}"`;

        const response = await axios.get("https://newsapi.org/v2/everything", {
            params: {
                q: query,
                sortBy: "publishedAt",
                language: "en",
                apiKey: process.env.NEWS_API_KEY,
                pageSize: 5,
                sources:
                    "bloomberg,cnbc,business-insider,financial-post,the-wall-street-journal,reuters",
            },
        });

        res.json(response.data);
    } catch (err) {
        console.error("Error fetching news:", err.message);
        res.status(500).json({ error: "Failed to fetch news articles" });
    }
});

app.get("/api/trending", async (req, res) => {
    try {
        const options = {
            method: "GET",
            url: "https://apidojo-yahoo-finance-v1.p.rapidapi.com/market/get-trending-tickers",
            params: { region: "US" },
            headers: {
                "x-rapidapi-key": process.env.RAPIDAPI_KEY,
                "x-rapidapi-host": "apidojo-yahoo-finance-v1.p.rapidapi.com",
            },
        };

        const response = await axios.request(options);

        const tickers =
            response.data?.finance?.result?.[0]?.quotes
                ?.slice(0, 5)
                .map((ticker) => ({
                    symbol: ticker.symbol,
                    price: ticker.regularMarketPrice,
                    changePercent:
                        ticker.regularMarketChangePercent?.toFixed(2),
                })) || [];

        res.json(tickers);
    } catch (err) {
        console.error("Error fetching trending tickers:", err.message);
        res.status(500).json({ error: "Failed to fetch trending tickers" });
    }
});

// --- DEFAULT ROUTE ---
// Adjusted to exclude /journal-entry.html and /journal/:id so they don't get overridden
app.get(/^\/(?!journal-entry\.html$|journal\/).*/, (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
