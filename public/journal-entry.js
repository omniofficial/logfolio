document.addEventListener("DOMContentLoaded", async () => {
    const path = window.location.pathname;

    if (path.includes("edit-entry.html")) {
        await handleEditEntryPage();
    } else if (
        path.includes("journal-entry.html") ||
        path.startsWith("/journal/")
    ) {
        await handleViewEntryPage();
    }
});

function capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// === VIEW ENTRY PAGE LOGIC ===
async function handleViewEntryPage() {
    console.log("handleViewEntryPage started");

    let id;
    const path = window.location.pathname;
    if (path.includes("/journal/")) {
        id = path.split("/").pop();
    } else {
        id = new URLSearchParams(window.location.search).get("id");
    }

    console.log("Journal entry ID:", id);

    const container = document.getElementById("entryDetails");
    const newsContainer = document.querySelector("#relatedNews .news-articles");
    const recContainer = document.getElementById("recommendationDetails");

    if (!id) {
        container.innerHTML = "<p>No entry ID provided.</p>";
        return;
    }

    try {
        const token = localStorage.getItem("token");

        if (!token) {
            window.location.href = "/login.html";
            return;
        }

        const res = await fetch(`/api/trades/${id}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        console.log("Fetch /api/trades response status:", res.status);

        if (!res.ok) {
            const errorText = await res.text();
            console.error("Trade fetch failed:", errorText);
            throw new Error("Failed to fetch trade");
        }

        const trade = await res.json();
        console.log("Trade data:", trade);

        const profit =
            trade.exitPrice && trade.entryPrice && trade.quantity
                ? (
                      (trade.exitPrice - trade.entryPrice) *
                      trade.quantity
                  ).toFixed(2)
                : "N/A";

        container.innerHTML = `
      <h1>${trade.symbol} (${trade.companyName || ""})</h1>
      <p><strong>Trade Type:</strong> ${capitalize(trade.tradeType)}</p>
      <p><strong>Entry Price:</strong> $${trade.entryPrice}</p>
      <p><strong>Exit Price:</strong> $${trade.exitPrice}</p>
      <p><strong>Quantity:</strong> ${trade.quantity}</p>
      <p><strong>Profit:</strong> $${profit}</p>
      <p><strong>Entry Date:</strong> ${new Date(
          trade.entryDate
      ).toLocaleDateString()}</p>
      <p><strong>Exit Date:</strong> ${
          trade.exitDate ? new Date(trade.exitDate).toLocaleDateString() : "—"
      }</p>
      <p><strong>Stop Loss:</strong> ${trade.stopLoss ?? "—"}</p>
      <p><strong>Take Profit:</strong> ${trade.takeProfit ?? "—"}</p>
      <p><strong>Notes:</strong><br/>${trade.notes || "None"}</p>

      <button id="editEntryBtn" class="btn">Edit</button>
      <button id="deleteEntryBtn" class="btn btn-danger">Delete</button>
    `;

        document
            .getElementById("deleteEntryBtn")
            .addEventListener("click", async () => {
                if (!confirm("Are you sure you want to delete this entry?"))
                    return;

                try {
                    const delRes = await fetch(`/api/trades/${id}`, {
                        method: "DELETE",
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    });
                    if (!delRes.ok) throw new Error("Failed to delete trade");

                    alert("Trade deleted successfully.");
                    window.location.href = "/journal.html"; // Redirect after deletion
                } catch (err) {
                    alert("Error deleting trade.");
                    console.error(err);
                }
            });

        document
            .getElementById("editEntryBtn")
            .addEventListener("click", () => {
                window.location.href = `/edit-entry.html?id=${id}`;
            });

        if (trade.symbol) {
            const newsRes = await fetch(
                `/api/news?symbol=${encodeURIComponent(trade.symbol)}`
            );
            const newsData = await newsRes.json();

            if (!newsData.articles || newsData.articles.length === 0) {
                newsContainer.innerHTML =
                    "<p>No recent news articles found.</p>";
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

            loadRecommendations(trade.symbol);
            loadInsiderSentiment(trade.symbol);
        } else {
            newsContainer.innerHTML = "<p>No symbol available for news.</p>";
            if (recContainer)
                recContainer.innerHTML =
                    "<p>No symbol available for recommendations.</p>";
            const insiderContainer = document.getElementById(
                "insiderSentimentDetails"
            );
            if (insiderContainer)
                insiderContainer.innerHTML =
                    "<p>No symbol available for insider sentiment data.</p>";
        }

        loadIPOcalendar();
    } catch (err) {
        console.error("Error loading trade or news:", err);
        container.innerHTML = "<p>Failed to load journal entry.</p>";
        newsContainer.innerHTML = "<p>Failed to load news articles.</p>";
        if (recContainer)
            recContainer.innerHTML =
                "<p>Failed to load analyst recommendations.</p>";
        const insiderContainer = document.getElementById(
            "insiderSentimentDetails"
        );
        if (insiderContainer)
            insiderContainer.innerHTML =
                "<p>Failed to load insider sentiment data.</p>";
        const ipoContainer = document.getElementById("ipoCalendarDetails");
        if (ipoContainer)
            ipoContainer.innerHTML = "<p>Failed to load IPO calendar data.</p>";
    }
}

// === EDIT ENTRY PAGE LOGIC ===
async function handleEditEntryPage() {
    const form = document.getElementById("editEntryForm");
    const message = document.getElementById("message");
    const cancelBtn = document.getElementById("cancelBtn");
    const id = new URLSearchParams(window.location.search).get("id");

    if (!id) {
        if (message) message.textContent = "No entry ID provided.";
        if (form) form.style.display = "none";
        return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    try {
        const res = await fetch(`/api/trades/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to load trade data");
        const trade = await res.json();

        // Prefill form fields if present
        if (!form) return;
        form.symbol.value = trade.symbol || "";
        form.companyName.value = trade.companyName || "";
        form.tradeType.value = trade.tradeType || "buy";
        // Capitalize the selected option's visible text to fix display issue
        const tradeTypeSelect = form.tradeType;
        if (tradeTypeSelect) {
            const selectedOption =
                tradeTypeSelect.options[tradeTypeSelect.selectedIndex];
            if (selectedOption) {
                selectedOption.text =
                    selectedOption.text.charAt(0).toUpperCase() +
                    selectedOption.text.slice(1).toLowerCase();
            }
        }

        form.entryPrice.value = trade.entryPrice ?? "";
        form.exitPrice.value = trade.exitPrice ?? "";
        form.quantity.value = trade.quantity ?? "";
        form.entryDate.value = trade.entryDate
            ? new Date(trade.entryDate).toISOString().slice(0, 10)
            : "";
        form.exitDate.value = trade.exitDate
            ? new Date(trade.exitDate).toISOString().slice(0, 10)
            : "";
        form.stopLoss.value = trade.stopLoss ?? "";
        form.takeProfit.value = trade.takeProfit ?? "";
        form.notes.value = trade.notes || "";
    } catch (error) {
        if (message)
            message.textContent = "Error loading entry: " + error.message;
        if (form) form.style.display = "none";
        return;
    }

    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (message) message.textContent = "";

        const updatedTrade = {
            symbol: form.symbol.value.trim(),
            companyName: form.companyName.value.trim(),
            tradeType: form.tradeType.value,
            entryPrice: parseFloat(form.entryPrice.value),
            exitPrice: form.exitPrice.value
                ? parseFloat(form.exitPrice.value)
                : null,
            quantity: parseInt(form.quantity.value, 10),
            entryDate: form.entryDate.value,
            exitDate: form.exitDate.value || null,
            stopLoss: form.stopLoss.value
                ? parseFloat(form.stopLoss.value)
                : null,
            takeProfit: form.takeProfit.value
                ? parseFloat(form.takeProfit.value)
                : null,
            notes: form.notes.value.trim(),
        };

        if (
            !updatedTrade.symbol ||
            isNaN(updatedTrade.entryPrice) ||
            isNaN(updatedTrade.quantity) ||
            !updatedTrade.entryDate
        ) {
            if (message)
                message.textContent =
                    "Please fill in all required fields correctly.";
            return;
        }

        try {
            const res = await fetch(`/api/trades/${id}`, {
                method: "PATCH", // Changed from PUT to PATCH here
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(updatedTrade),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || "Failed to update entry");
            }

            alert("Entry updated successfully!");
            window.location.href = `/journal-entry.html?id=${id}`;
        } catch (error) {
            if (message)
                message.textContent = "Error updating entry: " + error.message;
        }
    });

    if (cancelBtn) {
        cancelBtn.addEventListener("click", () => {
            window.location.href = `/journal-entry.html?id=${id}`;
        });
    }
}

