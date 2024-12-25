function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

class VenueDisplay {
    constructor() {
        this.map = null;
        this.markers = new Map();
        this.allVenues = []; // Store original full dataset
        this.venues = []; // Filtered venues for display
        this.currentCategory = 'all';
        this.showOnlyOpen = false;
        this.currentView = 'list';
        this.defaultLocation = {
            lat: 46.2309,
            lng: 10.8266
        };
        this.debouncedLoadVenues = this.debounce(this.loadVenues.bind(this), 1000);
        this.isLoading = true;
        this.listViewActive = true;
        this.mapViewActive = true;
        this.banners = [];
    }

    // Debounce helper method
    debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    async initialize() {
        try {
            this.showLoading();

            // Initialize map
            this.initializeMap();
    
            // Setup event listeners
            this.setupEventListeners();
    
            // Load initial venues and update map
            await this.loadVenues();
    
            // Update views
            this.toggleView('list');

            // load banners
            await this.loadBanners();
    
            // Show content once everything is ready
            this.hideLoading();
            document.getElementById('mapView').classList.add('loaded');
            document.getElementById('listView').classList.add('loaded');
            
            // Update map after showing content
            setTimeout(() => {
                this.updateMapView();
                this.fitMapToBounds();
            }, 100);
    
            // Start status refresh interval
            this.startStatusRefreshInterval();
    
            return true;
        } catch (error) {
            document.getElementById('loadingSpinner')?.classList.add('hidden');
            return false;
        }
    }

    async loadBanners() {
        try {
            const response = await fetch(`${CONFIG.API_URL}/banners`);
            if (!response.ok) throw new Error('Failed to fetch banners');

            const { data } = await response.json();
            this.banners = Array.isArray(data) ? data : [];
            this.updateBannerDisplay();
        } catch (error) {
            console.error('Error loading banners:', error);
            this.banners = [];
        }
    }

    updateBannerDisplay() {
        const container = document.getElementById('bannerContainer');
        if (!container) return;

        container.innerHTML = this.banners
            .filter(banner => banner.active)
            .sort((a, b) => a.order - b.order)
            .map(banner => `
                <a href="${banner.link}" class="banner-item" target="_blank" rel="noopener noreferrer">
                    <img src="${banner.imageUrl}" alt="${banner.name}">
                </a>
            `).join('');
    }

    showLoading() {
        this.isLoading = true;
        document.getElementById('loadingSpinner')?.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Prevent scrolling while loading
    }

    hideLoading() {
        this.isLoading = false;
        document.getElementById('loadingSpinner')?.classList.add('hidden');
        document.body.style.overflow = ''; // Restore scrolling
    }

    initializeMap() {
        // For desktop, always initialize in mapView first
        const mapContainer = document.getElementById('mapView');
        if (!mapContainer) return;
    
        this.map = L.map('map', {
            zoomControl: true,
            scrollWheelZoom: true
        }).setView([this.defaultLocation.lat, this.defaultLocation.lng], 14);
    
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);
    
