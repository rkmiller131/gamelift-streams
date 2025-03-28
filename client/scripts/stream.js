let gameLiftStreams = null;
let inputEnabled = true;
let connectionToken = null;

// Setup the GameLift Streams client
function initializeGameLiftStreams() {
    // Configure GameLift Streams SDK
    if (typeof gameliftstreams !== 'undefined') {
        gameliftstreams.setLogLevel('debug');

        gameLiftStreams = new gameliftstreams.GameLiftStreams({
            videoElement: document.getElementById('streamVideoElement'),
            audioElement: document.getElementById('streamAudioElement'),
            inputConfiguration: {
                autoMouse: true,
                autoKeyboard: true,
                autoGamepad: true,
                hapticFeedback: true,
                setCursor: 'visibility',
                autoPointerLock: 'fullscreen',
            },
            clientConnection: {
                connectionState: handleConnectionState,
                channelError: handleChannelError,
                serverDisconnect: handleServerDisconnect,
                applicationMessage: handleApplicationMessage
            }
        });

        // For touchscreen support
        if (typeof RegisterTouchToMouse === 'function') {
            RegisterTouchToMouse(document.getElementById('streamVideoElement'));
        }

        return true;
    } else {
        console.error('GameLiftStreams SDK not loaded');
        return false;
    }
}

// Start streaming
async function startStreaming() {
    try {
        // Safari/iOS browser fix for audio autoplay
        if (navigator.userAgent.indexOf(' AppleWebKit/') != -1 &&
            navigator.userAgent.indexOf(' Gecko/') == -1 &&
            navigator.userAgent.indexOf(' Chrome/') == -1) {
            const preStreamAudio = document.createElement('audio');
            preStreamAudio.loop = true;
            preStreamAudio.src = 'public/silence.mp3';
            void preStreamAudio.play();

            // Clean up later
            window.preStreamAudio = preStreamAudio;
        }

        updateConnectionStatus('Initializing connection...');

        // Start loading animation
        LoadingScreenStart();

        // Generate the signal request for a new WebRTC connection
        const signalRequest = await gameLiftStreams.generateSignalRequest();

        // Send the connection request to our backend
        updateConnectionStatus('Connecting to GameLift service...');
        const response = await sendPost('/api/CreateStreamSession', {
            SignalRequest: signalRequest
            // Server will use environment variables for other parameters
        });

        connectionToken = response.Token;

        // Poll for signal response
        let signalResponse = '';
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds maximum

        updateConnectionStatus('Waiting for stream to initialize...');

        while (!signalResponse && attempts < maxAttempts) {
            attempts++;
            await sleep(1000); // Wait 1 second

            const responseData = await sendPost('/api/GetSignalResponse', { Token: connectionToken });
            signalResponse = responseData.SignalResponse;

            // Update UI with progress
            updateConnectionStatus(`Initialization attempt (${attempts}/${maxAttempts})...`);
        }

        if (!signalResponse) {
            throw new Error('Timed out waiting for signal response');
        }

        // Complete connection by forwarding signal response
        updateConnectionStatus('Establishing stream connection...');
        await gameLiftStreams.processSignalResponse(signalResponse);

        // Store connection token in URL for reconnection
        setQueryParams(new Map([['token', connectionToken]]));

        // Stop loading animation
        LoadingScreenStop();

        // Show streaming UI
        showPanel('streamingPanel');

        // Input is enabled by default
        inputEnabled = true;

        // Start performance monitoring after a short delay
        setTimeout(() => {
            startPerformanceMonitoring();
        }, 1000);

        return true;
    } catch (error) {
        console.error('Connection error:', error);
        LoadingScreenStop();

        if (gameLiftStreams) {
            gameLiftStreams.close();
        }

        showError('Failed to connect: ' + (error.message || 'Unknown error'));
        return false;
    } finally {
        // Clean up the temporary audio element
        if (window.preStreamAudio) {
            window.preStreamAudio.pause();
            window.preStreamAudio.remove();
            delete window.preStreamAudio;
        }
    }
}

// Reconnect to an existing stream session
async function reconnectStreaming() {
    try {
        showPanel('connectingPanel');
        updateConnectionStatus('Reconnecting to your game...');

        // Start loading animation
        LoadingScreenStart();

        // Generate a new signal request
        const signalRequest = await gameLiftStreams.generateSignalRequest();

        // Send reconnection request with existing token
        const result = await sendPost('/api/ReconnectStreamSession', {
            Token: connectionToken,
            SignalRequest: signalRequest,
        });

        // Process the signal response
        await gameLiftStreams.processSignalResponse(result.SignalResponse);

        // Stop loading animation
        LoadingScreenStop();

        // Show streaming UI
        showPanel('streamingPanel');

        // Input is enabled by default
        inputEnabled = true;

        // Start performance monitoring after a short delay
        setTimeout(() => {
            startPerformanceMonitoring();
        }, 1000);

        return true;
    } catch (error) {
        console.error('Reconnection error:', error);
        LoadingScreenStop();

        if (gameLiftStreams) {
            gameLiftStreams.close();
        }

        showError('Failed to reconnect: ' + (error.message || 'Session may have expired'));

        // Clear token since reconnection failed
        clearURLToken();
        connectionToken = null;
        document.getElementById('reconnectButton').style.display = 'none';
        return false;
    }
}

// Terminate the stream session
async function terminateStream() {
    if (connectionToken) {
        try {
            await sendPost('/api/DestroyStreamSession', { Token: connectionToken });
        } catch (error) {
            console.error('Error terminating stream:', error);
        }
    }

    // Clear URL token and disconnect
    clearURLToken();
    connectionToken = null;
    document.getElementById('reconnectButton').style.display = 'none';
    disconnectStream();
}

// Disconnect from stream but keep reconnection data
function disconnectStream() {
    if (gameLiftStreams) {
        gameLiftStreams.close();
    }

    // Clean up performance monitoring
    if (metricsUpdateInterval) {
        clearInterval(metricsUpdateInterval);
        metricsUpdateInterval = null;
    }

    showPanel('disconnectedPanel');
}

// Toggle input controls
function toggleInput() {
    if (!gameLiftStreams) return;

    inputEnabled = !inputEnabled;
    const button = document.getElementById('toggleInputButton');

    if (inputEnabled) {
        gameLiftStreams.attachInput();
        button.textContent = 'Detach Input';
    } else {
        gameLiftStreams.detachInput();
        button.textContent = 'Attach Input';
    }
}

// Go fullscreen
function goFullscreen() {
    // Ensure input is enabled when entering fullscreen
    if (!inputEnabled) {
        toggleInput();
    }

    const container = document.getElementById('streamFullscreenContainer');
    if (container) {
        container.requestFullscreen().catch(err => {
            console.error('Error attempting to enable fullscreen:', err);
        });
    }
}

// Connection state callback
function handleConnectionState(state) {
    console.log('Connection state:', state);

    if (state === 'disconnected') {
        disconnectStream();
    }
}

// Channel error callback
function handleChannelError(error) {
    console.error('WebRTC connection error:', error);
    disconnectStream();
}

// Server disconnect callback
function handleServerDisconnect(reasonCode) {
    console.log('Server disconnected, reason:', reasonCode);

    if (reasonCode === 'terminated') {
        // Stream session ended, disable reconnection
        clearURLToken();
        connectionToken = null;
        document.getElementById('reconnectButton').style.display = 'none';
    }

    disconnectStream();
}

// Application message callback
function handleApplicationMessage(message) {
    console.log('Received message from application:', message.length, 'bytes');
}