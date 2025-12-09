
class DeviceInfoManager {
    constructor() {
        this.deviceInfo = {};
        this.networkInfo = {};
        this.init();
    }

    init() {
        this.collectDeviceInfo();
        this.monitorNetworkInfo();
        this.setupEventListeners();
    }

    generateDeviceFingerprint() {
        const screen = window.screen;
        const nav = window.navigator;
        const fingerprint = {
            screenWidth: screen.width,
            screenHeight: screen.height,
            colorDepth: screen.colorDepth,
            pixelRatio: window.devicePixelRatio,
            platform: nav.platform,
            userAgent: nav.userAgent,
            language: nav.language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            touchPoints: nav.maxTouchPoints
        };

        const fingerprintStr = JSON.stringify(fingerprint);
        let hash = 0;
        for (let i = 0; i < fingerprintStr.length; i++) {
            const char = fingerprintStr.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    async collectDeviceInfo() {
        const nav = navigator;
        this.deviceInfo = {
            deviceId: this.generateDeviceFingerprint(),
            platform: nav.platform || 'Unknown',
            userAgent: nav.userAgent,
            language: nav.language || 'Unknown',
            languages: nav.languages ? nav.languages.join(', ') : 'Unknown',
            cookiesEnabled: nav.cookieEnabled,
            doNotTrack: nav.doNotTrack || 'Not set',
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            colorDepth: window.screen.colorDepth,
            pixelRatio: window.devicePixelRatio || 1,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            touchPoints: nav.maxTouchPoints || 0,
            online: nav.onLine,
            hardwareConcurrency: nav.hardwareConcurrency || 'Unknown',
            deviceMemory: nav.deviceMemory ? `${nav.deviceMemory} GB` : 'Unknown',
            maxTouchPoints: nav.maxTouchPoints || 0
        };

        // Save to local storage
        storage.setItem('deviceInfo', this.deviceInfo);

        // Log to Supabase
        await storage.logDeviceInfo(this.deviceInfo);
    }

    monitorNetworkInfo() {
        if ('connection' in navigator) {
            const connection = navigator.connection;
            this.updateNetworkInfo(connection);

            if (connection) {
                connection.addEventListener('change', () => {
                    this.updateNetworkInfo(connection);
                });
            }
        }
    }

    updateNetworkInfo(connection) {
        this.networkInfo = {
            type: connection.type || 'Unknown',
            effectiveType: connection.effectiveType || 'Unknown',
            downlink: connection.downlink ? `${connection.downlink} Mbps` : 'Unknown',
            downlinkMax: connection.downlinkMax ? `${connection.downlinkMax} Mbps` : 'Unknown',
            rtt: connection.rtt ? `${connection.rtt} ms` : 'Unknown',
            saveData: connection.saveData || false,
            online: navigator.onLine
        };

        this.updateDeviceInfoPanel();
    }

    updateDeviceInfoPanel() {
        const detailsDiv = document.getElementById('device-details');
        if (!detailsDiv) return;

        detailsDiv.innerHTML = `
            <h4>Device Information</h4>
            <p><strong>Device ID:</strong> <span>${this.deviceInfo.deviceId}</span></p>
            <p><strong>Platform:</strong> <span>${this.deviceInfo.platform}</span></p>
            <p><strong>Language:</strong> <span>${this.deviceInfo.language}</span></p>
            <p><strong>Screen:</strong> <span>${this.deviceInfo.screenWidth}x${this.deviceInfo.screenHeight}</span></p>
            <p><strong>Pixel Ratio:</strong> <span>${this.deviceInfo.pixelRatio}</span></p>
            <p><strong>Touch Points:</strong> <span>${this.deviceInfo.touchPoints}</span></p>
            <p><strong>CPU Cores:</strong> <span>${this.deviceInfo.hardwareConcurrency}</span></p>
            <p><strong>Memory:</strong> <span>${this.deviceInfo.deviceMemory}</span></p>
            <p><strong>Timezone:</strong> <span>${this.deviceInfo.timezone}</span></p>
            
            <h4 style="margin-top: 20px;">Network Information</h4>
            <p><strong>Status:</strong> <span class="${this.networkInfo.online ? 'online' : 'offline'}">${this.networkInfo.online ? 'Online' : 'Offline'}</span></p>
            <p><strong>Type:</strong> <span>${this.networkInfo.effectiveType}</span></p>
            <p><strong>Downlink:</strong> <span>${this.networkInfo.downlink}</span></p>
            <p><strong>RTT:</strong> <span>${this.networkInfo.rtt}</span></p>
            <p><strong>Data Saver:</strong> <span>${this.networkInfo.saveData ? 'Enabled' : 'Disabled'}</span></p>
        `;
    }

    setupEventListeners() {
        const deviceInfoBtn = document.getElementById('device-info-btn');
        const deviceInfoPanel = document.getElementById('device-info-panel');
        const closePanel = deviceInfoPanel?.querySelector('.close-panel');

        if (deviceInfoBtn && deviceInfoPanel) {
            deviceInfoBtn.addEventListener('click', () => {
                deviceInfoPanel.classList.toggle('hidden');
                this.updateDeviceInfoPanel();
            });

            closePanel?.addEventListener('click', () => {
                deviceInfoPanel.classList.add('hidden');
            });
        }

        window.addEventListener('online', () => {
            this.networkInfo.online = true;
            this.updateDeviceInfoPanel();
            showNotification('Back online');
        });

        window.addEventListener('offline', () => {
            this.networkInfo.online = false;
            this.updateDeviceInfoPanel();
            showNotification('You are offline', 5000);
        });
    }

    getDeviceInfo() {
        return this.deviceInfo;
    }

    getNetworkInfo() {
        return this.networkInfo;
    }
}

const deviceInfoManager = new DeviceInfoManager();