class GazeDataExtractor {
    constructor() {
        this.isTracking = false;
        this.gazeData = [];
        this.startTime = null;
        this.sessionTimeInterval = null;
        this.gazePoint = null;
        
        this.initializeElements();
        this.setupEventListeners();
        this.setupPostMessageListener();
    }
    
    initializeElements() {
        this.startBtn = document.getElementById('startTracking');
        this.stopBtn = document.getElementById('stopTracking');
        this.clearBtn = document.getElementById('clearData');
        this.exportBtn = document.getElementById('exportData');
        this.openGazeFilterBtn = document.getElementById('openGazeFilter');
        
        this.status = document.getElementById('status');
        this.currentCoords = document.getElementById('currentCoords');
        this.accuracy = document.getElementById('accuracy');
        this.totalPoints = document.getElementById('totalPoints');
        this.avgAccuracy = document.getElementById('avgAccuracy');
        this.sessionTime = document.getElementById('sessionTime');
        this.dataLog = document.getElementById('dataLog');
        this.gazefilterFrame = document.getElementById('gazefilterFrame');
    }
    
    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.startTracking());
        this.stopBtn.addEventListener('click', () => this.stopTracking());
        this.clearBtn.addEventListener('click', () => this.clearData());
        this.exportBtn.addEventListener('click', () => this.exportData());
        this.openGazeFilterBtn.addEventListener('click', () => this.openGazeFilter());
        
        // Обробка повідомлень від GazeFilter iframe
        window.addEventListener('message', (event) => {
            if (event.origin === 'https://gazefilter.app') {
                this.handleGazeFilterMessage(event.data);
            }
        });
    }
    
    setupPostMessageListener() {
        // Відправляємо запит на отримання даних до GazeFilter
        setInterval(() => {
            if (this.isTracking && this.gazefilterFrame.contentWindow) {
                try {
                    this.gazefilterFrame.contentWindow.postMessage({
                        type: 'REQUEST_GAZE_DATA'
                    }, 'https://gazefilter.app');
                } catch (e) {
                    // Ігноруємо помилки CORS
                }
            }
        }, 100); // Запитуємо дані кожні 100мс
    }
    
    handleGazeFilterMessage(data) {
        if (data.type === 'GAZE_DATA' && this.isTracking) {
            this.processGazeData(data.x, data.y, data.accuracy);
        }
    }
    
    async startTracking() {
        try {
            this.status.textContent = 'Ініціалізація відстеження погляду...';
            
            // Спробуємо використати WebGazer як резервний варіант
            if (typeof webgazer !== 'undefined') {
                await this.initializeWebGazer();
            }
            
            this.isTracking = true;
            this.startTime = new Date();
            this.gazeData = [];
            
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            
            this.status.textContent = 'Відстеження активне! Дивіться на екран.';
            this.status.style.background = 'rgba(46, 204, 113, 0.3)';
            
            this.startSessionTimer();
            this.createGazePoint();
            
            this.logMessage('Відстеження погляду розпочато');
            
        } catch (error) {
            console.error('Помилка ініціалізації:', error);
            this.status.textContent = 'Помилка ініціалізації. Перевірте дозволи камери.';
            this.status.style.background = 'rgba(231, 76, 60, 0.3)';
        }
    }
    
    async initializeWebGazer() {
        return new Promise((resolve, reject) => {
            try {
                webgazer.setGazeListener((data, elapsedTime) => {
                    if (data && this.isTracking) {
                        this.processGazeData(data.x, data.y, 85); // WebGazer не надає точність
                    }
                }).begin().then(() => {
                    console.log('WebGazer ініціалізовано');
                    resolve();
                }).catch(reject);
            } catch (error) {
                reject(error);
            }
        });
    }
    
    stopTracking() {
        this.isTracking = false;
        
        if (typeof webgazer !== 'undefined') {
            webgazer.pause();
        }
        
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        
        this.status.textContent = 'Відстеження зупинено';
        this.status.style.background = 'rgba(52, 73, 94, 0.3)';
        
        this.stopSessionTimer();
        this.removeGazePoint();
        
        this.logMessage(`Відстеження зупинено. Зібрано ${this.gazeData.length} точок`);
    }
    
    processGazeData(x, y, accuracy = 85) {
        const timestamp = new Date().toISOString();
        const gazePoint = { x, y, accuracy, timestamp };
        
        this.gazeData.push(gazePoint);
        
        // Оновлюємо UI
        this.currentCoords.innerHTML = `
            X: ${Math.round(x)}<br>
            Y: ${Math.round(y)}
        `;
        
        this.accuracy.textContent = Math.round(accuracy);
        this.totalPoints.textContent = this.gazeData.length;
        
        // Розраховуємо середню точність
        const avgAcc = this.gazeData.reduce((sum, point) => sum + point.accuracy, 0) / this.gazeData.length;
        this.avgAccuracy.textContent = Math.round(avgAcc);
        
        // Оновлюємо позицію gaze point
        this.updateGazePoint(x, y);
        
        // Додаємо до логу кожні 10 точок
        if (this.gazeData.length % 10 === 0) {
            this.logMessage(`Точка ${this.gazeData.length}: (${Math.round(x)}, ${Math.round(y)}) - ${Math.round(accuracy)}%`);
        }
    }
    
    createGazePoint() {
        this.gazePoint = document.createElement('div');
        this.gazePoint.className = 'gaze-point';
        this.gazePoint.style.display = 'none';
        document.body.appendChild(this.gazePoint);
    }
    
    updateGazePoint(x, y) {
        if (this.gazePoint) {
            this.gazePoint.style.left = x + 'px';
            this.gazePoint.style.top = y + 'px';
            this.gazePoint.style.display = 'block';
        }
    }
    
    removeGazePoint() {
        if (this.gazePoint) {
            this.gazePoint.remove();
            this.gazePoint = null;
        }
    }
    
    startSessionTimer() {
        this.sessionTimeInterval = setInterval(() => {
            const elapsed = Math.floor((new Date() - this.startTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            this.sessionTime.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }
    
    stopSessionTimer() {
        if (this.sessionTimeInterval) {
            clearInterval(this.sessionTimeInterval);
            this.sessionTimeInterval = null;
        }
    }
    
    logMessage(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        logEntry.textContent = `[${timestamp}] ${message}`;
        
        this.dataLog.appendChild(logEntry);
        this.dataLog.scrollTop = this.dataLog.scrollHeight;
        
        // Обмежуємо кількість записів у лозі
        if (this.dataLog.children.length > 50) {
            this.dataLog.removeChild(this.dataLog.firstChild);
        }
    }
    
    clearData() {
        this.gazeData = [];
        this.currentCoords.innerHTML = 'X: --<br>Y: --';
        this.accuracy.textContent = '--';
        this.totalPoints.textContent = '0';
        this.avgAccuracy.textContent = '0';
        this.dataLog.innerHTML = '';
        
        this.logMessage('Дані очищено');
    }
    
    exportData() {
        if (this.gazeData.length === 0) {
            alert('Немає даних для експорту');
            return;
        }
        
        const exportData = {
            sessionInfo: {
                startTime: this.startTime,
                endTime: new Date(),
                totalPoints: this.gazeData.length,
                averageAccuracy: this.gazeData.reduce((sum, point) => sum + point.accuracy, 0) / this.gazeData.length
            },
            gazeData: this.gazeData
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `gaze-data-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        link.click();
        
        this.logMessage(`Експортовано ${this.gazeData.length} точок`);
    }
    
    openGazeFilter() {
        // Відкриваємо GazeFilter в новому вікні для кращої інтеграції
        const newWindow = window.open('https://gazefilter.app/', 'gazefilter', 'width=1200,height=800');
        
        if (newWindow) {
            // Налаштовуємо комунікацію з новим вікном
            const messageListener = (event) => {
                if (event.origin === 'https://gazefilter.app') {
                    this.handleGazeFilterMessage(event.data);
                }
            };
            
            window.addEventListener('message', messageListener);
            
            // Відправляємо запити на дані до нового вікна
            const requestInterval = setInterval(() => {
                if (newWindow.closed) {
                    clearInterval(requestInterval);
                    window.removeEventListener('message', messageListener);
                    return;
                }
                
                try {
                    newWindow.postMessage({
                        type: 'REQUEST_GAZE_DATA'
                    }, 'https://gazefilter.app');
                } catch (e) {
                    // Ігноруємо помилки
                }
            }, 100);
            
            this.logMessage('GazeFilter відкрито в новому вікні');
        } else {
            alert('Не вдалося відкрити GazeFilter. Перевірте блокування спливаючих вікон.');
        }
    }
}

// Ініціалізація після завантаження сторінки
document.addEventListener('DOMContentLoaded', () => {
    const extractor = new GazeDataExtractor();
    
    // Додаткові утиліти для аналізу даних
    window.gazeExtractor = extractor;
    
    console.log('GazeFilter Data Extractor готовий до роботи!');
    console.log('Доступні методи: window.gazeExtractor.startTracking(), stopTracking(), exportData()');
});
