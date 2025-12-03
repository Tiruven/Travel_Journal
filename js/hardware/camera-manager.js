// Camera Manager
class CameraManager {
    constructor() {
        this.stream = null;
        this.currentFacingMode = 'environment';
        this.videoElement = null;
        this.canvasElement = null;
        this.capturedImage = null;
        this.init();
    }

    init() {
        this.videoElement = document.getElementById('camera-preview');
        this.canvasElement = document.getElementById('photo-canvas');
        this.setupEventListeners();
    }

    setupEventListeners() {
        const captureBtn = document.getElementById('capture-btn');
        const switchCameraBtn = document.getElementById('switch-camera-btn');
        const savePhotoBtn = document.getElementById('save-photo-btn');
        const retakeBtn = document.getElementById('retake-btn');

        captureBtn?.addEventListener('click', () => this.capturePhoto());
        switchCameraBtn?.addEventListener('click', () => this.switchCamera());
        savePhotoBtn?.addEventListener('click', () => this.savePhoto());
        retakeBtn?.addEventListener('click', () => this.retakePhoto());
    }

    async startCamera() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: this.currentFacingMode,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });

            if (this.videoElement) {
                this.videoElement.srcObject = this.stream;
                await this.videoElement.play();
            }

            return true;
        } catch (error) {
            console.error('Camera error:', error);
            
            if (error.name === 'NotAllowedError') {
                showNotification('Camera access denied', 3000);
            } else if (error.name === 'NotFoundError') {
                showNotification('No camera found', 3000);
            } else {
                showNotification('Camera error: ' + error.message, 3000);
            }
            
            return false;
        }
    }

    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
            
            if (this.videoElement) {
                this.videoElement.srcObject = null;
            }
        }
    }

    capturePhoto() {
        if (!this.videoElement || !this.canvasElement) return;

        const context = this.canvasElement.getContext('2d');
        
        // Set canvas size to video size
        this.canvasElement.width = this.videoElement.videoWidth;
        this.canvasElement.height = this.videoElement.videoHeight;

        // Draw video frame to canvas
        context.drawImage(
            this.videoElement, 
            0, 0, 
            this.canvasElement.width, 
            this.canvasElement.height
        );

        // Add location and date stamp
        this.addPhotoStamp(context);

        // Get image data
        this.capturedImage = this.canvasElement.toDataURL('image/jpeg', 0.9);

        // Show preview
        this.showPhotoPreview();
    }

    addPhotoStamp(context) {
        const position = gpsTracker.currentPosition;
        const date = new Date();
        
        // Add semi-transparent background
        context.fillStyle = 'rgba(0, 0, 0, 0.6)';
        context.fillRect(10, this.canvasElement.height - 70, 300, 60);
        
        // Add text
        context.fillStyle = 'white';
        context.font = 'bold 14px Arial';
        
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        context.fillText(dateStr, 20, this.canvasElement.height - 45);
        
        if (position) {
            const locationStr = `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}`;
            context.fillText(locationStr, 20, this.canvasElement.height - 25);
        }
    }

    showPhotoPreview() {
        // Hide video, show preview
        this.videoElement.style.display = 'none';
        document.querySelector('.camera-controls').style.display = 'none';
        
        const photoPreview = document.getElementById('photo-preview');
        const capturedImage = document.getElementById('captured-image');
        
        if (photoPreview && capturedImage) {
            capturedImage.src = this.capturedImage;
            photoPreview.classList.remove('hidden');
        }
    }

    retakePhoto() {
        this.capturedImage = null;
        
        // Show video, hide preview
        this.videoElement.style.display = 'block';
        document.querySelector('.camera-controls').style.display = 'flex';
        
        const photoPreview = document.getElementById('photo-preview');
        if (photoPreview) {
            photoPreview.classList.add('hidden');
        }
    }

    async savePhoto() {
        if (!this.capturedImage) return;

        const caption = document.getElementById('photo-caption').value || 'Untitled';
        const position = gpsTracker.currentPosition;

        // Compress image
        const compressedImage = await compressImage(this.capturedImage, 1280, 0.8);

        const memory = {
            type: 'photo',
            data: compressedImage,
            caption: caption,
            location: position ? {
                lat: position.lat,
                lng: position.lng
            } : null,
            timestamp: Date.now()
        };

        try {
            const id = await storage.saveMemory(memory);
            memory.id = id;
            
            showNotification('Photo saved!');
            
            // Close modal and reset
            this.closeModal();
            this.retakePhoto();
            
            // Update map with new memory (check if mapManager exists)
            if (window.mapManager && window.mapManager.isInitialized && position) {
                window.mapManager.addMemoryMarker(memory);
            }

            // Update stats
            statsTracker.incrementMemories();
            
        } catch (error) {
            console.error('Error saving photo:', error);
            showNotification('Failed to save photo', 3000);
        }
    }

    async switchCamera() {
        this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
        
        this.stopCamera();
        await this.startCamera();
    }

    closeModal() {
        const modal = document.getElementById('camera-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
        this.stopCamera();
    }
}

// Create global instance
const cameraManager = new CameraManager();