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
    }
}

// Restart the entire session
function restartSession() {
  clearURLToken();
  connectionToken = null;
  window.location.reload();
}

// Show the specified panel, hide others
function showPanel(panelId) {
  const panels = document.querySelectorAll('.panel');
  panels.forEach(panel => {
      panel.classList.remove('active');
  });

  const activePanel = document.getElementById(panelId);
  if (activePanel) {
      activePanel.classList.add('active');
  }
}

// Update connection status message
function updateConnectionStatus(message) {
  const statusElement = document.getElementById('connectionStatus');
  if (statusElement) {
      statusElement.textContent = message;
  }
}

// Show error message
function showError(message) {
  const errorElement = document.getElementById('errorMessage');
  if (errorElement) {
      errorElement.textContent = message;
  }
  showPanel('errorPanel');
}