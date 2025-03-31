// Initialize when page loads
document.addEventListener('DOMContentLoaded', initializeApp);

// Setup the GameLift Streams client
function initializeApp() {
    // When in fullscreen, try using Keyboard Lock API to capture all keys
    if ('keyboard' in navigator && 'lock' in navigator.keyboard) {
        document.addEventListener('fullscreenchange', () => {
            if (document.fullscreenElement) {
                navigator.keyboard.lock();
            }
        });
    }

    // Initialize the GameLift Streams SDK
    const sdkInitialized = initializeGameLiftStreams();

    if (!sdkInitialized) {
        showError('GameLift Streams SDK not loaded. Please check your internet connection.');
        return;
    }

    // Check for reconnection token in URL
    const urlParams = new URLSearchParams(window.location.search);
    connectionToken = urlParams.get('token');

    if (connectionToken) {
        // Show reconnect UI
        document.getElementById('reconnectButton').style.display = 'inline-block';
        showPanel('disconnectedPanel');
    } else {
        // No reconnection token, start new streaming session
        console.log('Initiating new streaming session...');
        startStreaming();
    }
}