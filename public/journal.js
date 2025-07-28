document.addEventListener("DOMContentLoaded", loadJournal);

async function loadJournal() {
    const container = document.getElementById("journalEntries");

    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    try {
        const res = await fetch("/api/trades", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        if (res.status === 401 || res.status === 403) {
            // Token is invalid or expired
            localStorage.removeItem("token");
            window.location.href = "/login.html";
            return;
        }

        const trades = await res.json();

        if (!Array.isArray(trades) || trades.length === 0) {
            container.innerHTML = "<p>No trades logged yet.</p>";
            return;
        }

        // Group trades by date
        const grouped = groupTradesByDate(trades);

        container.innerHTML = "";

        for (const date in grouped) {
            const section = document.createElement("section");
            section.classList.add("journal-day");

            const heading = document.createElement("h2");
            heading.textContent = formatDateHeader(date);
            section.appendChild(heading);

            grouped[date].forEach((trade) => {
                const entry = document.createElement("div");
                entry.classList.add("journal-entry");

                // Calculate profit if possible
                let profit = "N/A";
                let profitClass = "";
                if (trade.entryPrice && trade.exitPrice && trade.quantity) {
                    const entryTotal = trade.entryPrice * trade.quantity;
                    const exitTotal = trade.exitPrice * trade.quantity;
                    let rawProfit = exitTotal - entryTotal;

                    let sign = "";
                    if (rawProfit > 0) {
                        sign = "+";
                    } else if (rawProfit < 0) {
                        sign = "-";
                        profitClass = "negative";
                    }
                    profit = `${sign}$${Math.abs(rawProfit).toFixed(2)}`;
                }

                // Summary View as clickable link
                const summary = document.createElement("a");
                summary.classList.add("entry-summary");
                summary.href = `/journal/${trade._id}`;
                summary.innerHTML = `
  <strong>${trade.symbol}</strong>
  <span class="trade-type">${
      trade.tradeType === "Long"
          ? "Buy"
          : trade.tradeType === "Short"
          ? "Sell"
          : trade.tradeType
  }</span>
  <span class="profit ${profitClass}">${profit}</span>
`;

                entry.appendChild(summary);
                section.appendChild(entry);
            });

            container.appendChild(section);
        }
    } catch (err) {
        console.error("Failed to load trades", err);
        container.innerHTML =
            "<p>Error loading trade journal. Please try again later.</p>";
    }
}

// Helpers
function groupTradesByDate(trades) {
    const grouped = {};

    // Sort trades by effective date first
    trades.sort((a, b) => {
        const aDate = new Date(a.exitDate || a.entryDate || a.createdAt);
        const bDate = new Date(b.exitDate || b.entryDate || b.createdAt);
        return bDate - aDate; // descending
    });

    trades.forEach((trade) => {
        const rawDate = trade.exitDate || trade.entryDate || trade.createdAt;
        const date = new Date(rawDate).toISOString().split("T")[0];

        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(trade);
    });

    return grouped;
}

function formatDateHeader(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString();
}
