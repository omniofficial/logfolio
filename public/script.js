document.addEventListener("DOMContentLoaded", () => {
    // ===== TRADE FORM LOGIC (only if form exists) =====
    const symbolInput = document.getElementById("symbol");
    const symbolList = document.getElementById("symbolList");
    const companyNameInput = document.getElementById("companyName");
    const tradeForm = document.getElementById("tradeForm");
    const statusMsg = document.getElementById("statusMsg");

    if (tradeForm) {
        let debounceTimeout;

        function debounce(func, delay) {
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(func, delay);
        }

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

                div.addEventListener("click", (e) => {
                    e.stopPropagation(); // prevent document click from hiding immediately
                    symbolInput.value = item.displaySymbol;
                    companyNameInput.value = item.description;
                    // Hide dropdown with slight delay to ensure click finishes
                    setTimeout(() => {
                        symbolList.classList.add("hidden");
                    }, 100);
                    symbolInput.focus(); // Refocus input after selecting
                });

                symbolList.appendChild(div);
            });
            symbolList.classList.remove("hidden");
        }

        symbolInput.addEventListener("input", () => {
            companyNameInput.value = "";
            debounce(() => fetchSymbols(symbolInput.value.trim()), 300);
        });

        document.addEventListener("click", (e) => {
            if (!symbolList.contains(e.target) && e.target !== symbolInput) {
                symbolList.classList.add("hidden");
            }
        });

        symbolInput.addEventListener("blur", () => {
            // Hide autocomplete list shortly after blur to allow click event on list items
            setTimeout(() => {
                symbolList.classList.add("hidden");
            }, 150);
        });

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

        tradeForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const formData = new FormData(tradeForm);
            const tradeData = {};
            formData.forEach((value, key) => {
                tradeData[key] = value;
            });

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

            ["entryDate", "exitDate"].forEach((field) => {
                if (tradeData[field]) {
                    tradeData[field] = new Date(tradeData[field]);
                }
            });

            if (
                !tradeData.symbol ||
                !tradeData.entryPrice ||
                !tradeData.quantity ||
                !tradeData.entryDate
            ) {
                statusMsg.textContent = "Please fill in all required fields.";
                statusMsg.style.color = "#f94144";
                return;
            }

            const token = localStorage.getItem("token");
            if (!token) {
                statusMsg.textContent = "Please log in before logging trades.";
                statusMsg.style.color = "#f94144";
                return;
            }

            try {
                statusMsg.textContent = "Logging trade...";
                statusMsg.style.color = "#e63946";

                const response = await fetch("/api/trades", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(tradeData),
                });

                if (response.status === 401 || response.status === 403) {
                    statusMsg.textContent =
                        "Session expired or unauthorized. Please log in again.";
                    statusMsg.style.color = "#f94144";
                    localStorage.removeItem("token");
                    setTimeout(
                        () => (window.location.href = "/login.html"),
                        1500
                    );
                    return;
                }

                if (response.ok) {
                    statusMsg.textContent = "Trade logged successfully!";
                    statusMsg.style.color = "#43aa8b";
                    tradeForm.reset();
                    companyNameInput.value = "";
                } else {
                    const errData = await response.json();
                    statusMsg.textContent =
                        "Failed to log trade: " +
                        (errData.error || "Unknown error");
                    statusMsg.style.color = "#f94144";
                }
            } catch (error) {
                console.error("Error submitting trade:", error);
                statusMsg.textContent = "Error submitting trade. See console.";
                statusMsg.style.color = "#f94144";
            }
        });
    }

    // ===== TESTIMONIAL LOGIC =====
    const testimonials = document.querySelectorAll(".testimonial");
    const prevBtn = document.querySelector(".testimonial-arrow.left");
    const nextBtn = document.querySelector(".testimonial-arrow.right");

    if (testimonials.length && prevBtn && nextBtn) {
        let currentTestimonial = 0;
        let autoCycleInterval;

        function showTestimonial(index) {
            testimonials.forEach((t, i) => {
                t.classList.toggle("active", i === index);
            });
        }

        function nextTestimonial() {
            currentTestimonial = (currentTestimonial + 1) % testimonials.length;
            showTestimonial(currentTestimonial);
        }

        function prevTestimonial() {
            currentTestimonial =
                (currentTestimonial - 1 + testimonials.length) %
                testimonials.length;
            showTestimonial(currentTestimonial);
        }

        function resetAutoCycle() {
            clearInterval(autoCycleInterval);
            autoCycleInterval = setInterval(nextTestimonial, 5000);
        }

        showTestimonial(currentTestimonial);
        autoCycleInterval = setInterval(nextTestimonial, 5000);

        nextBtn.addEventListener("click", () => {
            nextTestimonial();
            resetAutoCycle();
        });

        prevBtn.addEventListener("click", () => {
            prevTestimonial();
            resetAutoCycle();
        });
    }

    async function fetchTrendingTickers() {
        const container = document.getElementById("trendingTickers");
        if (!container) return;

        try {
            const response = await fetch("/api/trending");
            const tickers = await response.json();

            if (!Array.isArray(tickers) || tickers.length === 0) {
                container.innerHTML = "No trending stocks found.";
                return;
            }

            const html = tickers
                .map(({ symbol, changePercent }) => {
                    const positive = !changePercent.startsWith("-");
                    const color = positive ? "#43aa8b" : "#f94144";
                    return `<span style="margin-right: 10px; color: ${color}; font-weight: bold;">
                    ${symbol} ${changePercent}%
                </span>`;
                })
                .join("");

            container.innerHTML = html;
        } catch (error) {
            console.error("Failed to load trending tickers:", error);
            container.innerHTML = "Failed to load trending stocks.";
        }
    }

    fetchTrendingTickers();
});
