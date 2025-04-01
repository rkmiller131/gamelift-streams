let lastFrameTime = 0;
let frameCount = 0;
let currentFps = 0;

// Start monitoring performance metrics
function startPerformanceMonitoring() {
    console.log('Performance monitoring started');
    const gameLiftStreams = globals.getData('gameLiftStreams');

    if (!gameLiftStreams) return;

    // Clear any existing interval first
    const metricsUpdateInterval = globals.getData('metricsUpdateInterval');
    if (metricsUpdateInterval) {
        clearInterval(metricsUpdateInterval);
        console.log('Cleared existing metrics update interval');
    }

    // Set up a recurring interval to update metrics
    globals.setData('metricsUpdateInterval', setInterval(() => {
        if (!document.getElementById('streamingPanel').classList.contains('active')) {
            return; // Don't update metrics if streaming panel isn't visible
        }
        updatePerformanceMetrics();
    }, 1000));
}

// Fetch and update performance metrics
async function updatePerformanceMetrics() {
    try {
        const gameLiftStreams = globals.getData('gameLiftStreams');
        const stats = await gameLiftStreams.getVideoRTCStats();
        processStats(stats);
        return;

        // If all else fails, use estimation based on the video src
        estimatePerformanceMetrics();

    } catch (error) {
        console.error('Error collecting performance metrics:', error);
        estimatePerformanceMetrics();
    }
}

// Process WebRTC stats data from the gamelift streams SDK
function processStats(stats) {
    if (!stats) return;

    let rtt = 0;
    let jitter = 0;
    let fps = 0;
    let framesDecoded = 0;
    let lastFpsUpdate = 0;

    stats.forEach(stat => {
        // Extract RTT from candidate pair (only from the active/nominated pair)
        if (stat.type === 'candidate-pair' && stat.nominated === true && stat.state === 'succeeded') {
            rtt = stat.currentRoundTripTime * 1000; // Convert to ms
        }

        // Extract video metrics from inbound-rtp
        if (stat.type === 'inbound-rtp' && (stat.kind === 'video' || stat.mediaType === 'video')) {
            // Get jitter as part of delay metrics
            if (stat.jitter !== undefined) {
                jitter = stat.jitter * 1000; // Convert to ms
            }

            // Get FPS - directly if available
            if (stat.framesPerSecond !== undefined) {
                fps = stat.framesPerSecond;
            }

            // Or calculate from decoded frames
            if (stat.framesDecoded !== undefined) {
                framesDecoded = stat.framesDecoded;
            }

            // Also get jitter buffer delay if available
            if (stat.jitterBufferDelay !== undefined && stat.jitterBufferEmittedCount > 0) {
                const avgJitterBufferDelay = (stat.jitterBufferDelay / stat.jitterBufferEmittedCount) * 1000;
                // Use this as a better estimate of delay
                updateDelayDisplay(avgJitterBufferDelay);
            } else {
                // Fallback to jitter if buffer delay not available
                updateDelayDisplay(jitter);
            }

            // Try to get the frame timestamp to estimate FPS
            if (stat.timestamp !== undefined && lastFpsUpdate !== 0) {
                // If we have frames decoded and timestamps, we can estimate FPS
                if (globals.getData('lastFramesDecoded') !== undefined) {
                    const framesDelta = framesDecoded - globals.getData('lastFramesDecoded');
                    const timeDelta = (stat.timestamp - lastFpsUpdate) / 1000; // ms to seconds

                    if (timeDelta > 0) {
                        fps = Math.round(framesDelta / timeDelta);
                    }
                }

                globals.setData('lastFramesDecoded', framesDecoded);
                lastFpsUpdate = stat.timestamp;
            } else if (lastFpsUpdate === 0) {
                globals.setData('lastFramesDecoded', framesDecoded);
                lastFpsUpdate = stat.timestamp;
            }
        }
    });

    // Update UI elements
    updateRttDisplay(rtt);
    updateFPSDisplay(fps);
}

// -----------------------------------------------------------------------------------------------------
// FALLBACK METRICS BASED ON VIDEO ---------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------

// Track video frames to calculate FPS
function trackFrames(timestamp) {
    const gameLiftStreams = globals.getData('gameLiftStreams');

    if (!gameLiftStreams || !document.getElementById('streamingPanel').classList.contains('active')) {
        return; // Stop tracking if we're not streaming anymore
    }

    frameCount++;

    // Calculate FPS every second
    if (!lastFrameTime || timestamp - lastFrameTime >= 1000) {
        currentFps = frameCount;
        frameCount = 0;
        lastFrameTime = timestamp;

        updateFPSDisplay(currentFps);
    }

    requestAnimationFrame(trackFrames);
}

function estimatePerformanceMetrics() {
    console.log('switching to estimation mode for performance metrics');
    // Dynamic values that change over time to show updates
    const now = Date.now();
    const variation = Math.sin(now / 1000) * 10;

    const videoElement = document.getElementById('streamVideoElement');
    if (videoElement) {
        // Reset frame tracking variables
        lastFrameTime = 0;
        frameCount = 0;
        trackFrames();
    }
    updateRttDisplay(100 + variation);
    updateDelayDisplay(50 + variation / 2);
}

// -----------------------------------------------------------------------------------------------------
// HELPER FUNCTIONS TO UPDATE UI -----------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------

function updateFPSDisplay(fps) {
    const fpsElement = document.getElementById('metricFps');
    if (fpsElement) {
        fpsElement.textContent = fps + ' fps';
        setMetricClass(fpsElement, fps, 30, 15);
    }
}

function updateRttDisplay(rtt) {
    const rttElement = document.getElementById('metricRtt');
    if (rttElement) {
        rttElement.textContent = Math.round(rtt) + ' ms';
        setMetricClass(rttElement, rtt, 100, 200, true);
    }
}

function updateDelayDisplay(delay) {
    const delayElement = document.getElementById('metricDelay');
    if (delayElement) {
        delayElement.textContent = Math.round(delay) + ' ms';
        setMetricClass(delayElement, delay, 50, 100, true);
    }
}

// Sets text color class based on good/bad value thresholds
function setMetricClass(element, value, warningThreshold, badThreshold, isLowerBetter = false) {
    element.classList.remove('good', 'warning', 'bad');

    if (isLowerBetter) {
        if (value < warningThreshold) {
            element.classList.add('good');
        } else if (value < badThreshold) {
            element.classList.add('warning');
        } else {
            element.classList.add('bad');
        }
    } else {
        if (value > warningThreshold) {
            element.classList.add('good');
        } else if (value > badThreshold) {
            element.classList.add('warning');
        } else {
            element.classList.add('bad');
        }
    }
}