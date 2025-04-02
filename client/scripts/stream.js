// --------------------------------------------------------------------------------------
// GAMELIFT STREAM CLASS INITIALIZATION -------------------------------------------------
// --------------------------------------------------------------------------------------
let inputEnabled = false;

function initializeGameLiftStreams() {
    const gameLiftStreams = globals.getData('gameLiftStreams');

    if (gameLiftStreams) {
        throw new Error('initializeGameLiftStreams() should only be called once.');
    }

    // Configure GameLift Streams - "gameliftstreams" is from the SDK
    if (typeof gameliftstreams !== 'undefined') {
        gameliftstreams.setLogLevel('debug');

        // https://gameliftstreams-public-website-assets.s3.us-west-2.amazonaws.com/AmazonGameLiftStreamsWebSDKReference-v1.0.0.pdf
        globals.setData('gameLiftStreams', new gameliftstreams.GameLiftStreams({
            videoElement: document.getElementById('streamVideoElement'),
            audioElement: document.getElementById('streamAudioElement'),
            inputConfiguration: {
                autoMouse: true,
                autoKeyboard: true,
                autoGamepad: true,
                hapticFeedback: true,
                setCursor: 'visibility', // Local cursor is never modified, but it can be hidden
                autoPointerLock: true, // The mouse is always captured whenever the remote cursor has been made invisible on stream host.
            },
            clientConnection: {
                connectionState: handleConnectionState,
                channelError: handleChannelError,
                serverDisconnect: handleServerDisconnect,
                applicationMessage: handleApplicationMessage
            }
        }));

        // For touchscreen support, convert inputs to mouse events (optional)
        RegisterTouchToMouse(document.getElementById('streamVideoElement'));

        return true;
    } else {
        console.error('GameLiftStreams SDK not loaded');
        return false;
    }
}

// -----------------------------------------------------------------------------------------------------
// GAMELIFT STREAM CLASS CALLBACKS ---------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------

function handleConnectionState(state) {
    console.log('Connection state: ', state);

    if (state === 'disconnected') {
        disconnectStream();
    }
}

function handleChannelError(error) {
    console.error('WebRTC internal connection error: ', error);
    disconnectStream();
}

function handleServerDisconnect(reasonCode) {
    console.log('Server disconnected, reason: ', reasonCode);

    if (reasonCode === 'terminated') {
        // Stream session has ended, disable all reconnection UI
        clearURLToken();
        globals.setData('connectionToken', null);
        document.getElementById('reconnectButton').style.display = 'none';
    }
    // The connection state will transition to 'disconnected' within 5 seconds,
    // but there is no reason to wait. The client can disconnect immediately.
    disconnectStream();
}

function handleApplicationMessage(message) {
    console.log('Received message from application: ', message.length, 'bytes');
}

// -----------------------------------------------------------------------------------------------------
// STREAMING LIFECYCLE METHODS -------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------

async function startStreaming() {
    const gameLiftStreams = globals.getData('gameLiftStreams');
    try {
        // Safari/iOS browser fix for audio autoplay; preps audio element to prevent startup delays
        // between stream reconnection/disconnection
        if (navigator.userAgent.indexOf(' AppleWebKit/') != -1 &&
            navigator.userAgent.indexOf(' Gecko/') == -1 &&
            navigator.userAgent.indexOf(' Chrome/') == -1) {
            const preStreamAudio = document.createElement('audio');
            preStreamAudio.loop = true;
            preStreamAudio.src = 'public/silence.mp3';
            void preStreamAudio.play(); // void to suppress the promise return value from .play() method

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

        globals.setData('connectionToken', response.Token);

        // Poll for signal response
        let signalResponse = '';
        let attempts = 0;
        const maxAttempts = 30; // 60 seconds maximum

        updateConnectionStatus('Waiting for stream to initialize...');

        while (!signalResponse && attempts < maxAttempts) {
            attempts++;
            await sleep(2000); // Wait 2 seconds

            const responseData = await sendPost('/api/GetSignalResponse', { Token: globals.getData('connectionToken') });
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
        setQueryParams(new Map([['token', globals.getData('connectionToken')]]));

        // Stop loading animation
        LoadingScreenStop();

        // Show streaming UI
        showPanel('streamingPanel');

        // Start performance monitoring after a short delay
        setTimeout(() => {
            startPerformanceMonitoring();
            const phantomButton = document.getElementById('phantomPointerLock');
            if (phantomButton) {
                // The onclick event triggers toggleInput() to attach input (inputEnabled starts off false)
                phantomButton.click();
            }
        }, 3000);

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
        // Clean up the temporary audio element, if one was created
        if (window.preStreamAudio) {
            window.preStreamAudio.pause();
            window.preStreamAudio.remove();
            delete window.preStreamAudio;
        }
    }
}

// Disconnect from stream but keep reconnection data
function disconnectStream() {
    const gameLiftStreams = globals.getData('gameLiftStreams');
    if (gameLiftStreams) {
        gameLiftStreams.close();
    }

    // Clean up performance monitoring
    const metricsUpdateInterval = globals.getData('metricsUpdateInterval');
    if (metricsUpdateInterval) {
        clearInterval(metricsUpdateInterval);
        globals.setData('metricsUpdateInterval', null);
    }

    showPanel('disconnectedPanel');
}

// Reconnect to an existing stream session
async function reconnectStreaming() {
    const gameLiftStreams = globals.getData('gameLiftStreams');
    try {
        showPanel('connectingPanel');
        updateConnectionStatus('Reconnecting to your game...');

        // Start loading animation
        LoadingScreenStart();

        // Generate a new signal request
        const signalRequest = await gameLiftStreams.generateSignalRequest();

        // Send reconnection request with existing token
        const result = await sendPost('/api/ReconnectStreamSession', {
            Token: globals.getData('connectionToken'),
            SignalRequest: signalRequest,
        });

        // Process the signal response
        await gameLiftStreams.processSignalResponse(result.SignalResponse);

        // Stop loading animation
        LoadingScreenStop();

        // Show streaming UI
        showPanel('streamingPanel');

        // Input is enabled by default
        // inputEnabled = true;
        if (!inputEnabled) {
            toggleInput();
        }

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
        globals.setData('connectionToken', null);
        document.getElementById('reconnectButton').style.display = 'none';
        return false;
    }
}

// Terminate the stream session
async function terminateStream() {
    const connectionToken = globals.getData('connectionToken');
    if (connectionToken) {
        try {
            await sendPost('/api/DestroyStreamSession', { Token: connectionToken });
        } catch (error) {
            console.error('Error terminating stream:', error);
        }
    }

    // Clear URL token and disconnect
    clearURLToken();
    globals.setData('connectionToken', null);
    document.getElementById('reconnectButton').style.display = 'none';
    disconnectStream();
}

// Restart the entire session
function restartSession() {
    clearURLToken();
    globals.setData('connectionToken', null);
    window.location.reload();
}

// -----------------------------------------------------------------------------------------------------
// UI CONTROLS -----------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------

function toggleInput() {
    const gameLiftStreams = globals.getData('gameLiftStreams');
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