document.addEventListener("DOMContentLoaded", () => {
    const symbolInput = document.getElementById("symbol");
    const symbolList = document.getElementById("symbolList");
    const companyNameInput = document.getElementById("companyName");
    const tradeForm = document.getElementById("tradeForm");
    const statusMsg = document.getElementById("statusMsg");

    let debounceTimeout;

    // Helper: debounce to limit API calls when typing
    function debounce(func, delay) {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(func, delay);
    }

    // Fetch symbol suggestions from backend API
    async function fetchSymbols(query) {
        if (!query) {
            symbolList.classList.add("hidden");
            return;
        }
        try {
            const response = await fetch(
                `/api/search-symbols?q=${encodeURIComponent(query)}`
            );
            const data = await response.json();
            showSymbolList(data.result || []);
        } catch (error) {
            console.error("Error fetching symbols:", error);
        }
    }

    // Show autocomplete dropdown
    function showSymbolList(results) {
        if (results.length === 0) {
            symbolList.classList.add("hidden");
            return;
        }
        symbolList.innerHTML = "";
        results.forEach((item) => {
            const div = document.createElement("div");
            div.textContent = `${item.displaySymbol} — ${item.description}`;
            div.classList.add("autocomplete-item");
            div.addEventListener("click", () => {
                symbolInput.value = item.displaySymbol;
                companyNameInput.value = item.description;
                symbolList.classList.add("hidden");
            });
            symbolList.appendChild(div);
        });
        symbolList.classList.remove("hidden");
    }

    symbolInput.addEventListener("input", () => {
        companyNameInput.value = "";
        debounce(() => fetchSymbols(symbolInput.value.trim()), 300);
    });

    // Hide autocomplete if clicked outside
    document.addEventListener("click", (e) => {
        if (!symbolList.contains(e.target) && e.target !== symbolInput) {
            symbolList.classList.add("hidden");
        }
    });

    // Fetch company profile on symbol blur if company name empty
    symbolInput.addEventListener("blur", async () => {
        const symbol = symbolInput.value.trim();
        if (!symbol || companyNameInput.value) return;

        try {
            const res = await fetch(
                `/api/company-profile?symbol=${encodeURIComponent(symbol)}`
            );
            const data = await res.json();
            if (data.name) {
                companyNameInput.value = data.name;
            }
        } catch (err) {
            console.error("Failed to fetch company profile", err);
        }
    });

    // Handle form submit
    tradeForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = new FormData(tradeForm);
        const tradeData = {};
        formData.forEach((value, key) => {
            tradeData[key] = value;
        });

        // Convert numeric fields to numbers
        [
            "entryPrice",
            "exitPrice",
            "quantity",
            "positionSize",
            "stopLoss",
            "takeProfit",
        ].forEach((field) => {
            if (tradeData[field]) {
                tradeData[field] = parseFloat(tradeData[field]);
            }
        });

        // Convert dates to Date objects
        ["entryDate", "exitDate"].forEach((field) => {
            if (tradeData[field]) {
                tradeData[field] = new Date(tradeData[field]);
            }
        });

        // Basic validation
        if (
            !tradeData.symbol ||
            !tradeData.entryPrice ||
            !tradeData.quantity ||
            !tradeData.entryDate
        ) {
            statusMsg.textContent = "Please fill in all required fields.";
            statusMsg.style.color = "#f94144"; // Red for error
            return;
        }

        try {
            statusMsg.textContent = "Logging trade...";
            statusMsg.style.color = "#e63946"; // Accent color

            const response = await fetch("/api/trades", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(tradeData),
            });

            if (response.ok) {
                statusMsg.textContent = "Trade logged successfully!";
                statusMsg.style.color = "#43aa8b"; // Green success color
                tradeForm.reset();
                companyNameInput.value = "";
            } else {
                const errData = await response.json();
                statusMsg.textContent =
                    "Failed to log trade: " +
                    (errData.error || "Unknown error");
                statusMsg.style.color = "#f94144"; // Red for error
            }
        } catch (error) {
            console.error("Error submitting trade:", error);
            statusMsg.textContent = "Error submitting trade. See console.";
            statusMsg.style.color = "#f94144"; // Red for error
        }
    });
});
