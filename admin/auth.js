class Auth {
  constructor() {
    this.token = localStorage.getItem("adminToken");
    this.setupEventListeners();
    this.checkAuth();
  }

  async checkAuth() {
    console.log("Checking auth status...");

    // Toggle UI based on current page
    if (
      window.location.pathname.endsWith("login.html") ||
      window.location.pathname.endsWith("signup.html")
    ) {
      return;
    }

    // If no token, redirect to login
    if (!this.token) {
      window.location.replace("login.html");
      return;
    }

    // Verify token
    try {
      const response = await fetch(`${CONFIG.API_URL}/admin/dashboard-stats`, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error("Invalid token");
      }

      // If token is valid and we're on index.html, show dashboard
      if (window.location.pathname.endsWith("index.html")) {
        this.showDashboard();
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      localStorage.clear();
      window.location.replace("login.html");
    }
  }

  // Add method to toggle UI
  showDashboard() {
    const loginContainer = document.getElementById("loginContainer");
    const dashboardContainer = document.getElementById("dashboardContainer");

    if (loginContainer) loginContainer.classList.add("hidden");
    if (dashboardContainer) dashboardContainer.classList.remove("hidden");
  }

  showLogin() {
    const loginContainer = document.getElementById("loginContainer");
    const dashboardContainer = document.getElementById("dashboardContainer");

    if (loginContainer) loginContainer.classList.remove("hidden");
    if (dashboardContainer) dashboardContainer.classList.add("hidden");
  }

  setupEventListeners() {
    const loginForm = document.getElementById("loginForm");
    const logoutBtn = document.getElementById("logoutBtn");

    if (loginForm) {
      loginForm.addEventListener("submit", (e) => this.handleLogin(e));
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => this.handleLogout());
    }
  }

  async handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const submitButton = e.target.querySelector('button[type="submit"]');
    const errorMessage = document.getElementById("errorMessage");

    try {
      submitButton.disabled = true;
      submitButton.innerHTML =
        '<i class="fas fa-spinner loading"></i> Logging in...';

      const response = await fetch(`${CONFIG.API_URL}/admin/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      localStorage.setItem("adminToken", data.token);
      window.location.href = "index.html";
    } catch (error) {
      if (errorMessage) {
        errorMessage.style.display = "block";
        errorMessage.textContent = error.message;
      }
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
    }
  }

  handleLogout() {
    localStorage.removeItem("adminToken");
    window.location.href = "login.html";
  }

  getAuthHeaders() {
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
    };
  }
}

// Initialize Auth
window.auth = new Auth();
