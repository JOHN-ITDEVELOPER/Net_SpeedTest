document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const startTestBtn = document.getElementById('startTest');
    const resetTestBtn = document.getElementById('resetTest');
    const speedResult = document.getElementById('speedResult');
    const progressPercentage = document.getElementById('progressPercentage');
    const liveSpeedDisplay = document.querySelector('.speed-display');
    const finalSummaryDisplay = document.querySelector('.final-speed-summary');
    const summaryDownloadSpeed = document.getElementById('summaryDownloadSpeed');
    const summaryUploadSpeed = document.getElementById('summaryUploadSpeed');
    const speedLabel = document.querySelector('.speed-label'); // This line is correct, but was missing in your file.
    const progressFill = document.getElementById('progressFill');
    const fileSize = document.getElementById('fileSize');
    const timeElapsed = document.getElementById('timeElapsed');
    const testStatus = document.getElementById('testStatus');
    const finalSpeed = document.getElementById('finalSpeed');
    const finalUploadSpeed = document.getElementById('finalUploadSpeed'); // Assuming you add this element to your HTML
    const totalTime = document.getElementById('totalTime');
    const dataTransferred = document.getElementById('dataTransferred');
    const testDate = document.getElementById('testDate');
    const connectionStatus = document.querySelector('.connection-status span');
    const connectionIcon = document.querySelector('.connection-status i');
    
    // Test variables
    let testInProgress = false;
    let testStage = ''; // 'download' or 'upload'
    let startTime;
    let endTime;
    let fileSizeBytes = 0;
    let totalBytesLoaded = 0;
    // Variables for smoothed speed calculation
    let lastProgressTime = 0;
    let lastLoadedBytes = 0;
    let smoothedSpeed = 0;
    const SMOOTHING_FACTOR = 0.2; // Adjust between 0 and 1. Lower is smoother.

    let xhr = null;
    
    // List of reliable public test files (CORS-enabled first)
    // Using Cloudflare's speed test files as they have open CORS policies.
    const TEST_FILE_URLS = [
        'https://speed.cloudflare.com/__down?bytes=10000000',  // 10MB
        'https://speed.cloudflare.com/__down?bytes=25000000',  // 25MB
        'https://speed.cloudflare.com/__down?bytes=50000000',  // 50MB
        'https://speed.cloudflare.com/__down?bytes=100000000' // 100MB
    ];

    // Upload test endpoint
    const UPLOAD_URL = 'https://speed.cloudflare.com/__up';
    
    // Initialize the app
    function initApp() {
        // Set current date
        updateTestDate();
        
        // Event listeners
        startTestBtn.addEventListener('click', startSpeedTest);
        resetTestBtn.addEventListener('click', resetTest);
        
        // Update connection status
        updateConnectionStatus();
    }
    
    // Update test date display
    function updateTestDate() {
        const now = new Date();
        const options = { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        testDate.textContent = now.toLocaleDateString('en-US', options);
    }
    
    // Update connection status display
    function updateConnectionStatus() {
        if (navigator.onLine) {
            connectionStatus.textContent = 'Online';
            connectionIcon.className = 'fas fa-wifi';
            connectionIcon.style.color = '#4CAF50';
        } else {
            connectionStatus.textContent = 'Offline';
            connectionIcon.className = 'fas fa-wifi-slash';
            connectionIcon.style.color = '#f44336';
        }
    }
    
    // Start the speed test
    function startSpeedTest() {
        if (testInProgress) {
            alert('Test already in progress! Please wait for it to complete.');
            return;
        }

        if (!navigator.onLine) {
            alert('You are offline. Please check your internet connection and try again.');
            return;
        }

        // Reset previous test data
        resetTest();
        
        // Update UI for test in progress
        testInProgress = true;
        updateUI('testing');

        lastProgressTime = 0;
        lastLoadedBytes = 0;
        smoothedSpeed = 0;
        
        // Record start time
        startTime = new Date().getTime();
        testStage = 'download';
        
        // Start file download
        downloadTestFile();
    }
    
    // Download the test file and measure speed
    function downloadTestFile() {
        xhr = new XMLHttpRequest();
        let currentUrlIndex = 0;
        let fileUrl = TEST_FILE_URLS[currentUrlIndex];

        function tryNextUrl(corsError = false) {
            currentUrlIndex++;
            if (currentUrlIndex < TEST_FILE_URLS.length) {
                fileUrl = TEST_FILE_URLS[currentUrlIndex];
                updateUI('testing', { statusText: `Trying server ${currentUrlIndex + 1}...` });
                xhr.open('GET', fileUrl, true);
                xhr.responseType = 'blob';
                xhr.timeout = 30000;
                xhr.send();
            } else {
                let errorMsg = 'All test servers are currently unavailable. Please try again later.';
                if (corsError) {
                    errorMsg += ' (Likely due to CORS restrictions. Try running this test from a public website or use a CORS-enabled test file.)';
                }
                completeTest(false, 'download', errorMsg);
            }
        }

        xhr.open('GET', fileUrl, true);
        xhr.responseType = 'blob';
        xhr.timeout = 30000;

        xhr.addEventListener('progress', function(event) {
            if (event.lengthComputable) {
                // Update progress
                const percentComplete = (event.loaded / event.total) * 100;
                updateUI('progress', { percent: percentComplete, loaded: event.loaded, total: event.total });
                
                // --- Smoothed Real-time Speed Calculation ---
                const currentTime = new Date().getTime();
                if (lastProgressTime > 0) {
                    const timeDiff = (currentTime - lastProgressTime) / 1000; // seconds
                    const bytesDiff = event.loaded - lastLoadedBytes;

                    // Only calculate if enough time has passed and data was transferred
                    if (timeDiff > 0.1 && bytesDiff > 0) {
                        const instantSpeed = ((bytesDiff * 8) / timeDiff) / 1000000; // Mbps
                        // Apply Exponential Moving Average (EMA) for smoothing
                        smoothedSpeed = (instantSpeed * SMOOTHING_FACTOR) + (smoothedSpeed * (1 - SMOOTHING_FACTOR));
                    }

                    // Update speed display with animation
                    updateUI('speedUpdate', { speed: smoothedSpeed });
                }
                lastProgressTime = currentTime;
                lastLoadedBytes = event.loaded;
            }
        });
        
        xhr.addEventListener('load', function() {
            if (xhr.status === 200) {
                endTime = new Date().getTime();
                // The Cloudflare endpoint doesn't send Content-Length, so we get the size from the response blob.
                if (fileSizeBytes === 0 && xhr.response && xhr.response.size > 0) {
                    fileSizeBytes = xhr.response.size;
                }
                completeTest(true, 'download');
            } else {
                // CORS error likely if status is 0 or 206
                tryNextUrl(xhr.status === 0 || xhr.status === 206);
            }
        });
        
        xhr.addEventListener('error', function() {
            // CORS error likely if status is 0
            tryNextUrl(xhr.status === 0);
        });
        
        xhr.addEventListener('timeout', function() {
            tryNextUrl();
        });
        
        xhr.send();
    }

    // Start the upload test
    async function startUploadTest() {
        updateUI('testing', { statusText: 'Testing Upload...', fileSizeText: '5 MB', speedLabelText: 'Upload Speed' }); // This line correctly sets the label for the upload test.

        startTime = new Date().getTime();
        testStage = 'upload';

        // Generate data to upload (5MB of random data)
        fileSizeBytes = 5 * 1024 * 1024;
        const data = new Blob([new ArrayBuffer(fileSizeBytes)], { type: 'application/octet-stream' });

        // Note: We cannot track upload progress with fetch in no-cors mode.
        // We will show a generic "uploading" state.
        const interval = setInterval(() => {
            const timeDiff = (new Date().getTime() - startTime) / 1000;
            updateUI('progress', { elapsed: timeDiff });
        }, 100);

        try {
            await fetch(UPLOAD_URL, { method: 'POST', body: data, mode: 'no-cors' });
            endTime = new Date().getTime();
            clearInterval(interval);
            completeTest(true, 'upload');
        } catch (error) {
            clearInterval(interval);
            completeTest(false, 'upload', `An error occurred during the upload test: ${error.message}`);
        }
    }
    
    // Override the completeTest function to handle async startUploadTest
    const originalCompleteTest = completeTest;
    completeTest = function(success, testType, errorMessage = '') {
        originalCompleteTest(success, testType, errorMessage);
    }
    
    // Complete the test
    function completeTest(success, testType, errorMessage = '') {
        if (success) {
            const timeTaken = (endTime - startTime) / 1000; // in seconds
            const speedMbps = ((fileSizeBytes * 8) / timeTaken) / 1000000;

            if (testType === 'download') {
                // Update download results
                const downloadSpeedText = `${speedMbps.toFixed(2)} Mbps`;
                if (finalSpeed) finalSpeed.textContent = downloadSpeedText;
                if (summaryDownloadSpeed) summaryDownloadSpeed.textContent = downloadSpeedText;
                console.log(`Download Test Complete: ${speedMbps.toFixed(2)} Mbps`);

                // Start the upload test
                setTimeout(startUploadTest, 1000); // Brief pause before starting upload

            } else if (testType === 'upload') {
                // Update upload results
                const uploadSpeedText = `${speedMbps.toFixed(2)} Mbps`;
                if (finalUploadSpeed) finalUploadSpeed.textContent = uploadSpeedText;
                if (summaryUploadSpeed) summaryUploadSpeed.textContent = uploadSpeedText;

                speedResult.textContent = speedMbps.toFixed(2);

                // Finalize UI
                testInProgress = false;
                updateUI('complete', { finalTime: timeTaken });

                console.log(`Upload Test Complete: ${speedMbps.toFixed(2)} Mbps`);
            }

        } else {
            // Handle error
            testInProgress = false;
            updateUI('error');
            alert(`Speed test failed: ${errorMessage}`);
            console.error('Speed test error:', errorMessage);
        }
    }

    // Centralized UI Update Function
    function updateUI(state, data = {}) {
        if (state === 'ready') {
            liveSpeedDisplay.style.display = 'block';
            finalSummaryDisplay.style.display = 'none';
            startTestBtn.disabled = false;
            startTestBtn.innerHTML = '<i class="fas fa-play"></i> Start Speed Test';
            speedResult.textContent = '--.--';
            progressFill.style.width = '0%';
            progressFill.style.background = 'linear-gradient(90deg, #4a6ee0, #6a11cb)';
            progressPercentage.textContent = '0%';
            fileSize.textContent = '0 MB';
            timeElapsed.textContent = '0.0s';
            if (speedLabel) speedLabel.textContent = 'Download Speed'; // Reset the label on ready state
            dataTransferred.textContent = '0 MB';
            testStatus.textContent = 'Ready';
            testStatus.classList.remove('status-testing', 'status-complete', 'status-error');
            finalSpeed.textContent = '--.-- Mbps';
            if (finalUploadSpeed) finalUploadSpeed.textContent = '--.-- Mbps';
            totalTime.textContent = '--.-- s';
            updateConnectionStatus();
        } else if (state === 'testing') {
            liveSpeedDisplay.style.display = 'block';
            finalSummaryDisplay.style.display = 'none';
            startTestBtn.disabled = true;
            startTestBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
            testStatus.textContent = data.statusText || 'Initializing...';
            testStatus.classList.add('status-testing');
            testStatus.classList.remove('status-complete', 'status-error');
            progressFill.style.width = '0%';
            progressPercentage.textContent = '0%';
            speedResult.textContent = '--.--';
            if (data.fileSizeText) fileSize.textContent = data.fileSizeText;
            if (data.speedLabelText && speedLabel) speedLabel.textContent = data.speedLabelText; // Update the label text
        } else if (state === 'progress') {
            if (data.percent !== undefined) {
                const roundedPercent = Math.round(data.percent);
                progressFill.style.width = `${data.percent}%`;
                progressPercentage.textContent = `${roundedPercent}%`;
            }
            if (data.total > 0 && fileSizeBytes === 0) {
                fileSizeBytes = data.total;
                const fileSizeMB = (data.total / (1024 * 1024)).toFixed(1);
                fileSize.textContent = `${fileSizeMB} MB`;
            }
            const elapsedSeconds = data.elapsed !== undefined ? data.elapsed : (new Date().getTime() - startTime) / 1000;
            timeElapsed.textContent = `${elapsedSeconds.toFixed(1)}s`;
            if (data.loaded !== undefined) {
                const transferredMB = (data.loaded / (1024 * 1024)).toFixed(1);
                dataTransferred.textContent = `${transferredMB} MB`;
            }
        } else if (state === 'speedUpdate') {
            speedResult.textContent = data.speed.toFixed(2);
            speedResult.classList.add('speed-pulse');
            setTimeout(() => speedResult.classList.remove('speed-pulse'), 500);
        } else if (state === 'complete') {
            liveSpeedDisplay.style.display = 'none';
            finalSummaryDisplay.style.display = 'block';
            startTestBtn.disabled = false;
            startTestBtn.innerHTML = '<i class="fas fa-play"></i> Start Speed Test';
            testStatus.textContent = 'Complete';
            testStatus.classList.remove('status-testing');
            testStatus.classList.add('status-complete');
            progressFill.style.background = 'linear-gradient(90deg, #4CAF50, #8BC34A)';
            progressFill.style.width = '100%';
            progressPercentage.textContent = '100%';
            connectionStatus.textContent = 'Test Complete';
            connectionIcon.className = 'fas fa-check-circle';
            connectionIcon.style.color = '#4CAF50';
            if (data.finalTime) totalTime.textContent = `${data.finalTime.toFixed(2)}s`;
            updateTestDate();
        } else if (state === 'error') {
            startTestBtn.disabled = false;
            startTestBtn.innerHTML = '<i class="fas fa-play"></i> Start Speed Test';
            testStatus.textContent = 'Error';
            testStatus.classList.remove('status-testing');
            testStatus.classList.add('status-error');
            speedResult.textContent = '--.--';
            connectionStatus.textContent = 'Error';
            connectionIcon.className = 'fas fa-exclamation-triangle';
            connectionIcon.style.color = '#f44336';
            updateTestDate();
        }
    }
    
    // Reset the test
    function resetTest() {
        // Cancel ongoing request if any
        if (xhr && testInProgress) {
            xhr.abort();
        }
        
        // Reset test variables
        testInProgress = false;
        testStage = '';
        startTime = null;
        endTime = null;
        fileSizeBytes = 0;
        totalBytesLoaded = 0;
        xhr = null;
        updateUI('ready');
    }
    
    // Listen for online/offline status changes
    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);
    
    // Initialize the app
    initApp();
});