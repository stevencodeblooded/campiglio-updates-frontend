const CONFIG = {
    // API_URL: 'https://server.campiglioismagic.it/api',
    API_URL: 'http://localhost:5001/api',
    CATEGORIES: {
        bars: {
            icon: '🍺',
            label: 'Bars'
        },
        clubs: {
            icon: '🎵',
            label: 'Clubs'
        },
        restaurants: {
            icon: '🍽️',
            label: 'Restaurants'
        },
        hotels: {
            icon: '🏨',
            label: 'Hotels'
        },
        shops: {
            icon: '🛍️',
            label: 'Shops'
        },
        skiresorts: {
            icon: '⛷️',
            label: 'Ski Resorts'
        },
        shelters: {
            icon: '🏕️',
            label: 'Shelters'
        },
        sports: {
            icon: '⚽',
            label: 'Sports'
        }
    }
};

// Ensure CONFIG is globally available
window.CONFIG = CONFIG;