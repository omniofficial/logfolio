document.addEventListener("DOMContentLoaded", loadJournal);

async function loadJournal() {
    const container = document.getElementById("journalEntries");

    try {
        const res = await fetch("/api/trades");
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
                        profitClass = "negative"; // <-- add this line
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
        container.innerHTML = "<p>Error loading trade journal.</p>";
    }
}

// Helpers
function groupTradesByDate(trades) {
    const grouped = {};
    trades.forEach((trade) => {
        const date = new Date(trade.createdAt).toISOString().split("T")[0];
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
