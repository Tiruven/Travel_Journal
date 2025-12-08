// Hotspots Explorer Page with Wishlist Filter

class HotspotsExplorer {
    constructor() {
        this.hotspots = [];
        this.filteredHotspots = [];
        this.currentFilters = {
            category: 'all',
            status: 'all',
            sort: 'distance',
            search: ''
        };
        this.userPosition = null;
        this.wishlistView = false; // Track wishlist filter state
        this.init();
    }

    async init() {
        this.showLoading(true);

        try {
            // Check if dependencies are loaded
            if (typeof storage === 'undefined') {
                throw new Error('Storage not loaded');
            }

            await storage.waitForReady();

            try {
                this.userPosition = await gpsTracker.getCurrentPosition();
            } catch (error) {
                console.error('Could not get user position:', error);
            }

            await hotspotManager.loadHotspots();
            await hotspotManager.syncWishlist(); // Sync wishlist from database

            this.hotspots = hotspotManager.hotspots;
            console.log(`Loaded ${this.hotspots.length} hotspots for display`);

            if (this.userPosition) {
                hotspotManager.updateHotspotDistances(
                    this.userPosition.lat,
                    this.userPosition.lng
                );
            }

            this.setupEventListeners();
            this.updateStats();
            this.applyFilters();
        } catch (error) {
            console.error('Initialization error:', error);
            showNotification('Failed to load hotspots', 3000);
        } finally {
            this.showLoading(false);
        }
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        if (loading) {
            if (show) {
                loading.classList.remove('hidden');
            } else {
                loading.classList.add('hidden');
            }
        }
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('search-input');
        const clearSearch = document.getElementById('clear-search');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.currentFilters.search = e.target.value.toLowerCase();
                if (clearSearch) {
                    clearSearch.classList.toggle('hidden', !e.target.value);
                }
                this.applyFilters();
            });
        }

        if (clearSearch) {
            clearSearch.addEventListener('click', () => {
                if (searchInput) {
                    searchInput.value = '';
                    this.currentFilters.search = '';
                    clearSearch.classList.add('hidden');
                    this.applyFilters();
                }
            });
        }

        // Filter toggle
        const filterToggle = document.getElementById('filter-toggle');
        const filterPanel = document.getElementById('filter-panel');

        if (filterToggle && filterPanel) {
            filterToggle.addEventListener('click', () => {
                filterPanel.classList.toggle('hidden');
                filterToggle.classList.toggle('active');
            });
        }

        // Category filters
        document.querySelectorAll('[data-category]').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('[data-category]').forEach(c =>
                    c.classList.remove('active')
                );
                chip.classList.add('active');

                this.currentFilters.category = chip.dataset.category;
                this.applyFilters();
            });
        });

        // Status filters
        document.querySelectorAll('[data-status]').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('[data-status]').forEach(c =>
                    c.classList.remove('active')
                );
                chip.classList.add('active');

                this.currentFilters.status = chip.dataset.status;
                this.applyFilters();
            });
        });

        // Sort filters
        document.querySelectorAll('[data-sort]').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('[data-sort]').forEach(c =>
                    c.classList.remove('active')
                );
                chip.classList.add('active');

                this.currentFilters.sort = chip.dataset.sort;
                this.applyFilters();
            });
        });

        // Close modal
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                const modal = document.getElementById('detail-modal');
                if (modal) {
                    modal.classList.add('hidden');
                }
            });
        });

        // Wishlist button in header - TOGGLE FILTER
        const wishlistBtn = document.getElementById('wishlist-filter-btn');
        if (wishlistBtn) {
            wishlistBtn.addEventListener('click', () => {
                this.toggleWishlistFilter();
            });
        }
    }

    // Toggle wishlist filter
    toggleWishlistFilter() {
        this.wishlistView = !this.wishlistView;

        const wishlistBtn = document.getElementById('wishlist-filter-btn');
        if (wishlistBtn) {
            if (this.wishlistView) {
                wishlistBtn.classList.add('active');
                showNotification('Showing wishlist only', 2000);
            } else {
                wishlistBtn.classList.remove('active');
                showNotification('Showing all hotspots', 2000);
            }
        }

        this.applyFilters();
    }

    applyFilters() {
        this.filteredHotspots = this.hotspots;

        // Category filter
        if (this.currentFilters.category !== 'all') {
            this.filteredHotspots = this.filteredHotspots.filter(
                h => h.category === this.currentFilters.category
            );
        }

        // Status filter (visited/unvisited)
        if (this.currentFilters.status === 'visited') {
            this.filteredHotspots = this.filteredHotspots.filter(h => h.visited);
        } else if (this.currentFilters.status === 'unvisited') {
            this.filteredHotspots = this.filteredHotspots.filter(h => !h.visited);
        }

        // Wishlist filter (NEW)
        if (this.wishlistView) {
            const wishlist = hotspotManager.wishlist;
            this.filteredHotspots = this.filteredHotspots.filter(
                h => wishlist.includes(h.id)
            );
        }

        // Search filter
        if (this.currentFilters.search) {
            this.filteredHotspots = this.filteredHotspots.filter(h =>
                (h.name || '').toLowerCase().includes(this.currentFilters.search) ||
                (h.description || '').toLowerCase().includes(this.currentFilters.search) ||
                (h.address || '').toLowerCase().includes(this.currentFilters.search)
            );
        }

        this.sortHotspots();
        this.renderHotspots();
    }

    sortHotspots() {
        switch (this.currentFilters.sort) {
            case 'distance':
                this.filteredHotspots.sort((a, b) => (a.distance || 0) - (b.distance || 0));
                break;
            case 'name':
                this.filteredHotspots.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                break;
            case 'rating':
                this.filteredHotspots.sort((a, b) => (b.rating || 0) - (a.rating || 0));
                break;
        }
    }

    renderHotspots() {
        const container = document.getElementById('hotspots-container');
        const emptyState = document.getElementById('empty-state');

        if (!container) return;

        if (this.filteredHotspots.length === 0) {
            container.innerHTML = '';
            if (emptyState) {
                emptyState.classList.remove('hidden');
            }
            return;
        }

        if (emptyState) {
            emptyState.classList.add('hidden');
        }

        container.innerHTML = this.filteredHotspots.map(hotspot => {
            const isWishlisted = hotspotManager.isInWishlist(hotspot.id);
            const icon = hotspotManager.getCategoryIcon(hotspot.category);

            return `
                <div class="hotspot-card" onclick="hotspotsExplorer.showDetail('${hotspot.id}')">
                    <div class="hotspot-image">
                        ${hotspot.photos && hotspot.photos.length > 0
                    ? `<img src="${hotspot.photos[0]}" alt="${this.escapeHtml(hotspot.name || 'Hotspot')}">`
                    : `<i class="fas ${icon}"></i>`
                }
                    </div>
                    <div class="hotspot-content">
                        <div class="hotspot-header">
                            <div class="hotspot-title">
                                <h3>${this.escapeHtml(hotspot.name || 'Unknown Place')}</h3>
                                <span class="category-badge ${hotspot.category || 'tourism'}">${hotspot.category || 'tourism'}</span>
                            </div>
                            <div class="hotspot-actions">
                                <button class="icon-btn ${isWishlisted ? 'active' : ''}"
                                        onclick="event.stopPropagation(); hotspotsExplorer.toggleWishlist('${hotspot.id}')">
                                    <i class="fas fa-heart"></i>
                                </button>
                                ${hotspot.visited ? `
                                    <button class="icon-btn visited">
                                        <i class="fas fa-check"></i>
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                        <p class="hotspot-description">${this.escapeHtml(hotspot.description || 'No description')}</p>
                        <div class="hotspot-meta">
                            <div class="meta-item">
                                <i class="fas fa-route"></i>
                                <span>${formatDistance(hotspot.distance || 0)}</span>
                            </div>
                            ${hotspot.rating > 0 ? `
                                <div class="meta-item rating">
                                    <i class="fas fa-star"></i>
                                    <span>${hotspot.rating}</span>
                                </div>
                            ` : ''}
                            <div class="meta-item">
                                <i class="fas fa-map-marker-alt"></i>
                                <span>${this.escapeHtml((hotspot.address || 'N/A').substring(0, 30))}${(hotspot.address || '').length > 30 ? '...' : ''}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showDetail(hotspotId) {
        const hotspot = hotspotManager.getHotspotById(hotspotId);
        if (!hotspot) return;

        const isWishlisted = hotspotManager.isInWishlist(hotspot.id);
        const icon = hotspotManager.getCategoryIcon(hotspot.category);

        const detailContent = `
            <div class="detail-header">
                ${hotspot.photos && hotspot.photos.length > 0
                ? `<img src="${hotspot.photos[0]}" alt="${this.escapeHtml(hotspot.name || 'Hotspot')}">`
                : `<i class="fas ${icon} detail-header-icon"></i>`
            }
            </div>
            <div class="detail-body">
                <div class="detail-title">
                    <div>
                        <h2>${this.escapeHtml(hotspot.name || 'Unknown Place')}</h2>
                        <span class="category-badge ${hotspot.category || 'tourism'}">${hotspot.category || 'tourism'}</span>
                    </div>
                    <div class="detail-actions">
                        <button class="action-btn ${isWishlisted ? 'primary' : 'secondary'}"
                                onclick="hotspotsExplorer.toggleWishlist('${hotspot.id}')">
                            <i class="fas fa-heart"></i>
                            ${isWishlisted ? 'Wishlisted' : 'Add to Wishlist'}
                        </button>
                    </div>
                </div>
                <p class="detail-description">${this.escapeHtml(hotspot.description || 'No description available')}</p>
                <div class="detail-info">
                    <div class="info-row">
                        <i class="fas fa-map-marker-alt"></i>
                        <div class="info-content">
                            <div class="info-label">Address</div>
                            <div class="info-value">${this.escapeHtml(hotspot.address || 'N/A')}</div>
                        </div>
                    </div>
                    <div class="info-row">
                        <i class="fas fa-route"></i>
                        <div class="info-content">
                            <div class="info-label">Distance</div>
                            <div class="info-value">${formatDistance(hotspot.distance || 0)}</div>
                        </div>
                    </div>
                    <div class="info-row">
                        <i class="fas fa-compass"></i>
                        <div class="info-content">
                            <div class="info-label">Coordinates</div>
                            <div class="info-value">${hotspot.lat.toFixed(6)}, ${hotspot.lng.toFixed(6)}</div>
                        </div>
                    </div>
                    ${hotspot.rating > 0 ? `
                        <div class="info-row">
                            <i class="fas fa-star"></i>
                            <div class="info-content">
                                <div class="info-label">Rating</div>
                                <div class="info-value">${hotspot.rating} / 5.0</div>
                            </div>
                        </div>
                    ` : ''}
                    ${hotspot.details && hotspot.details.phone ? `
                        <div class="info-row">
                            <i class="fas fa-phone"></i>
                            <div class="info-content">
                                <div class="info-label">Phone</div>
                                <div class="info-value">${this.escapeHtml(hotspot.details.phone)}</div>
                            </div>
                        </div>
                    ` : ''}
                    ${hotspot.details && hotspot.details.website ? `
                        <div class="info-row">
                            <i class="fas fa-globe"></i>
                            <div class="info-content">
                                <div class="info-label">Website</div>
                                <div class="info-value">
                                    <a href="${hotspot.details.website}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(hotspot.details.website)}</a>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                    ${hotspot.details && hotspot.details.openingHours ? `
                        <div class="info-row">
                            <i class="fas fa-clock"></i>
                            <div class="info-content">
                                <div class="info-label">Opening Hours</div>
                                <div class="info-value">${this.escapeHtml(hotspot.details.openingHours)}</div>
                            </div>
                        </div>
                    ` : ''}
                </div>
                <button class="action-btn primary" style="width: 100%; justify-content: center; margin-top: 16px;"
                        onclick="hotspotsExplorer.navigateToHotspot('${hotspot.id}')">
                    <i class="fas fa-directions"></i>
                    Get Directions on Map
                </button>
                ${!hotspot.visited ? `
                    <button class="action-btn secondary" style="width: 100%; margin-top: 12px; justify-content: center;"
                            onclick="hotspotsExplorer.markAsVisited('${hotspot.id}')">
                        <i class="fas fa-check-circle"></i>
                        Mark as Visited
                    </button>
                ` : `
                    <div style="text-align: center; margin-top: 16px; color: var(--success-color);">
                        <i class="fas fa-check-circle"></i> Visited
                    </div>
                `}
            </div>
        `;

        const detailContentDiv = document.getElementById('detail-content');
        const detailModal = document.getElementById('detail-modal');

        if (detailContentDiv && detailModal) {
            detailContentDiv.innerHTML = detailContent;
            detailModal.classList.remove('hidden');
        }
    }

    async toggleWishlist(hotspotId) {
        console.log('=== TOGGLE WISHLIST ===');
        console.log('Hotspot ID:', hotspotId);
        console.log('Currently in wishlist?', hotspotManager.isInWishlist(hotspotId));

        if (hotspotManager.isInWishlist(hotspotId)) {
            console.log('Removing from wishlist...');
            await hotspotManager.removeFromWishlist(hotspotId);
        } else {
            console.log('Adding to wishlist...');
            await hotspotManager.addToWishlist(hotspotId);
        }

        console.log('New wishlist:', hotspotManager.wishlist);
        console.log('======================');

        this.updateStats();
        this.applyFilters();

        const modal = document.getElementById('detail-modal');
        if (modal && !modal.classList.contains('hidden')) {
            this.showDetail(hotspotId);
        }
    }

    async markAsVisited(hotspotId) {
        console.log('=== HOTSPOTS PAGE: MARK AS VISITED ===');
        console.log('Hotspot ID:', hotspotId);

        await hotspotManager.markHotspotAsVisited(hotspotId);

        console.log('Updating stats and filters...');
        this.updateStats();
        this.applyFilters();
        this.showDetail(hotspotId);

        console.log('===================================');
    }

    navigateToHotspot(hotspotId) {
        const hotspot = hotspotManager.getHotspotById(hotspotId);
        if (!hotspot) return;

        // Save navigation target
        localStorage.setItem('navigationTarget', JSON.stringify({
            id: hotspot.id,
            lat: hotspot.lat,
            lng: hotspot.lng,
            name: hotspot.name
        }));

        // Redirect to main map page
        window.location.href = 'index.html';
    }

    updateStats() {
        const totalElement = document.getElementById('total-hotspots');
        const visitedElement = document.getElementById('visited-count');
        const wishlistTotalElement = document.getElementById('wishlist-total');
        const wishlistCountElement = document.getElementById('wishlist-count');

        if (totalElement) {
            totalElement.textContent = this.hotspots.length;
        }

        if (visitedElement) {
            visitedElement.textContent = hotspotManager.getVisitedHotspots().length;
        }

        const wishlistCount = hotspotManager.wishlist.length;

        if (wishlistTotalElement) {
            wishlistTotalElement.textContent = wishlistCount;
        }

        if (wishlistCountElement) {
            wishlistCountElement.textContent = wishlistCount;
            wishlistCountElement.classList.toggle('hidden', wishlistCount === 0);
        }
    }
}

// Initialize
let hotspotsExplorer;
document.addEventListener('DOMContentLoaded', () => {
    hotspotsExplorer = new HotspotsExplorer();
});