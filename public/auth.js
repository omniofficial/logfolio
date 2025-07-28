document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
    const loginToggle = document.getElementById("loginToggle");
    const registerToggle = document.getElementById("registerToggle");

    const loginSection = document.getElementById("loginSection");
    const registerSection = document.getElementById("registerSection");

    const loginBtn = document.getElementById("loginBtn");
    const registerBtn = document.getElementById("registerBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const adminLink = document.getElementById("adminLink"); // Add this for admin nav link

    // Add click handlers to navigate to auth page
    loginBtn?.addEventListener("click", () => {
        window.location.href = "/auth.html";
    });

    registerBtn?.addEventListener("click", () => {
        window.location.href = "/auth.html";
    });

    // Toggle between login and register sections
    loginToggle?.addEventListener("click", () => {
        loginSection.style.display = "block";
        registerSection.style.display = "none";
    });

    registerToggle?.addEventListener("click", () => {
        loginSection.style.display = "none";
        registerSection.style.display = "block";
    });

    // Login handler
    loginForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = loginForm.email.value;
        const password = loginForm.password.value;

        try {
            const res = await fetch("/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Login failed");

            localStorage.setItem("token", data.token);
            redirectBasedOnRole(data.token);
        } catch (err) {
            alert(err.message);
        }
    });

    // Register handler
    registerForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = registerForm.name.value;
        const email = registerForm.email.value;
        const password = registerForm.password.value;
        const role = registerForm.role.value;

        try {
            const res = await fetch("/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password, role }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Registration failed");

            localStorage.setItem("token", data.token);
            redirectBasedOnRole(data.token);
        } catch (err) {
            alert(err.message);
        }
    });

    // Logout handler
    logoutBtn?.addEventListener("click", async () => {
        const token = localStorage.getItem("token");
        console.log("Logout clicked. Token:", token);

        if (!token) {
            console.log("No token found during logout");
            window.location.href = "/auth.html";
            return;
        }

        try {
            const res = await fetch("/logout", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
            });

            if (res.ok) {
                console.log("Logout successful");
                alert("You have been logged out.");
            } else {
                console.warn("Logout failed with status:", res.status);
                alert("Logout may have failed.");
            }
        } catch (err) {
            console.error("Logout request failed:", err);
        } finally {
            localStorage.removeItem("token");
            window.location.href = "/auth.html";
        }
    });

    // Redirect based on user role
    function redirectBasedOnRole(token) {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const role = payload.role;

        if (role === "admin") {
            window.location.href = "/manager.html";
        } else {
            window.location.href = "/index.html";
        }
    }

    // Show/hide nav buttons
    const token = localStorage.getItem("token");
    if (token) {
        loginBtn?.classList.add("hidden");
        registerBtn?.classList.add("hidden");
        logoutBtn?.classList.remove("hidden");
    } else {
        loginBtn?.classList.remove("hidden");
        registerBtn?.classList.remove("hidden");
        logoutBtn?.classList.add("hidden");
    }

    // Show/hide ADMIN link based on role
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split(".")[1]));
            const role = payload.role;

            if (role === "admin") {
                if (adminLink) adminLink.style.display = "inline-block";
            } else {
                if (adminLink) adminLink.style.display = "none";
            }
        } catch (err) {
            console.error("Failed to decode token:", err);
            if (adminLink) adminLink.style.display = "none";
        }
    } else {
        if (adminLink) adminLink.style.display = "none";
    }
});
