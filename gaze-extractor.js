class GazeDataExtractor {
    constructor() {
        this.isTracking = false;
        this.gazeData = [];
        this.allGazeData = []; 
        this.startTime = null;
        this.sessionTimeInterval = null;
        this.gazePoint = null;
        this.port = null; 
        
        this.initializeElements();
        this.setupEventListeners();
        this.setupGazeFilterListener();
    }
    
    initializeElements() {
        this.startBtn = document.getElementById('startTracking');
        this.stopBtn = document.getElementById('stopTracking');
        this.clearBtn = document.getElementById('clearData');
        this.exportBtn = document.getElementById('exportData');
        this.exportGazeFilterBtn = document.getElementById('exportGazeFilter');
        this.showStatsBtn = document.getElementById('showStats');
        this.openGazeFilterBtn = document.getElementById('openGazeFilter');
        
        this.status = document.getElementById('status');
        this.currentCoords = document.getElementById('currentCoords');
        this.accuracy = document.getElementById('accuracy');
        this.totalPoints = document.getElementById('totalPoints');
        this.gazeFilterPoints = document.getElementById('gazeFilterPoints');
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
        this.exportGazeFilterBtn.addEventListener('click', () => this.downloadGazeFilterData());
        this.showStatsBtn.addEventListener('click', () => this.showStats());
        this.openGazeFilterBtn.addEventListener('click', () => this.openGazeFilter());
        
        window.addEventListener('message', (event) => {
            if (event.origin === 'https://gazefilter.app') {
                this.handleGazeFilterMessage(event.data);
            }
        });
    }
    
    setupGazeFilterListener() {
        window.addEventListener('message', (event) => {
            if (event.origin !== 'https://gazefilter.app') return;

            if (event.data.type === 'channel') {
                if (this.port !== null) this.port.close();
                this.port = event.ports[0];
                this.port.onmessage = (msg) => this.handleGazeFilterMessage(msg);
                this.logMessage('Канал GazeFilter встановлено');
            }
        });
    }
    
    handleGazeFilterMessage(event) {
        const data = event.data;

        // Зберігаємо ВСІ повідомлення від GazeFilter
        this.allGazeData.push(data);
        
        switch (data.type) {
            case 'capture':
                if (this.isTracking) {
                    this.processGazeData(data.x, data.y, data.confidence || 85);
                }
                break;

            case 'connect':
                console.log('GazeFilter підключено:', data.deviceLabel);
                this.logMessage(`GazeFilter підключено: ${data.deviceLabel}`);
                break;

            case 'dispose':
                console.log('GazeFilter відключено від камери');
                this.logMessage('GazeFilter відключено від камери');
                break;
                
            case 'calibration':
                console.log('Калібровка GazeFilter:', data);
                this.logMessage(`Калібровка: ${JSON.stringify(data)}`);
                break;
                
            case 'error':
                console.error('Помилка GazeFilter:', data);
                this.logMessage(`Помилка: ${data.message || JSON.stringify(data)}`);
                break;
                
            default:
                console.log('Невідомий тип повідомлення GazeFilter:', data);
                this.logMessage(`Невідомий тип ${data.type}: ${JSON.stringify(data)}`);
                break;
        }
    }
    
    async startTracking() {
        try {
            this.status.textContent = 'Ініціалізація відстеження погляду...';
            
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
                        this.processGazeData(data.x, data.y, 85); 
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

        this.currentCoords.innerHTML = `
            X: ${Math.round(x)}<br>
            Y: ${Math.round(y)}
        `;
        
        this.accuracy.textContent = Math.round(accuracy);
        this.totalPoints.textContent = this.gazeData.length;
        this.gazeFilterPoints.textContent = this.allGazeData.length;
        
        const avgAcc = this.gazeData.reduce((sum, point) => sum + point.accuracy, 0) / this.gazeData.length;
        this.avgAccuracy.textContent = Math.round(avgAcc);
        
        this.updateGazePoint(x, y);
        
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
        
        if (this.dataLog.children.length > 50) {
            this.dataLog.removeChild(this.dataLog.firstChild);
        }
    }
    
    clearData() {
        this.gazeData = [];
        this.allGazeData = [];
        this.currentCoords.innerHTML = 'X: --<br>Y: --';
        this.accuracy.textContent = '--';
        this.totalPoints.textContent = '0';
        this.gazeFilterPoints.textContent = '0';
        this.avgAccuracy.textContent = '0';
        this.dataLog.innerHTML = '';
        
        this.logMessage('Всі дані очищено');
    }
    
    exportData() {
        if (this.allGazeData.length === 0 && this.gazeData.length === 0) {
            alert('Немає даних для експорту');
            return;
        }
        
        const exportData = {
            sessionInfo: {
                startTime: this.startTime,
                endTime: new Date(),
                totalGazeFilterPoints: this.allGazeData.length,
                totalWebGazerPoints: this.gazeData.length,
                averageAccuracy: this.gazeData.length > 0 ? 
                    this.gazeData.reduce((sum, point) => sum + point.accuracy, 0) / this.gazeData.length : 0
            },
            gazeFilterData: this.allGazeData,
            webGazerData: this.gazeData
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `gaze-data-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        link.click();
        
        this.logMessage(`Експортовано ${this.allGazeData.length} точок GazeFilter та ${this.gazeData.length} точок WebGazer`);
    }

    downloadGazeFilterData() {
        if (this.allGazeData.length === 0) {
            alert('Немає даних GazeFilter для експорту');
            return;
        }
        
        const dataStr = JSON.stringify(this.allGazeData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `gazefilter-all-data-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        link.click();
        
        this.logMessage(`Експортовано ${this.allGazeData.length} повідомлень GazeFilter`);
    }
    
    // Функція для отримання даних за типом
    getGazeFilterDataByType(type) {
        return this.allGazeData.filter(data => data.type === type);
    }
    
    // Функція для отримання статистики по типах
    getGazeFilterStats() {
        const stats = {};
        this.allGazeData.forEach(data => {
            stats[data.type] = (stats[data.type] || 0) + 1;
        });
        return stats;
    }
    
    showStats() {
        if (this.allGazeData.length === 0) {
            alert('Немає даних для показу статистики');
            return;
        }
        
        const stats = this.getGazeFilterStats();
        let statsText = '📊 Статистика GazeFilter:\n\n';
        
        Object.entries(stats).forEach(([type, count]) => {
            statsText += `${type}: ${count} повідомлень\n`;
        });
        
        statsText += `\nЗагалом: ${this.allGazeData.length} повідомлень`;
        
        // Показуємо приклади кожного типу
        statsText += '\n\n📋 Приклади даних:\n';
        Object.keys(stats).forEach(type => {
            const example = this.allGazeData.find(data => data.type === type);
            if (example) {
                statsText += `\n${type}:\n${JSON.stringify(example, null, 2)}\n`;
            }
        });
        
        console.log(statsText);
        this.logMessage(`Статистика: ${Object.keys(stats).length} типів повідомлень`);
        
        // Показуємо в alert для швидкого перегляду
        alert(statsText);
    }
    
    openGazeFilter() {
      
        const newWindow = window.open('https://gazefilter.app/', 'gazefilter', 'width=1200,height=800');
        
        if (newWindow) {
          
            const messageListener = (event) => {
                if (event.origin === 'https://gazefilter.app') {
                    this.handleGazeFilterMessage(event.data);
                }
            };
            
            window.addEventListener('message', messageListener);
            
           
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
                 
                }
            }, 100);
            
            this.logMessage('GazeFilter відкрито в новому вікні');
        } else {
            alert('Не вдалося відкрити GazeFilter. Перевірте блокування спливаючих вікон.');
        }
    }
}


document.addEventListener('DOMContentLoaded', () => {
    const extractor = new GazeDataExtractor();
    
   
    window.gazeExtractor = extractor;
    
    console.log('GazeFilter Data Extractor готовий до роботи!');
    console.log('Доступні методи:');
    console.log('- window.gazeExtractor.startTracking()');
    console.log('- window.gazeExtractor.stopTracking()');
    console.log('- window.gazeExtractor.exportData()');
    console.log('- window.gazeExtractor.downloadGazeFilterData()');
    console.log('- window.gazeExtractor.showStats()');
    console.log('- window.gazeExtractor.clearData()');
    console.log('- window.gazeExtractor.allGazeData (масив ВСІХ даних GazeFilter)');
    console.log('- window.gazeExtractor.getGazeFilterDataByType(type)');
    console.log('- window.gazeExtractor.getGazeFilterStats()');
});