        setTimeout(() => {
            this.map.invalidateSize();
            if (this.venues.length > 0) {
                this.fitMapToBounds();
            }
        }, 100);
    }

    setupEventListeners() {
        // View toggle buttons
        const listViewBtn = document.getElementById('listViewBtn');
        const mapViewBtn = document.getElementById('mapViewBtn');
    
        if (listViewBtn) {
            listViewBtn.addEventListener('click', () => this.toggleView('list'));
        }
        if (mapViewBtn) {
            mapViewBtn.addEventListener('click', () => this.toggleView('map'));
        }
    
        // Category filters
        document.querySelectorAll('.category-filters button').forEach(button => {
            button.addEventListener('click', (e) => {
                const category = e.target.dataset.category;
                this.currentCategory = category;
                this.setActiveCategory(category);
                this.updateDisplay();
            });
        });
    
        // Open now filter
        const openNowFilter = document.getElementById('openNowFilter');
        if (openNowFilter) {
            openNowFilter.addEventListener('change', (e) => {
                this.showOnlyOpen = e.target.checked;
                this.updateDisplay();
            });
        }
    
        // Search input
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this.updateDisplay();
            });
        }
    
        // Mobile map panel close button
        document.querySelector('.close-panel')?.addEventListener('click', () => {
            this.closeMobileMapPanel();
        });
    
        // Handle window resize
        window.addEventListener('resize', () => {
            if (this.map) {
                setTimeout(() => {
                    this.map.invalidateSize();
                    if (this.venues.length > 0) {
                        this.fitMapToBounds();
                    }
                }, 100);
            }
        });

        // Add this to your setupEventListeners method
        if (window.innerWidth <= 768) {
            // Create fixed search input
            const fixedSearchHTML = `
                <div class="fixed-search">
                    <input 
                        type="text" 
                        id="fixedSearchInput" 
                        placeholder="Search venues..."
                        aria-label="Search venues"
                    >
                </div>
            `;
            document.body.insertAdjacentHTML('afterbegin', fixedSearchHTML);

            const originalSearch = document.getElementById('searchInput');
            const fixedSearch = document.querySelector('.fixed-search');
            const fixedSearchInput = document.getElementById('fixedSearchInput');

            // Sync the two search inputs
            fixedSearchInput.addEventListener('input', (e) => {
                originalSearch.value = e.target.value;
                this.updateDisplay();
            });

            originalSearch.addEventListener('input', (e) => {
                fixedSearchInput.value = e.target.value;
            });

            // Handle scroll
            let lastScrollTop = 0;
            window.addEventListener('scroll', () => {
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                const searchRect = originalSearch.getBoundingClientRect();
                
                if (searchRect.top < -50) {
                    fixedSearch.classList.add('visible');
                } else {
                    fixedSearch.classList.remove('visible');
                }
                
                lastScrollTop = scrollTop;
            });
        }
    }

    determineVenueStatus(venue) {
        // First priority: Check 24/7 status
        if (venue.is24_7) {
            return { isOpen: true, text: 'Open' };
        }
    
        // Second priority: Check opening hours if available
        if (venue.openingHours) {
            const now = new Date();
            const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const currentDay = days[now.getDay()];
            const todayHours = venue.openingHours[currentDay];
    
            if (todayHours && todayHours.open && todayHours.close) {
                // Convert current time to HH:MM format
                const currentTime = now.getHours().toString().padStart(2, '0') + ':' + 
                                  now.getMinutes().toString().padStart(2, '0');
    
                // Handle cases where closing time is on the next day
                if (todayHours.close < todayHours.open) {
                    const isOpen = currentTime >= todayHours.open || currentTime < todayHours.close;
                    return {
                        isOpen: isOpen,
                        text: isOpen ? 'Open' : 'Closed'
                    };
                }
    
                // Normal case where closing time is on the same day
                const isOpen = currentTime >= todayHours.open && currentTime < todayHours.close;
                return {
                    isOpen: isOpen,
                    text: isOpen ? 'Open' : 'Closed'
                };
            }
        }
    
        // If no valid opening hours found
        return { isOpen: false, text: 'Closed' };
    }

    async loadVenues(category = 'all') {
        const loadingSpinner = document.getElementById('loadingSpinner');
        const errorMessage = document.getElementById('errorMessage');
    
        try {
            this.showLoading();
            if (loadingSpinner) loadingSpinner.classList.remove('hidden');
            if (errorMessage) errorMessage.classList.add('hidden');
    
            const params = new URLSearchParams({
                lat: this.defaultLocation.lat,
                lng: this.defaultLocation.lng,
                limit: 0
            });
    
            const response = await fetch(`${CONFIG.API_URL}/venues?${params}`);
    
            if (!response.ok) {
                throw new Error('Failed to fetch venues');
            }
    
            const { data } = await response.json();
    
            if (Array.isArray(data)) {
                // Keep categories as an array if they come as an array
                const processedData = data.map(venue => ({
                    ...venue,
                    category: Array.isArray(venue.category) ? venue.category : [venue.category],
                    importance: venue.importance || 5 // Ensure importance has a default value
                }));
    
                // Sort by importance before updating allVenues
                processedData.sort((a, b) => {
                    if (b.importance !== a.importance) {
                        return b.importance - a.importance; // Higher importance first
                    }
                    // If importance is equal, sort alphabetically
                    return a.name.localeCompare(b.name);
                });
    
                this.allVenues = processedData;
                this.currentCategory = category;
                this.updateDisplay();
                this.hideLoading();
            }
        } catch (error) {
            if (errorMessage) {
                errorMessage.classList.remove('hidden');
                errorMessage.textContent = 'Error loading venues. Please try again.';
            }
        } finally {
            if (loadingSpinner) loadingSpinner.classList.add('hidden');
        }
    }

    fitMapToBounds() {
        if (!this.venues.length || !this.map) return;
    
        const validVenues = this.venues.filter(venue => 
            venue.location && 
            Array.isArray(venue.location.coordinates) && 
            venue.location.coordinates.length === 2
        );
    
        if (validVenues.length > 0) {
            // Find the area with highest concentration of venues
            const gridSize = 0.005; // Reduced grid size for more precise clustering
            const venueGrid = {};
            
            // Group venues into grid cells
            validVenues.forEach(venue => {
                const lat = Math.floor(venue.location.coordinates[1] / gridSize);
                const lng = Math.floor(venue.location.coordinates[0] / gridSize);
                const key = `${lat},${lng}`;
                venueGrid[key] = (venueGrid[key] || 0) + 1;
            });
    
            // Find grid cells with venues and sort by count
            const cellsByCount = Object.entries(venueGrid)
                .sort(([, count1], [, count2]) => count2 - count1);
    
            if (cellsByCount.length > 0) {
                // Get the cell with most venues
                const [bestCell] = cellsByCount[0];
                const [lat, lng] = bestCell.split(',').map(n => parseInt(n));
                
                // Calculate center with offset to ensure surrounding venues are visible
                const center = L.latLng(
                    (lat + 0.5) * gridSize,
                    (lng + 0.5) * gridSize
                );
    
                // Default to Madonna di Campiglio center if calculated center is too far
                const madonnaCenter = L.latLng(46.2309, 10.8266);
                const distanceToMadonna = center.distanceTo(madonnaCenter);
                
                // Use calculated center only if it's within 2km of Madonna di Campiglio
                const finalCenter = distanceToMadonna > 2000 ? madonnaCenter : center;
    
                // Set view with appropriate zoom level
                if (this.currentCategory !== 'all') {
                    this.map.setView(finalCenter, 17, {
                        animate: true,
                        duration: 1
                    });
                } else {
                    this.map.setView(finalCenter, 16, {
                        animate: true,
                        duration: 1
                    });
                }
            }
        } else {
            // If no venues found, center on Madonna di Campiglio
            this.map.setView(
                [this.defaultLocation.lat, this.defaultLocation.lng],
                15
            );
        }
    }

    updateDisplay() {
        // Start with all venues (already sorted by importance)
        let filteredVenues = [...this.allVenues];
    
        // Category filtering - now checks if venue has the selected category
        if (this.currentCategory !== 'all') {
            filteredVenues = filteredVenues.filter(venue => {
                const venueCategories = venue.category.map(cat => 
                    cat.toString().toLowerCase().trim()
                );
                const targetCategory = this.currentCategory.toLowerCase().trim();
                
                return venueCategories.includes(targetCategory);
            });
        }
    
        // Open now filtering
        if (this.showOnlyOpen) {
            filteredVenues = filteredVenues.filter(venue => {
                const status = this.determineVenueStatus(venue);
                return status.isOpen;
            });
        }
    
        // Search filtering
        const searchInput = document.getElementById('searchInput');
        const searchTerm = searchInput?.value?.trim().toLowerCase();
        if (searchTerm) {
            filteredVenues = filteredVenues.filter(venue => 
                venue.name.toLowerCase().includes(searchTerm) ||
                venue.address?.toLowerCase().includes(searchTerm)
            );
        }
    
        // No need to sort here as the original array is already sorted by importance
    
        // Update venues with filtered results
        this.venues = filteredVenues;
        
        // Update views
        this.updateListView();
        this.updateMapView();
        this.fitMapToBounds();
    }

    updateListView() {
        const venuesList = document.querySelector('.venues-list');
        if (!venuesList) return;
    
        if (this.venues.length === 0) {
            venuesList.innerHTML = `
                <div class="no-results">
                    <p>No venues found matching your criteria</p>
                </div>
            `;
            return;
        }
    
        venuesList.innerHTML = this.venues.map(venue => {
            const status = this.determineVenueStatus(venue);
            const categoryIcons = venue.category
                .map(cat => `<span class="category-icon">${CONFIG.CATEGORIES[cat]?.icon || ''}</span>`)
                .join('');

            const isFeatured = venue.importance > 5;
                
            return `
                <div class="venue-card ${isFeatured ? 'featured-venue' : ''}" data-id="${venue._id}">
                    ${isFeatured ? '<div class="featured-badge">⭐ Featured</div>' : ''}
                    <div class="venue-header">
                        <div class="venue-title">
                            <h3>${venue.name}</h3>
                            <div class="category-icons">${categoryIcons}</div>
                        </div>
                        <span class="status style-status-list ${status.isOpen ? 'open' : 'closed'}">
                            ${status.isOpen ? '🟢' : '🔴'} ${status.text}
                        </span>
                    </div>
                    <p class="venue-address">${venue.address || ''}</p>
                    <button class="view-details" onclick="venueDisplay.showVenueDetails('${venue._id}')">
                        See details
                    </button>
                </div>
            `;
        }).join('');
    }

    createMarker(venue, status) {
        const categoryConfig = CONFIG.CATEGORIES[venue.category] || {};
        const markerIcon = L.divIcon({
            html: `
                <div class="marker-icon" style="background-color: ${status.isOpen ? '#2ecc71' : '#e74c3c'}; 
                                               opacity: ${status.isOpen ? 0.9 : 0.6}">
                    ${categoryConfig.icon || '📍'}
                </div>
            `,
            className: 'custom-marker',
            iconSize: [30, 30]
        });

        const marker = L.marker(
            [venue.location.coordinates[1], venue.location.coordinates[0]],
            { icon: markerIcon, title: venue.name }
        ).addTo(this.map);

        marker.bindPopup(this.createPopupContent(venue, status));
        
        return marker;
    }

    createPopupContent(venue, status) {
        const categoryConfig = CONFIG.CATEGORIES[venue.category] || {};
        return `
            <div class="venue-popup">
                <h3>${venue.name} ${categoryConfig.icon || ''}</h3>
                <p class="status ${status.isOpen ? 'open' : 'closed'}">
                    ${status.isOpen ? '🟢' : '🔴'} ${status.text}
                </p>
                <p>${venue.address || ''}</p>
                ${venue.phone ? `
                    <p>
                        <a href="tel:${venue.phone}" class="website-link">
                            📞 ${venue.phone}
                        </a>
                    </p>
                ` : ''}
                ${venue.website ? `
                    <a href="${venue.website}" target="_blank" class="website-link">
                        🌐 Visit Website
                    </a>
                ` : ''}
                <button onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${venue.location.coordinates[1]},${venue.location.coordinates[0]}', '_blank')" class="directions-btn">
                    🗺️ Get Directions
                </button>
            </div>
        `;
    }

    updateMapView() {
        if (!this.map) return;

        // Clear existing markers
        this.markers.forEach(marker => marker.remove());
        this.markers.clear();

        // Add new markers
        this.venues.forEach(venue => {
            if (venue.location && 
                Array.isArray(venue.location.coordinates) && 
                venue.location.coordinates.length === 2) {
                const status = this.determineVenueStatus(venue);
                const marker = this.createMarker(venue, status);
                this.markers.set(venue._id, marker);
            }
        });

        // Update map size
        this.map.invalidateSize();
    }

    toggleView(view) {
        const listView = document.getElementById('listView');
        const mapView = document.getElementById('mapView');
        const listViewBtn = document.getElementById('listViewBtn');
        const mapViewBtn = document.getElementById('mapViewBtn');
    
        // Update view buttons
        listViewBtn?.classList.toggle('active', view === 'list');
        mapViewBtn?.classList.toggle('active', view === 'map');
    
        // Update view containers and ensure proper display
        listView?.classList.add('active');
        mapView?.classList.add('active');
    
        const isMobile = window.innerWidth <= 768;
    
        if (isMobile) {
            // On mobile, list view should always be full width
            listView.style.width = '100%';
            listView.style.flex = 'none';
            mapView.style.flex = 'none';
        } else {
            // On desktop, maintain 50-50 split
            if (view === 'list') {
                listView.style.width = '50%';
                listView.style.flex = '0 0 50%';
                mapView.style.flex = '0 0 50%';
            } else {
                listView.style.width = '50%';
                listView.style.flex = '0 0 50%';
                mapView.style.flex = '0 0 50%';
            }
        }
    
        setTimeout(() => {
            this.map.invalidateSize();
            this.fitMapToBounds();
        }, 100);
    
        this.currentView = view;
    }

    setActiveCategory(category) {
        document.querySelectorAll('.category-filters button').forEach(button => {
            button.classList.toggle('active', button.dataset.category === category);
        });
    }

    handleSearch(searchTerm) {
        if (!searchTerm.trim()) {
            this.loadVenues(this.currentCategory);
            return;
        }

        const filteredVenues = this.venues.filter(venue =>
            venue.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            venue.address?.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        this.venues = filteredVenues;
        this.updateDisplay();
    }

    startStatusRefreshInterval() {
        // Update venue statuses every minute
        setInterval(() => {
            if (this.venues.length > 0) {
                this.updateDisplay();
            }
        }, 60000);
    }

    showVenueDetails(venueId) {
        const isMobile = window.innerWidth <= 768;
        const venue = this.venues.find(v => v._id === venueId);
    
        if (!venue) return;
    
        const DETAIL_ZOOM_LEVEL = 19;
        const marker = this.markers.get(venueId);
        
        if (!marker) return;

        // Close any existing popups
        this.map.closePopup();
        
        const handleMarkerDisplay = () => {
            this.map.invalidateSize();
            
            // First set the view without animation
            this.map.setView(
                [venue.location.coordinates[1], venue.location.coordinates[0]],
                DETAIL_ZOOM_LEVEL,
                { animate: false }
            );
            
            // Force popup to open after a short delay
            setTimeout(() => {
                marker.openPopup();
                
                // Adjust view to account for popup height
                const popup = marker.getPopup();
                if (popup._container) {
                    const popupHeight = popup._container.offsetHeight;
                    const point = this.map.latLngToContainerPoint([
                        venue.location.coordinates[1],
                        venue.location.coordinates[0]
                    ]);
                    const adjustedPoint = L.point(point.x, point.y - (popupHeight/2));
                    const adjustedLatLng = this.map.containerPointToLatLng(adjustedPoint);
                    
                    this.map.setView(
                        adjustedLatLng,
                        DETAIL_ZOOM_LEVEL,
                        { animate: true, duration: 0.5 }
                    );
                }
            }, 100);
        };
    
        if (isMobile) {
            const mapPanel = document.querySelector('.mobile-map-panel');
            const mapContainer = document.querySelector('.mobile-map-panel .map-container');
            const mapElement = document.getElementById('map');
    
            if (mapPanel && mapContainer && mapElement) {
                if (mapElement.parentElement !== mapContainer) {
                    mapContainer.appendChild(mapElement);
                }
    
                mapPanel.classList.add('active');
                document.body.classList.add('map-panel-open');
                
                // Handle mobile display after panel animation
                setTimeout(handleMarkerDisplay, 300);
            }
        } else {
            const mapView = document.getElementById('mapView');
            const listView = document.getElementById('listView');
    
            if (mapView) {
                mapView.classList.add('active');
                if (listView) {
                    listView.classList.add('active');
                    listView.classList.add('map-visible');
                }
    
                handleMarkerDisplay();
    
                const mapViewBtn = document.getElementById('mapViewBtn');
                const listViewBtn = document.getElementById('listViewBtn');
    
                if (mapViewBtn) mapViewBtn.classList.add('active');
                if (listViewBtn) listViewBtn.classList.add('active');
    
                this.currentView = 'map';
            }
        }

    }

    closeMobileMapPanel() {
        const mapPanel = document.querySelector('.mobile-map-panel');
        const mapView = document.getElementById('mapView');
        const mapElement = document.getElementById('map');
    
        if (mapPanel && mapView && mapElement) {
            // Remove active class to trigger slide-down animation
            mapPanel.classList.remove('active');
            document.body.classList.remove('map-panel-open');
            
            // Wait for animation to complete before moving map
            setTimeout(() => {
                mapView.appendChild(mapElement);
                this.map.invalidateSize();
            }, 500);
        }
    }
    
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    window.venueDisplay = new VenueDisplay();
    window.venueDisplay.initialize();
});