require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

// Local Modules
const app = require('./app');

// Configuration variables
const STREAM_CONNECTION_TIMEOUT_SECONDS = 600;
const LISTEN_PORT_HTTP = 8000;
const LISTEN_PORT_HTTPS = 8443;
const TLS_KEYFILE = 'server.key'; // note: if not found, HTTPS is disabled
const TLS_CRTFILE = 'server.crt'; // note: if not found, HTTPS is disabled

// Create HTTPS server and listen for requests, if private key and certificate can be loaded
let key, cert;
try { key = fs.readFileSync(TLS_KEYFILE, 'utf8'); } catch { }
try { cert = fs.readFileSync(TLS_CRTFILE, 'utf8'); } catch { }
if (key && cert) {
    // Create https server
    httpsServer = https.createServer({key, cert}, app);

    // Test if port is open for IPV4 first
    httpsServer.listen(LISTEN_PORT_HTTPS, '0.0.0.0', (err) => {
        if (!err) {
            // Close server and continue
            httpsServer.close();
        }
        // Test if port is open for IPV6 next
        httpsServer.listen(LISTEN_PORT_HTTPS, (err) => {
            if (err) {
                throw err;
            }
            // Only start server if neither protocol throws an error for given port
            console.log(`Listening on HTTPS port ${LISTEN_PORT_HTTPS}`)
        })
    });
} else {
    console.log('Unable to load TLS certificate and private key for HTTPS');
}

// Create HTTP server
httpServer = http.createServer(app);

// Test if port is open for IPV4 first
httpServer.listen(LISTEN_PORT_HTTP, '0.0.0.0', (err) => {
    if (!err) {
        // Close server and continue
        httpServer.close();
    }
    // Test if port is open for IPV6 next
    httpServer.listen(LISTEN_PORT_HTTP, (err) => {
        if (err) {
            throw err;
        }
        // Only start server if neither protocol throws an error for given port
        console.log(`Listening on HTTP port ${LISTEN_PORT_HTTP}`)
    })
});