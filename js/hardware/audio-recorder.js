// Audio Recorder Manager
class AudioRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.stream = null;
        this.recordingStartTime = null;
        this.timerInterval = null;
        this.audioContext = null;
        this.analyser = null;
        this.animationId = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        const startBtn = document.getElementById('start-recording-btn');
        const stopBtn = document.getElementById('stop-recording-btn');
        const saveBtn = document.getElementById('save-audio-btn');

        startBtn?.addEventListener('click', () => this.startRecording());
        stopBtn?.addEventListener('click', () => this.stopRecording());
        saveBtn?.addEventListener('click', () => this.saveRecording());
    }

    async startRecording() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            this.mediaRecorder = new MediaRecorder(this.stream);
            this.audioChunks = [];

            this.mediaRecorder.addEventListener('dataavailable', (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            });

            this.mediaRecorder.addEventListener('stop', () => {
                this.handleRecordingStop();
            });

            this.mediaRecorder.start();
            this.recordingStartTime = Date.now();

            // Update UI
            document.getElementById('start-recording-btn').classList.add('hidden');
            document.getElementById('stop-recording-btn').classList.remove('hidden');

            // Start timer
            this.startTimer();

            // Start visualization
            this.startVisualization();

            showNotification('Recording started');

        } catch (error) {
            console.error('Microphone error:', error);
            
            if (error.name === 'NotAllowedError') {
                showNotification('Microphone access denied', 3000);
            } else {
                showNotification('Microphone error: ' + error.message, 3000);
            }
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            this.stopTimer();
            this.stopVisualization();

            // Stop all tracks
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
            }

            showNotification('Recording stopped');
        }
    }

    handleRecordingStop() {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);

        // Show preview
        const audioPreview = document.getElementById('audio-preview');
        const recordedAudio = document.getElementById('recorded-audio');

        if (audioPreview && recordedAudio) {
            recordedAudio.src = audioUrl;
            audioPreview.classList.remove('hidden');
        }

        // Update UI
        document.getElementById('start-recording-btn').classList.remove('hidden');
        document.getElementById('stop-recording-btn').classList.add('hidden');

        // Store blob for saving
        this.currentAudioBlob = audioBlob;
    }

    startTimer() {
        const timerElement = document.getElementById('recording-time');
        if (!timerElement) return;

        this.timerInterval = setInterval(() => {
            const elapsed = Date.now() - this.recordingStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            
            timerElement.textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 100);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    startVisualization() {
        const canvas = document.getElementById('audio-visualizer');
        if (!canvas) return;

        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        const microphone = this.audioContext.createMediaStreamSource(this.stream);

        microphone.connect(this.analyser);
        this.analyser.fftSize = 256;

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const canvasCtx = canvas.getContext('2d');

        const draw = () => {
            this.animationId = requestAnimationFrame(draw);

            this.analyser.getByteFrequencyData(dataArray);

            canvasCtx.fillStyle = 'rgb(0, 0, 0)';
            canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                barHeight = dataArray[i] / 2;

                const red = barHeight + 100;
                const green = 50;
                const blue = 50;

                canvasCtx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
                canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

                x += barWidth + 1;
            }
        };

        draw();
    }

    stopVisualization() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }

    async saveRecording() {
    if (!this.currentAudioBlob) return;

    const caption = document.getElementById('audio-caption').value || 'Voice Note';
    const position = gpsTracker.currentPosition;

    // Convert blob to base64
    const reader = new FileReader();
    reader.readAsDataURL(this.currentAudioBlob);

    reader.onloadend = async () => {
        const audioData = reader.result;

        const memory = {
            type: 'audio',
            data: audioData,
            caption: caption,
            location: position ? {
                lat: position.lat,
                lng: position.lng
            } : null,
            duration: this.getRecordingDuration(),
            timestamp: Date.now()
        };

        try {
            const id = await storage.saveMemory(memory);
            memory.id = id;
            
            showNotification('Audio saved!');

            // Close modal and reset
            this.closeModal();

            // Update map
            if (window.mapManager && window.mapManager.isInitialized && position) {
                window.mapManager.addMemoryMarker(memory);
            }

            // Update stats
            statsTracker.incrementMemories();

        } catch (error) {
            console.error('Error saving audio:', error);
            showNotification('Failed to save audio', 3000);
        }
    };
}

    getRecordingDuration() {
        if (!this.recordingStartTime) return 0;
        return Date.now() - this.recordingStartTime;
    }

    closeModal() {
        const modal = document.getElementById('audio-modal');
        if (modal) {
            modal.classList.add('hidden');
        }

        // Reset
        this.currentAudioBlob = null;
        document.getElementById('audio-caption').value = '';
        document.getElementById('recording-time').textContent = '00:00';
        
        const audioPreview = document.getElementById('audio-preview');
        if (audioPreview) {
            audioPreview.classList.add('hidden');
        }
    }
}

// Create global instance
const audioRecorder = new AudioRecorder();