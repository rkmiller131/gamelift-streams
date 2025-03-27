require('dotenv').config();
const fs = require('fs');
const http = require('http');
const https = require('https');

// Local Modules
const app = require('./app');

// Configuration variables
const STREAM_CONNECTION_TIMEOUT_SECONDS = 600;
const LISTEN_PORT_HTTP = 8000;
const LISTEN_PORT_HTTPS = 8443;
const TLS_KEYFILE = 'server.key'; // note: if not found, HTTPS is disabled
const TLS_CRTFILE = 'server.crt'; // note: if not found, HTTPS is disabled

/**
 * Creates and starts an HTTP or HTTPS server
 * @param {string} protocol - 'http' or 'https'
 * @param {number} port - Port number to listen on
 * @param {Object} [options] - Options for HTTPS server
 * @returns {Object} The server instance
 */
function createServer(protocol, port, options = {}) {
    // Create the appropriate server type
    const server = protocol === 'https'
      ? https.createServer(options, app)
      : http.createServer(app);

    // Start the server
    server.listen(port, () => {
      console.log(`${protocol.toUpperCase()} server running on port ${port}`);
    });

    // Handle server errors
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Error: Port ${port} is already in use`);
      } else {
        console.error(`${protocol.toUpperCase()} server error:`, err);
      }
    });

    return server;
}

// Always create HTTP server
const httpServer = createServer('http', LISTEN_PORT_HTTP);

// Try to create HTTPS server if certificates are available
let httpsServer;
try {
  // Try to load certificate files
  const key = fs.readFileSync(TLS_KEYFILE, 'utf8');
  const cert = fs.readFileSync(TLS_CRTFILE, 'utf8');

  // If files are loaded successfully, create the HTTPS server
  httpsServer = createServer('https', LISTEN_PORT_HTTPS, { key, cert });

} catch (error) {
  console.log('HTTPS server not started: TLS certificate/key not found or invalid');
  console.log(`(Looked for: ${TLS_KEYFILE} and ${TLS_CRTFILE})`);
}