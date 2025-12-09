class MemoryManager {
    constructor() {
        this.memories = [];
        this.currentFilter = 'all';
    }

    async init() {
        await storage.waitForReady();
        await this.loadMemories();
    }

    async loadMemories() {
        try {
            this.memories = await storage.getAllMemories();
            return this.memories;
        } catch (error) {
            return [];
        }
    }

    async addMemory(memory) {
        try {
            const id = await storage.saveMemory(memory);
            memory.id = id;
            this.memories.push(memory);
            return memory;
        } catch (error) {
            throw error;
        }
    }

    async deleteMemory(id) {
        try {
            await storage.deleteMemory(id);
            this.memories = this.memories.filter(m => m.id !== id);
            showNotification('Memory deleted');
        } catch (error) {
            showNotification('Failed to delete memory', 3000);
        }
    }

    getMemoriesByType(type) {
        return this.memories.filter(m => m.type === type);
    }

    getMemoriesByLocation(lat, lng, radius = 100) {
        return this.memories.filter(m => {
            if (!m.location) return false;
            const distance = calculateDistance(lat, lng, m.location.lat, m.location.lng);
            return distance <= radius;
        });
    }

    displayMemoriesInGallery() {
        const storageContent = document.getElementById('storage-content');
        if (!storageContent) return;

        const filteredMemories = this.currentFilter === 'all'
            ? this.memories
            : this.getMemoriesByType(this.currentFilter);

        if (filteredMemories.length === 0) {
            storageContent.innerHTML = '<p style="text-align: center; color: #64748b; padding: 40px;">No memories yet. Start creating some!</p>';
            return;
        }

        storageContent.innerHTML = filteredMemories.map(memory => {
            return this.createMemoryCard(memory);
        }).join('');

        storageContent.querySelectorAll('.memory-card').forEach((card, index) => {
            card.addEventListener('click', () => {
                this.showMemoryDetail(filteredMemories[index]);
            });
        });
    }


    createMemoryCard(memory) {
        const timestamp = formatTimestamp(memory.timestamp);

        // Find nearby hotspot
        let locationText = '';
        if (memory.location) {
            const nearbyHotspot = this.findNearbyHotspot(memory.location.lat, memory.location.lng);
            locationText = nearbyHotspot
                ? `<i class="fas fa-map-marker-alt"></i> ${nearbyHotspot.name}`
                : `<i class="fas fa-map-marker-alt"></i> ${memory.location.lat.toFixed(4)}, ${memory.location.lng.toFixed(4)}`;
        }

        if (memory.type === 'photo') {
            return `
            <div class="memory-card" data-id="${memory.id}">
                <img src="${memory.data}" alt="${memory.caption}">
                <div class="caption">${memory.caption}</div>
                ${locationText ? `<div class="location-tag">${locationText}</div>` : ''}
                <div class="timestamp">${timestamp}</div>
            </div>
        `;
        } else if (memory.type === 'audio') {
            return `
            <div class="memory-card" data-id="${memory.id}">
                <div class="audio-card">
                    <i class="fas fa-microphone"></i>
                    <p>${memory.caption}</p>
                </div>
                ${locationText ? `<div class="location-tag">${locationText}</div>` : ''}
                <div class="timestamp">${timestamp}</div>
            </div>
        `;
        } else if (memory.type === 'text') {
            return `
            <div class="memory-card" data-id="${memory.id}">
                <div class="text-card">
                    <i class="fas fa-sticky-note"></i>
                    <p>${memory.caption.substring(0, 50)}...</p>
                </div>
                ${locationText ? `<div class="location-tag">${locationText}</div>` : ''}
                <div class="timestamp">${timestamp}</div>
            </div>
        `;
        }
    }

    findNearbyHotspot(lat, lng, radius = 100) {
        if (!window.hotspotManager) return null;

        return hotspotManager.hotspots.find(hotspot => {
            const distance = calculateDistance(lat, lng, hotspot.lat, hotspot.lng);
            return distance <= radius;
        });
    }

    showMemoryDetail(memory) {
        //detail modal
        const detailHTML = `
            <div class="modal" id="memory-detail-modal">
                <div class="modal-content">
                    <button class="close-modal" onclick="memoryManager.closeDetailModal()">&times;</button>
                    <h2>${memory.caption}</h2>
                    ${this.getMemoryContent(memory)}
                    <p style="color: #64748b; margin-top: 16px;">${formatTimestamp(memory.timestamp)}</p>
                    ${memory.location ? `<p style="color: #64748b;">Location: ${memory.location.lat.toFixed(4)}, ${memory.location.lng.toFixed(4)}</p>` : ''}
                    <div style="display: flex; gap: 12px; margin-top: 20px;">
                        ${memory.location ? `<button class="save-btn" onclick="memoryManager.showOnMap(${memory.location.lat}, ${memory.location.lng})">
                            <i class="fas fa-map-marker-alt"></i> Show on Map
                        </button>` : ''}
                        <button class="retake-btn" onclick="memoryManager.deleteMemory(${memory.id}); memoryManager.closeDetailModal();">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', detailHTML);
    }

    getMemoryContent(memory) {
        if (memory.type === 'photo') {
            return `<img src="${memory.data}" style="width: 100%; border-radius: 12px; margin: 16px 0;">`;
        } else if (memory.type === 'audio') {
            return `<audio src="${memory.data}" controls style="width: 100%; margin: 16px 0;"></audio>`;
        } else if (memory.type === 'text') {
            return `<p style="white-space: pre-wrap; margin: 16px 0;">${memory.caption}</p>`;
        }
    }

    closeDetailModal() {
        const modal = document.getElementById('memory-detail-modal');
        if (modal) {
            modal.remove();
        }
        this.displayMemoriesInGallery();
    }

    showOnMap(lat, lng) {
        this.closeDetailModal();

        // Close storage modal
        const storageModal = document.getElementById('storage-modal');
        if (storageModal) {
            storageModal.classList.add('hidden');
        }

        // Fly to location on map
        if (window.mapManager) {
            mapManager.flyTo(lat, lng, 16);
        }
    }

    getTotalMemories() {
        return this.memories.length;
    }
}

// Create global instance
const memoryManager = new MemoryManager();