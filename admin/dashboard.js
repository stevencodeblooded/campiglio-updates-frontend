// Utility function for debouncing
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

class Dashboard {
  constructor() {
    this.currentView = "overview";
    this.venues = [];
    this.initialized = false;
    this.categorySelect = null;
    this.savedOpeningHours = null;
    this.banners = [];
  }

  setUsername() {
    const username = localStorage.getItem("adminUsername");
    if (username) {
      document.getElementById("adminUsername").textContent = username;
    }
  }

  async init() {
    try {
      const token = localStorage.getItem("adminToken");
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await fetch(`${CONFIG.API_URL}/admin/dashboard-stats`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to verify authentication");
      }

      // Show dashboard UI
      document.getElementById("loginContainer")?.classList.add("hidden");
      document.getElementById("dashboardContainer")?.classList.remove("hidden");

      // Set username in the dashboard (add this line)
      this.setUsername();

      this.setupDragAndDrop();

      // Setup dashboard
      this.setupEventListeners();
      this.setupOpeningHoursHandlers();
      await this.loadInitialData();
      this.initialized = true;
    } catch (error) {
      localStorage.removeItem("adminToken");
      window.location.replace("login.html");
    }
  }

  initCategorySelect() {
    if (this.categorySelect) {
      // Reset existing category select
      this.categorySelect.selectedCategories.clear();
      this.categorySelect.updateSelectedCategories();
      return this.categorySelect;
    }

    const categorySelect = document.getElementById("categorySelect");
    const categoryDropdown = document.getElementById("categoryDropdown");
    const hiddenInput = document.getElementById("venueCategory");

    // Populate dropdown options
    categoryDropdown.innerHTML = Object.entries(CONFIG.CATEGORIES)
      .map(
        ([key, cat]) => `
            <div class="category-option" data-value="${key}">
                <span>${cat.icon}</span>
                <span>${cat.label}</span>
            </div>
        `
      )
      .join("");

    const selectedCategories = new Set();

    const updateSelectedCategories = () => {
      const placeholder = categorySelect.querySelector(".placeholder");
      if (placeholder) {
        categorySelect.removeChild(placeholder);
      }

      categorySelect.innerHTML =
        Array.from(selectedCategories)
          .map(
            (cat) => `
                <div class="category-item">
                    <span>${CONFIG.CATEGORIES[cat].icon} ${CONFIG.CATEGORIES[cat].label}</span>
                    <span class="remove-category" data-value="${cat}">&times;</span>
                </div>
            `
          )
          .join("") || '<span class="placeholder">Select Categories</span>';

      hiddenInput.value = Array.from(selectedCategories).join(",");

      // Update dropdown selected states
      document.querySelectorAll(".category-option").forEach((opt) => {
        opt.classList.toggle(
          "selected",
          selectedCategories.has(opt.dataset.value)
        );
      });
    };

    // Event Listeners
    categorySelect.addEventListener("click", () => {
      categoryDropdown.classList.toggle("show");
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".category-select-container")) {
        categoryDropdown.classList.remove("show");
      }
    });

    categoryDropdown.addEventListener("click", (e) => {
      const option = e.target.closest(".category-option");
      if (option) {
        const value = option.dataset.value;
        if (selectedCategories.has(value)) {
          selectedCategories.delete(value);
        } else {
          selectedCategories.add(value);
        }
        updateSelectedCategories();
      }
    });

    categorySelect.addEventListener("click", (e) => {
      const removeBtn = e.target.closest(".remove-category");
      if (removeBtn) {
        e.stopPropagation();
        selectedCategories.delete(removeBtn.dataset.value);
        updateSelectedCategories();
      }
    });

    this.categorySelect = { selectedCategories, updateSelectedCategories };
    return this.categorySelect;
  }

  async editVenue(venueId) {
    try {
      // Fetch the venue details
      const response = await fetch(`${CONFIG.API_URL}/venues/${venueId}`, {
        headers: auth.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch venue details");
      }

      const { data: venue } = await response.json();

      // Update modal title
      document.getElementById("modalTitle").textContent = "Edit Venue";

      // Set the venue ID in the form
      const form = document.getElementById("venueForm");
      form.dataset.venueId = venueId;

      // Fill the form with venue data
      this.fillVenueForm(venue);

      // Show the modal
      const modal = document.getElementById("venueModal");
      modal.classList.remove("hidden");
    } catch (error) {
      alert("Failed to load venue details");
    }
  }

  setupEventListeners() {
    // Navigation
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        if (e.currentTarget.id === "logoutBtn") {
          localStorage.removeItem("adminToken");
          localStorage.removeItem("adminUsername"); // Add this line
          window.location.replace("login.html");
        } else {
          this.switchView(e.currentTarget.dataset.view);
        }
      });
    });

    // Add Banner Button
    const addBannerBtn = document.getElementById("addBannerBtn");
    if (addBannerBtn) {
      addBannerBtn.addEventListener("click", () => this.openBannerModal());
    }

    // Banner Form
    const bannerForm = document.getElementById("bannerForm");
    if (bannerForm) {
      bannerForm.addEventListener("submit", (e) => this.handleBannerSubmit(e));
    }

    // Close Banner Modal
    const closeBannerBtn = document.querySelector("#bannerModal .close-modal");
    if (closeBannerBtn) {
      closeBannerBtn.addEventListener("click", () => this.closeBannerModal());
    }

    // Mobile menu toggle
    const menuToggle = document.getElementById("menuToggle");
    const sidebar = document.querySelector(".sidebar");
    const overlay = document.getElementById("sidebarOverlay");

    if (menuToggle && sidebar && overlay) {
      menuToggle.addEventListener("click", () => {
        sidebar.classList.toggle("active");
        overlay.classList.toggle("active");
      });

      overlay.addEventListener("click", () => {
        sidebar.classList.remove("active");
        overlay.classList.remove("active");
      });

      // Close sidebar when clicking a nav item on mobile
      document.querySelectorAll(".nav-item").forEach((item) => {
        item.addEventListener("click", () => {
          if (window.innerWidth <= 768) {
            sidebar.classList.remove("active");
            overlay.classList.remove("active");
          }
        });
      });

      // Handle resize
      window.addEventListener("resize", () => {
        if (window.innerWidth > 768) {
          sidebar.classList.remove("active");
          overlay.classList.remove("active");
        }
      });
    }

    // Add Venue Button
    const addVenueBtn = document.getElementById("addVenueBtn");
    if (addVenueBtn) {
      addVenueBtn.addEventListener("click", () => this.showVenueModal());
    }

    // Venue Form
    const venueForm = document.getElementById("venueForm");
    if (venueForm) {
      venueForm.addEventListener("submit", (e) => this.handleVenueSubmit(e));
    }

    // Search
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.addEventListener(
        "input",
        debounce((e) => {
          const query = e.target.value.trim();
          if (query) {
            this.handleSearch(query);
          } else {
            // If search is cleared, reload initial data
            this.loadVenues(0);
          }
        }, 300)
      );
    }

    // Handle session expiry
    this.setupSessionHandler();

    // Venue Modal close button
    const closeVenueModalBtn = document.querySelector(
      "#venueModal .close-modal"
    );
    if (closeVenueModalBtn) {
      closeVenueModalBtn.addEventListener("click", () => this.closeModal());
    }

    // Banner Modal close button
    const closeBannerModalBtn = document.querySelector(
      "#bannerModal .close-modal"
    );
    if (closeBannerModalBtn) {
      closeBannerModalBtn.addEventListener("click", () =>
        this.closeBannerModal()
      );
    }
  }

  // Add image preview functionality
  setupBannerImagePreview() {
    const imageUrlInput = document.getElementById("bannerImageUrl");
    const previewContainer = document.createElement("div");
    previewContainer.className = "image-preview-container";
    previewContainer.innerHTML = `
      <img id="imagePreview" class="image-preview hidden" alt="Preview">
      <p id="previewError" class="preview-error hidden">Invalid image URL</p>
  `;

    imageUrlInput.parentNode.appendChild(previewContainer);

    imageUrlInput.addEventListener(
      "input",
      debounce(() => {
        const imageUrl = imageUrlInput.value;
        const previewImg = document.getElementById("imagePreview");
        const previewError = document.getElementById("previewError");

        if (imageUrl) {
          const img = new Image();
          img.onload = () => {
            previewImg.src = imageUrl;
            previewImg.classList.remove("hidden");
            previewError.classList.add("hidden");
          };
          img.onerror = () => {
            previewImg.classList.add("hidden");
            previewError.classList.remove("hidden");
          };
          img.src = imageUrl;
        } else {
          previewImg.classList.add("hidden");
          previewError.classList.add("hidden");
        }
      }, 300)
    );
  }

  // Add drag and drop functionality
  setupDragAndDrop() {
    const tbody = document.getElementById("bannersTableBody");
    if (!tbody) return;

    let draggedItem = null;

    tbody.addEventListener("dragstart", (e) => {
      draggedItem = e.target.closest("tr");
      e.dataTransfer.effectAllowed = "move";
      draggedItem.classList.add("dragging");
    });

    tbody.addEventListener("dragend", (e) => {
      e.target.closest("tr")?.classList.remove("dragging");
      draggedItem = null;
    });

    tbody.addEventListener("dragover", (e) => {
      e.preventDefault();
      const tr = e.target.closest("tr");
      if (!tr || !draggedItem || tr === draggedItem) return;

      const rect = tr.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      const insertBefore = e.clientY < midpoint;

      if (insertBefore) {
        tr.parentNode.insertBefore(draggedItem, tr);
      } else {
        tr.parentNode.insertBefore(draggedItem, tr.nextSibling);
      }
    });

    tbody.addEventListener("dragend", async () => {
      const rows = tbody.querySelectorAll("tr");
      const newOrder = Array.from(rows).map((row, index) => ({
        id: row.dataset.bannerId,
        order: index + 1,
      }));

      try {
        const response = await fetch(`${CONFIG.API_URL}/banners/reorder`, {
          method: "PATCH",
          headers: auth.getAuthHeaders(),
          body: JSON.stringify({ orders: newOrder }),
        });

        if (!response.ok) throw new Error("Failed to update banner order");

        await this.loadBanners();
      } catch (error) {
        alert("Failed to save new banner order");
        await this.loadBanners(); // Reload to restore original order
      }
    });
  }

  setupSessionHandler() {
    // Check auth status every 5 minutes
    setInterval(async () => {
      try {
        const response = await fetch(
          `${CONFIG.API_URL}/admin/dashboard-stats`,
          {
            headers: auth.getAuthHeaders(),
          }
        );

        if (!response.ok) {
          throw new Error("Session expired");
        }
      } catch (error) {
        alert("Your session has expired. Please log in again.");
        window.location.href = "login.html";
      }
    }, 5 * 60 * 1000);
  }

  async loadInitialData() {
    try {
      await this.loadDashboardStats();
      await this.loadVenues();
      await this.loadBanners();
    } catch (error) {
      console.error("Error loading initial data:", error);
    }
  }

  async loadBanners() {
    try {
      const response = await fetch(`${CONFIG.API_URL}/banners`, {
        headers: auth.getAuthHeaders(),
      });

      if (!response.ok) throw new Error("Failed to fetch banners");

      const { data } = await response.json();
      this.banners = Array.isArray(data) ? data : [];
      this.renderBannersTable();
    } catch (error) {
      console.error("Error loading banners:", error);
      this.banners = [];
      this.renderBannersTable();
    }
  }

  renderBannersTable() {
    const tbody = document.getElementById("bannersTableBody");
    if (!tbody) return;

    if (!this.banners.length) {
      tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center p-4">No banners found</td>
            </tr>
        `;
      return;
    }

    tbody.innerHTML = this.banners
      .map(
        (banner) => `
        <tr draggable="true" data-banner-id="${banner._id}">
            <td>
                <div class="banner-drag-handle">⋮⋮</div>
                <img src="${banner.imageUrl}" alt="${
          banner.name
        }" class="banner-preview">
              </td>
            <td>${banner.name}</td>
            <td>
                <a href="${banner.link}" target="_blank" class="truncate-text">
                    ${banner.link}
                </a>
            </td>
            <td>${banner.order}</td>
            <td>
                <span class="status-badge ${
                  banner.active ? "status-open" : "status-closed"
                }">
                    ${banner.active ? "Active" : "Inactive"}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button 
                        class="btn btn-primary"
                        onclick="dashboard.editBanner('${banner._id}')"
                    >
                        <i class="fas fa-edit"></i>
                    </button>
                    <button 
                        class="btn btn-danger"
                        onclick="dashboard.deleteBanner('${banner._id}')"
                    >
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `
      )
      .join("");
  }

  async editBanner(bannerId) {
    try {
      const banner = this.banners.find((b) => b._id === bannerId);
      if (!banner) throw new Error("Banner not found");

      // Open modal first with edit mode
      this.openBannerModal(true);

      document.getElementById("bannerModalTitle").textContent = "Edit Banner";
      document.getElementById("bannerId").value = banner._id;
      document.getElementById("bannerName").value = banner.name;
      document.getElementById("bannerImageUrl").value = banner.imageUrl;
      document.getElementById("bannerLink").value = banner.link;
      document.getElementById("bannerOrder").value = banner.order;
      document.getElementById("bannerActive").checked = banner.active;
    } catch (error) {
      alert("Error loading banner details");
    }
  }

  async handleBannerSubmit(e) {
    e.preventDefault();

    const bannerId = document.getElementById("bannerId").value;
    const isEdit = !!bannerId;

    const formData = {
      name: document.getElementById("bannerName").value,
      imageUrl: document.getElementById("bannerImageUrl").value,
      link: document.getElementById("bannerLink").value,
      order: parseInt(document.getElementById("bannerOrder").value),
      active: document.getElementById("bannerActive").checked,
    };

    try {
      const response = await fetch(
        `${CONFIG.API_URL}/banners${isEdit ? `/${bannerId}` : ""}`,
        {
          method: isEdit ? "PATCH" : "POST",
          headers: auth.getAuthHeaders(),
          body: JSON.stringify(formData),
        }
      );

      if (!response.ok) throw new Error("Failed to save banner");

      await this.loadBanners();
      this.closeBannerModal();
      alert(
        isEdit ? "Banner updated successfully" : "Banner created successfully"
      );
    } catch (error) {
      alert(error.message);
    }
  }

  async deleteBanner(bannerId) {
    if (!confirm("Are you sure you want to delete this banner?")) return;

    try {
      const response = await fetch(`${CONFIG.API_URL}/banners/${bannerId}`, {
        method: "DELETE",
        headers: auth.getAuthHeaders(),
      });

      if (!response.ok) throw new Error("Failed to delete banner");

      await this.loadBanners();
    } catch (error) {
      alert(error.message);
    }
  }

  openBannerModal(isEdit = false) {
    const modal = document.getElementById("bannerModal");
    const modalTitle = document.getElementById("bannerModalTitle");

    // Only reset the form and title if it's a new banner
    if (!isEdit) {
      modalTitle.textContent = "Add New Banner";
      document.getElementById("bannerForm").reset();
      document.getElementById("bannerId").value = "";
    }

    this.setupBannerImagePreview();
    modal.classList.remove("hidden");
  }

  closeBannerModal() {
    const modal = document.getElementById("bannerModal");
    const form = document.getElementById("bannerForm");
    modal.classList.add("hidden");
    form.reset();
    document.getElementById("bannerId").value = "";
    document.getElementById("bannerForm").reset();
  }

  async loadDashboardStats() {
    try {
      const response = await fetch(`${CONFIG.API_URL}/admin/dashboard-stats`, {
        headers: auth.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch dashboard stats");
      }

      const { data } = await response.json();

      // Update stats with proper fallbacks
      document.getElementById("totalVenues").textContent =
        data.totalVenues || "0";
      document.getElementById("totalCategories").textContent =
        data.categoryStats?.length ||
        Object.keys(CONFIG.CATEGORIES).length ||
        "0";
      document.getElementById("recentUpdates").textContent =
        data.recentUpdates || "0";
    } catch (error) {
      // Set fallback values if loading fails
      document.getElementById("totalVenues").textContent = "0";
      document.getElementById("totalCategories").textContent = "0";
      document.getElementById("recentUpdates").textContent = "0";
    }
  }

  async loadVenues(page = 0, limit = 15) {
    try {
      // Get current search query if any
      const searchInput = document.getElementById("searchInput");
      const searchQuery = searchInput ? searchInput.value.trim() : "";

      // Build URL with search parameter if exists
      const url = new URL(`${CONFIG.API_URL}/venues`);
      url.searchParams.append("page", page);
      url.searchParams.append("limit", limit);
      if (searchQuery) {
        url.searchParams.append("search", searchQuery);
      }

      const response = await fetch(url, {
        headers: auth.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch venues");
      }

      const {
        data,
        total,
        page: currentPage,
        totalPages,
      } = await response.json();
      this.venues = Array.isArray(data) ? data : [];
      this.totalVenues = total;
      this.currentPage = page;
      this.totalPages = Math.ceil(total / limit);
      this.renderVenuesTable();
    } catch (error) {
      this.venues = [];
      this.renderVenuesTable();
    }
  }

  renderVenuesTable() {
    const tbody = document.getElementById("venuesTableBody");
    const paginationContainer = document.getElementById("paginationContainer");

    if (!tbody || !paginationContainer) return;

    if (!this.venues.length) {
      const searchInput = document.getElementById("searchInput");
      const isSearching = searchInput && searchInput.value.trim();

      tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center p-4">
                        ${
                          isSearching
                            ? "No venues found matching your search"
                            : "No venues found"
                        }
                    </td>
                </tr>
            `;
      paginationContainer.innerHTML = "";
      return;
    }

    tbody.innerHTML = this.venues
      .map(
        (venue) => `
            <tr>
                <td>${venue.name}</td>
                <td>${
                  CONFIG.CATEGORIES[venue.category]?.label || venue.category
                }</td>
                <td>${venue.address}</td>
                <td>
                    <span class="status-badge ${
                      venue.is24_7 ? "status-open" : "status-closed"
                    }">
                        ${venue.is24_7 ? "24/7" : "Regular Hours"}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <span class="importance-badge" title="Importance Level">
                          ${venue.importance || 5}
                        </span>
                        <button 
                            class="btn btn-primary" 
                            type="button"
                            onclick="window.dashboard.editVenue('${venue._id}')"
                        >
                            <i class="fas fa-edit"></i>
                        </button>
                        <button 
                            class="btn btn-danger"
                            type="button"
                            onclick="window.dashboard.deleteVenue('${
                              venue._id
                            }')"
                        >
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `
      )
      .join("");

    paginationContainer.innerHTML = this.renderPagination();
  }

  renderPagination() {
    if (!this.totalPages || this.totalPages <= 1) {
      return "";
    }

    let paginationHTML = '<div class="pagination">';

    // Previous button
    paginationHTML += `
            <button 
                class="pagination-btn ${
                  this.currentPage <= 0 ? "disabled" : ""
                }"
                ${
                  this.currentPage <= 0
                    ? "disabled"
                    : `onclick="window.dashboard.loadVenues(${
                        this.currentPage - 1
                      })"`
                }
            >
                Previous
            </button>
        `;

    // Page numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(
      0,
      this.currentPage - Math.floor(maxVisiblePages / 2)
    );
    let endPage = Math.min(
      this.totalPages - 1,
      startPage + maxVisiblePages - 1
    );

    // Adjust start if we're near the end
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(0, endPage - maxVisiblePages + 1);
    }

    // First page
    if (startPage > 0) {
      paginationHTML += `
                <button class="pagination-btn" onclick="window.dashboard.loadVenues(0)">1</button>
                ${
                  startPage > 1
                    ? '<span class="pagination-ellipsis">...</span>'
                    : ""
                }
            `;
    }

    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
      paginationHTML += `
                <button 
                    class="pagination-btn ${
                      i === this.currentPage ? "active" : ""
                    }"
                    onclick="window.dashboard.loadVenues(${i})"
                >
                    ${i + 1}
                </button>
            `;
    }

    // Last page
    if (endPage < this.totalPages - 1) {
      paginationHTML += `
                ${
                  endPage < this.totalPages - 2
                    ? '<span class="pagination-ellipsis">...</span>'
                    : ""
                }
                <button class="pagination-btn" onclick="window.dashboard.loadVenues(${
                  this.totalPages - 1
                })">
                    ${this.totalPages}
                </button>
            `;
    }

    // Next button
    paginationHTML += `
            <button 
                class="pagination-btn ${
                  this.currentPage >= this.totalPages - 1 ? "disabled" : ""
                }"
                ${
                  this.currentPage >= this.totalPages - 1
                    ? "disabled"
                    : `onclick="window.dashboard.loadVenues(${
                        this.currentPage + 1
                      })"`
                }
            >
                Next
            </button>
        `;

    paginationHTML += "</div>";
    return paginationHTML;
  }

  switchView(view) {
    // Update navigation
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.view === view);
    });

    // Update content views
    document.querySelectorAll(".content-view").forEach((view) => {
      view.classList.add("hidden");
    });
    document.getElementById(`${view}View`)?.classList.remove("hidden");

    // Load view-specific data
    if (view === "categories") {
      this.loadCategories();
    }

    this.currentView = view;
  }

  showVenueModal(venueId = null) {
    const modal = document.getElementById("venueModal");
    const modalTitle = document.getElementById("modalTitle");
    const form = document.getElementById("venueForm");

    // Reset form and clear venue ID
    form.reset();
    form.dataset.venueId = "";

    // Initialize category select
    this.initCategorySelect();

    if (venueId) {
      modalTitle.textContent = "Edit Venue";
      form.dataset.venueId = venueId;
      const venue = this.venues.find((v) => v._id === venueId);
      if (venue) {
        this.fillVenueForm(venue);
      }
    } else {
      modalTitle.textContent = "Add New Venue";
    }

    modal.classList.remove("hidden");
  }

  setupOpeningHoursHandlers() {
    const checkbox24_7 = document.getElementById("venue24_7");
    const openingHoursContainer = document.getElementById(
      "openingHoursContainer"
    );

    if (checkbox24_7 && openingHoursContainer) {
      checkbox24_7.addEventListener("change", (e) => {
        const is24_7 = e.target.checked;
        openingHoursContainer.classList.toggle("hidden", is24_7);

        if (is24_7) {
          this.savedOpeningHours = {};
          const days = [
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday",
          ];
          days.forEach((day) => {
            const openInput = document.getElementById(`${day.slice(0, 3)}Open`);
            const closeInput = document.getElementById(
              `${day.slice(0, 3)}Close`
            );
            if (openInput.value || closeInput.value) {
              this.savedOpeningHours[day] = {
                open: openInput.value,
                close: closeInput.value,
              };
            }
          });

          // Clear and disable inputs
          const timeInputs =
            openingHoursContainer.querySelectorAll('input[type="time"]');
          timeInputs.forEach((input) => {
            input.disabled = true;
            input.value = "";
          });
        } else {
          // Restore saved hours when unchecking 24/7
          if (this.savedOpeningHours) {
            const days = Object.keys(this.savedOpeningHours);
            days.forEach((day) => {
              const openInput = document.getElementById(
                `${day.slice(0, 3)}Open`
              );
              const closeInput = document.getElementById(
                `${day.slice(0, 3)}Close`
              );
              if (openInput && closeInput) {
                openInput.disabled = false;
                closeInput.disabled = false;
                openInput.value = this.savedOpeningHours[day].open || "";
                closeInput.value = this.savedOpeningHours[day].close || "";
              }
            });
          }

          // Enable any remaining disabled inputs
          const timeInputs =
            openingHoursContainer.querySelectorAll('input[type="time"]');
          timeInputs.forEach((input) => {
            input.disabled = false;
          });
        }
      });
    }

    document.querySelectorAll('.time-inputs input[type="text"]').forEach(input => {
      // Add input event listener for real-time validation
      input.addEventListener('input', (e) => {
          const timeInput = e.target;
          const isValid = this.validateTimeFormat(timeInput.value);
          
          if (timeInput.value && !isValid) {
              timeInput.classList.add('invalid');
              // Show error message immediately under the input
              let errorMsg = timeInput.parentElement.querySelector('.time-error');
              if (!errorMsg) {
                  errorMsg = document.createElement('div');
                  errorMsg.className = 'time-error';
                  timeInput.parentElement.appendChild(errorMsg);
              }
              errorMsg.textContent = 'Please use HH:MM format (e.g., 08:00)';
          } else {
              timeInput.classList.remove('invalid');
              // Remove error message if input becomes valid
              const errorMsg = timeInput.parentElement.querySelector('.time-error');
              if (errorMsg) errorMsg.remove();
          }
      });
    });

    // Handle clear buttons
    document.querySelectorAll('.clear-times-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
          const day = e.target.closest('.clear-times-btn').dataset.day;
          const dayRow = e.target.closest('.day-row');
          // Get both open and close inputs specifically
          const openInput = dayRow.querySelector(`input[name="openingHours[${day}][open]"]`);
          const closeInput = dayRow.querySelector(`input[name="openingHours[${day}][close]"]`);
          
          if (openInput) openInput.value = '';
          if (closeInput) closeInput.value = '';
          
          if (this.savedOpeningHours && this.savedOpeningHours[day]) {
              delete this.savedOpeningHours[day];
          }
      });
    });
  }

  validateTimeFormat(timeStr) {
    if (!timeStr) return true; // Empty is valid
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(timeStr);
  }

  fillVenueForm(venue) {
    if (!venue) return;

    try {
      // Reset savedOpeningHours for the new venue
      this.savedOpeningHours = null;

      // Name
      document.getElementById("venueName").value = venue.name;

      // Categories
      const categorySelect = this.initCategorySelect();
      if (venue.category) {
        const categories = Array.isArray(venue.category)
          ? venue.category
          : venue.category.split(",");

        categories.forEach((cat) =>
          categorySelect.selectedCategories.add(cat.trim())
        );
        categorySelect.updateSelectedCategories();
      }

      // Address
      document.getElementById("venueAddress").value = venue.address || "";

      // Coordinates
      if (venue.location && Array.isArray(venue.location.coordinates)) {
        document.getElementById("venueLng").value =
          venue.location.coordinates[0] || "";
        document.getElementById("venueLat").value =
          venue.location.coordinates[1] || "";
      } else {
        document.getElementById("venueLng").value = "";
        document.getElementById("venueLat").value = "";
      }

      // Contact Information
      document.getElementById("venuePhone").value = venue.phone || "";
      document.getElementById("venueWebsite").value = venue.website || "";

      document.getElementById("venueImportance").value = venue.importance || 5;

      // Operating Hours
      const is24_7 = venue.is24_7 || false;
      document.getElementById("venue24_7").checked = is24_7;

      const openingHoursContainer = document.getElementById(
        "openingHoursContainer"
      );
      openingHoursContainer.classList.toggle("hidden", is24_7);

      // Fill opening hours if venue is not 24/7
      if (!is24_7 && venue.openingHours) {
        // Initialize savedOpeningHours with the venue's hours
        this.savedOpeningHours = {};
        const days = [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ];
        days.forEach((day) => {
          const dayHours = venue.openingHours[day];
          if (dayHours) {
            const openInput = document.getElementById(`${day.slice(0, 3)}Open`);
            const closeInput = document.getElementById(
              `${day.slice(0, 3)}Close`
            );

            // Set the values directly in HH:MM format
            openInput.value = dayHours.open || "";
            closeInput.value = dayHours.close || "";

            if (dayHours.open || dayHours.close) {
              this.savedOpeningHours[day] = {
                open: dayHours.open || "",
                close: dayHours.close || "",
              };
            }
          }
        });
      }
    } catch (error) {
      console.error("Error filling form:", error);
    }
  }

  // Add this method to your Dashboard class
  async loadCategories() {
    try {
      const categoriesData = Object.entries(CONFIG.CATEGORIES).map(
        ([key, value]) => ({
          id: key,
          ...value,
          count: 0,
        })
      );

      const response = await fetch(`${CONFIG.API_URL}/admin/dashboard-stats`, {
        headers: auth.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch category stats");
      }

      const { data } = await response.json();

      if (data && data.categoryStats && Array.isArray(data.categoryStats)) {
        data.categoryStats.forEach((stat) => {
          // Handle case where _id might be an array
          const categoryId = Array.isArray(stat._id) ? stat._id[0] : stat._id;
          const category = categoriesData.find((c) => c.id === categoryId);
          if (category) {
            category.count = stat.count || 0;
            console.log(`Updated count for ${category.id}:`, category.count);
          }
        });
      }

      this.renderCategories(categoriesData);
    } catch (error) {
      this.renderCategories(categoriesData);
    }
  }

  renderCategories(categories) {
    const grid = document.getElementById("categoriesGrid");
    if (!grid) return;

    grid.innerHTML = categories
      .map(
        (category) => `
            <div class="category-card">
                <div class="category-icon">
                    <span class="icon">${category.icon}</span>
                </div>
                <div class="category-info">
                    <h3>${category.label}</h3>
                    <p>${category.count} venues</p>
                </div>
            </div>
        `
      )
      .join("");
  }

  async handleVenueSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const venueId = form.dataset.venueId;
    const isEdit = !!venueId;
    const is24_7 = document.getElementById("venue24_7").checked;

    // Validate time formats before submitting
    const timeInputs = document.querySelectorAll('input[name*="openingHours"]');
    let hasInvalidTime = false;
    timeInputs.forEach((input) => {
      if (input.value && !this.validateTimeFormat(input.value)) {
        hasInvalidTime = true;
        input.classList.add("invalid");
      } else {
        input.classList.remove("invalid");
      }
    });

    if (hasInvalidTime) {
      alert("Please enter times in HH:MM format (e.g., 08:00)");
      return;
    }

    const formData = {
      name: document.getElementById("venueName").value,
      category: document.getElementById("venueCategory").value,
      address: document.getElementById("venueAddress").value,
      location: {
        type: "Point",
        coordinates: [
          parseFloat(document.getElementById("venueLng").value),
          parseFloat(document.getElementById("venueLat").value),
        ],
      },
      phone: document.getElementById("venuePhone").value,
      website: document.getElementById("venueWebsite").value,
      is24_7: is24_7,
      importance:
        parseInt(document.getElementById("venueImportance").value) || 5,
    };

    if (!is24_7) {
      const days = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ];
      formData.openingHours = {};

      days.forEach((day) => {
        const openTime = document.getElementById(
          `${day.slice(0, 3)}Open`
        ).value;
        const closeTime = document.getElementById(
          `${day.slice(0, 3)}Close`
        ).value;

        // Only include days that have both open and close times
        if (openTime && closeTime) {
          formData.openingHours[day] = {
            open: openTime,
            close: closeTime,
          };
        }
      });
    }

    try {
      const response = await fetch(
        `${CONFIG.API_URL}/venues${isEdit ? `/${venueId}` : ""}`,
        {
          method: isEdit ? "PATCH" : "POST",
          headers: auth.getAuthHeaders(),
          body: JSON.stringify(formData),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to save venue");
      }

      // Refresh venues list but maintain current page
      await this.loadVenues(this.currentPage); // Change this line

      // Close modal and reset form
      this.closeModal();

      // Show success message
      alert(
        isEdit ? "Venue updated successfully" : "Venue created successfully"
      );
    } catch (error) {
      console.error("Error submitting venue:", error);
      alert(error.message);
    }
  }

  closeModal() {
    const modal = document.getElementById("venueModal");
    const form = document.getElementById("venueForm");
    modal.classList.add("hidden");
    form.reset();
    form.dataset.venueId = "";

    // Reset saved hours
    this.savedOpeningHours = null;

    // Reset category select
    if (this.categorySelect) {
      this.categorySelect.selectedCategories.clear();
      this.categorySelect.updateSelectedCategories();
    }
  }

  async deleteVenue(venueId) {
    if (!confirm("Are you sure you want to delete this venue?")) return;

    try {
      const response = await fetch(`${CONFIG.API_URL}/venues/${venueId}`, {
        method: "DELETE",
        headers: auth.getAuthHeaders(),
      });

      if (!response.ok) throw new Error("Failed to delete venue");

      await this.loadVenues();
    } catch (error) {
      alert(error.message);
    }
  }

  async handleSearch(query) {
    try {
      // Reset to first page when searching
      const response = await fetch(
        `${CONFIG.API_URL}/venues?page=0&limit=15&search=${encodeURIComponent(
          query
        )}`,
        {
          headers: auth.getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch search results");
      }

      const { data, total, page, totalPages } = await response.json();

      // Update dashboard state with search results
      this.venues = Array.isArray(data) ? data : [];
      this.totalVenues = total;
      this.currentPage = page;
      this.totalPages = totalPages;

      // Render the results
      this.renderVenuesTable();
    } catch (error) {
      this.venues = [];
      this.renderVenuesTable();
    }
  }
}

// Update initialization
document.addEventListener("DOMContentLoaded", () => {
  const dashboard = new Dashboard();
  // Only initialize if we're on the index page and not the login page
  if (!window.location.pathname.endsWith("login.html")) {
    dashboard.init().catch((error) => {
      // Only redirect if it's an authentication error
      if (
        error.message.includes("authentication") ||
        error.message.includes("token")
      ) {
        localStorage.removeItem("adminToken");
        window.location.replace("login.html");
      }
    });
  }
  window.dashboard = dashboard;
});