// === Existing helper functions ===

async function loadRecommendations(symbol) {
    const recContainer = document.getElementById("recommendationDetails");
    if (!recContainer) return;

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

async function loadIPOcalendar() {
    const container = document.getElementById("ipoCalendarDetails");
    if (!container) return;

    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setMonth(toDate.getMonth() - 3);

    const from = fromDate.toISOString().split("T")[0];
    const to = toDate.toISOString().split("T")[0];

    try {
        const res = await fetch(`/api/ipo-calendar?from=${from}&to=${to}`);
        if (!res.ok) throw new Error("Failed to fetch IPO calendar");
        const data = await res.json();

        if (!data.ipoCalendar || data.ipoCalendar.length === 0) {
            container.innerHTML = "<p>No IPO events found for this period.</p>";
            return;
        }

        const rows = data.ipoCalendar
            .map(
                (ipo) => `
      <tr>
        <td>${ipo.date}</td>
        <td>${ipo.exchange}</td>
        <td>${ipo.name}</td>
        <td>${ipo.symbol}</td>
        <td>${ipo.numberOfShares ?? "N/A"}</td>
        <td>${ipo.price ?? "N/A"}</td>
        <td>${ipo.status}</td>
        <td>${ipo.totalSharesValue ?? "N/A"}</td>
      </tr>
    `
            )
            .join("");

        container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Exchange</th>
            <th>Company Name</th>
            <th>Symbol</th>
            <th>Shares Offered</th>
            <th>Price</th>
            <th>Status</th>
            <th>Total Shares Value</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
    } catch (error) {
        container.innerHTML = "<p>Failed to load IPO calendar data.</p>";
        console.error("Error loading IPO calendar:", error);
    }
}
