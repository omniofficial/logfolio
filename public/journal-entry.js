// public/journal-entry.js

document.addEventListener("DOMContentLoaded", async () => {
    const id = window.location.pathname.split("/").pop();
    const container = document.getElementById("entryDetails");
    const newsContainer = document.querySelector("#relatedNews .news-articles");
    const recContainer = document.getElementById("recommendationDetails");

    if (!id) {
        container.innerHTML = "<p>No entry ID provided.</p>";
        return;
    }

    try {
        const res = await fetch(`/api/trades/${id}`);
        const trade = await res.json();

        const profit =
            trade.exitPrice && trade.entryPrice && trade.quantity
                ? (
                      (trade.exitPrice - trade.entryPrice) *
                      trade.quantity
                  ).toFixed(2)
                : "N/A";

        container.innerHTML = `
            <h1>${trade.symbol} (${trade.companyName || ""})</h1>
            <p><strong>Trade Type:</strong> ${trade.tradeType}</p>
            <p><strong>Entry Price:</strong> $${trade.entryPrice}</p>
            <p><strong>Exit Price:</strong> $${trade.exitPrice}</p>
            <p><strong>Quantity:</strong> ${trade.quantity}</p>
            <p><strong>Profit:</strong> $${profit}</p>
            <p><strong>Entry Date:</strong> ${new Date(
                trade.entryDate
            ).toLocaleDateString()}</p>
            <p><strong>Exit Date:</strong> ${
                trade.exitDate
                    ? new Date(trade.exitDate).toLocaleDateString()
                    : "—"
            }</p>
            <p><strong>Stop Loss:</strong> ${trade.stopLoss ?? "—"}</p>
            <p><strong>Take Profit:</strong> ${trade.takeProfit ?? "—"}</p>
            <p><strong>Notes:</strong><br/>${trade.notes || "None"}</p>
        `;

        // Fetch news based on symbol
        const newsRes = await fetch(
            `/api/news?symbol=${encodeURIComponent(trade.symbol)}`
        );
        const newsData = await newsRes.json();

        if (!newsData.articles || newsData.articles.length === 0) {
            newsContainer.innerHTML = "<p>No recent news articles found.</p>";
        } else {
            newsContainer.innerHTML = newsData.articles
                .map(
                    (article) => `
                        <article class="news-article">
                            <a href="${article.url}" target="_blank"><strong>${
                        article.title
                    }</strong></a>
                            <p>${article.description || ""}</p>
                            <small>${new Date(
                                article.publishedAt
                            ).toLocaleDateString()}</small>
                        </article>
                    `
                )
                .join("");
        }

        // Load analyst recommendations
        loadRecommendations(trade.symbol);

        // Load insider sentiment data
        loadInsiderSentiment(trade.symbol);
    } catch (err) {
        console.error("Error loading trade or news:", err);
        container.innerHTML = "<p>Failed to load journal entry.</p>";
        newsContainer.innerHTML = "<p>Failed to load news articles.</p>";
        if (recContainer)
            recContainer.innerHTML =
                "<p>Failed to load analyst recommendations.</p>";
    }
});

async function loadRecommendations(symbol) {
    const recContainer = document.getElementById("recommendationDetails");
    if (!recContainer) return; // If container doesn't exist, skip

    try {
        const res = await fetch(
            `/api/recommendations?symbol=${encodeURIComponent(symbol)}`
        );
        if (!res.ok) throw new Error("No recommendation data");
        const data = await res.json();

        recContainer.innerHTML = `
            <ul>
                <li><strong>Strong Buy:</strong> ${data.strongBuy ?? 0}</li>
                <li><strong>Buy:</strong> ${data.buy ?? 0}</li>
                <li><strong>Hold:</strong> ${data.hold ?? 0}</li>
                <li><strong>Sell:</strong> ${data.sell ?? 0}</li>
                <li><strong>Strong Sell:</strong> ${data.strongSell ?? 0}</li>
            </ul>
            <p><em>Period: ${data.period ?? "N/A"}</em></p>
        `;
    } catch (err) {
        recContainer.innerHTML =
            "<p>Failed to load analyst recommendations.</p>";
        console.error("Error loading recommendations:", err);
    }
}

async function loadInsiderSentiment(symbol) {
    const container = document.getElementById("insiderSentimentDetails");
    if (!container) return;

    // Calculate date range: last 6 months
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setMonth(toDate.getMonth() - 6);

    const from = fromDate.toISOString().split("T")[0];
    const to = toDate.toISOString().split("T")[0];

    try {
        const res = await fetch(
            `/api/insider-sentiment?symbol=${encodeURIComponent(
                symbol
            )}&from=${from}&to=${to}`
        );
        if (!res.ok) throw new Error("No insider sentiment data");
        const data = await res.json();

        if (!data.data || data.data.length === 0) {
            container.innerHTML = "<p>No insider sentiment data available.</p>";
            return;
        }

        const rows = data.data
            .map(
                (item) => `
            <tr>
                <td>${item.year}-${String(item.month).padStart(2, "0")}</td>
                <td>${item.change}</td>
                <td>${item.mspr.toFixed(2)}</td>
            </tr>`
            )
            .join("");

        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Month</th>
                        <th>Change (Net insider transactions)</th>
                        <th>MSPR (Monthly Share Purchase Ratio)</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;
    } catch (error) {
        container.innerHTML = "<p>Failed to load insider sentiment data.</p>";
        console.error("Error loading insider sentiment:", error);
    }
}
