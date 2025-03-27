require('dotenv').config();
const crypto = require('crypto');
const gameliftstreams = require('../services/gameLiftStreams.service');
const { parseLocations } = require('../utils/parse.utils');

const STREAM_CONNECTION_TIMEOUT_SECONDS = Number(process.env.STREAM_CONNECTION_TIMEOUT_SECONDS) || 600;
const STREAM_GROUP_ID = process.env.STREAM_GROUP_ID;
const APPLICATION_ID = process.env.APPLICATION_ID;
const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || 'DefaultPlayer';
const SESSION_LENGTH_SECONDS = Number(process.env.SESSION_LENGTH_SECONDS) || 12 * 3600;

const generalErrorStatusCode = 502;

// In-memory "database" for connection tokens
const connectionDatabase = {};

// ------------------------------------------------------------------------------------------------
// CONTROLLER METHODS -----------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------

function createStreamSession(req, res) {
    console.log(`CreateStreamSession request received: ${JSON.stringify(req.body)}`);

    // Validate required inputs
    if (!req.body.SignalRequest) {
        console.error('Missing required SignalRequest');
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Ideally your backend server will validate all of these configuration parameters,
    // or ignore the client and look up predetermined values from a configuration table.
    // You likely want to override AdditionalLaunchArgs/AdditionalEnvironmentVariables.
    // At the very least, you should authenticate the user id and stream group ids here.
    // You should never trust the client! But we will trust the client for the purposes
    // of this very simple demo application.
    const requestData = {
        Identifier: STREAM_GROUP_ID,
        UserId: req.body.UserId || DEFAULT_USER_ID,
        Protocol: 'WebRTC',
        SignalRequest: req.body.SignalRequest,
        ConnectionTimeoutSeconds: STREAM_CONNECTION_TIMEOUT_SECONDS,
        SessionLengthSeconds: SESSION_LENGTH_SECONDS, // Note: GameLiftStreams stream duration limit at 24 hours
        // Only include ApplicationId if defined; Optional field for multi-app feature
        ...(APPLICATION_ID && { ApplicationIdentifier: APPLICATION_ID }),
        // Optional parameters - can be passed from client or defaults
        AdditionalLaunchArgs: req.body.AdditionalLaunchArgs || [],
        AdditionalEnvironmentVariables: req.body.AdditionalEnvironmentVariables || {},
        Locations: parseLocations(), // Note: Optional field for multi-region feature
      };

      gameliftstreams.startStreamSession(requestData, (err, data) => {
        if (err) {
          console.log(`CreateStreamSession -> StartStreamSession ERROR: ${err}`);
          res.status(generalErrorStatusCode).json({ error: 'Failed to start stream session' });
        } else {
          console.log(`CreateStreamSession -> StartStreamSession SUCCESS: Arn=${JSON.stringify(data.Arn)}`);

          // Generate a unique private token that can be used to query for a signal response
          const connectionId = crypto.randomUUID();
          connectionDatabase[connectionId] = {
            StreamGroupId: STREAM_GROUP_ID,
            StreamSessionArn: data.Arn,
            Timestamp: Date.now()
          };

          res.json({ Token: connectionId });

          // Purge the token and related state after 24 hours (longest possible stream duration)
          setTimeout(() => {
            delete connectionDatabase[connectionId];
          }, /*milliseconds per day*/ 24 * 60 * 60 * 1000);
        }
      });
}

// Expose a "get signal response" API which takes an opaque connection token
// and returns the signal response to complete the connection, if it is ready
function getSignalResponse(req, res) {
    console.log(`GetSignalResponse request received: ${JSON.stringify(req.body)}`);

    const connectionData = req.body.Token && connectionDatabase[req.body.Token];
    if (!connectionData) {
        console.log('GetSignalResponse connection token is not recognized');
        return res.status(404).json({ error: 'Token not found' });
    }

    if (Date.now() - connectionData.Timestamp > STREAM_CONNECTION_TIMEOUT_SECONDS * 1000) {
        console.log('GetSignalResponse connection token is too old, connection attempt is no longer valid');
        return res.status(404).json({ error: 'Token expired' });
    }

    const requestData = {
        Identifier: connectionData.StreamGroupId,
        StreamSessionIdentifier: connectionData.StreamSessionArn,
    };

    gameliftstreams.getStreamSession(requestData, (err, data) => {
        if (err) {
        console.log(`GetSignalResponse -> GetStreamSession ERROR: ${err}`);
        res.status(generalErrorStatusCode).json({ error: 'Failed to get stream session' });
        } else {
        console.log(`GetSignalResponse -> GetStreamSession SUCCESS: Status=${data.Status}`);

        if (data.Status === 'ACTIVATING') {
            // Stream is not ready yet, client must check again later
            res.json({ SignalResponse: '' });
        } else if (data.Status === 'ACTIVE') {
            // Forward SignalResponse so client can connect to stream
            res.json({ SignalResponse: data.SignalResponse });
        } else {
            // Any other status is invalid for client connection
            console.log(`Invalid stream status: ${data.Status}`);
            res.status(404).json({ error: 'Stream not available' });
        }
        }
    });
}

// Expose a "reconnect stream session" API which synchronously reconnects to an
// existing stream, based on the private connection token which was originally
// sent to the client by CreateStreamSesssion. This operation is much faster than
// starting a new stream and should complete a few seconds at most.
function reconnectStreamSession(req, res) {
    console.log(`ReconnectStreamSession request received: ${JSON.stringify(req.body)}`);

    // Validate required inputs
    if (!req.body.Token || !req.body.SignalRequest) {
      console.error('Missing required Token or SignalRequest');
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // For simplicity, we treat knowledge of a valid connection token as authorization.
    // This is a very simple authentication model, and relies on keeping tokens secret,
    // which users might not do! They could share browser URLs, or use a shared system
    // which leaves the client connection token around somewhere on disk.
    // You will want to add additional authentication and authorization checks here.

    // Lookup private unique connection token in "database"
    const connectionData = connectionDatabase[req.body.Token];
    if (!connectionData) {
      console.log('ReconnectStreamSession connection token is not recognized');
      return res.status(404).json({ error: 'Token not found' });
    }

    console.log('Connection data from token:', JSON.stringify(connectionData));

    // Transform session connection data into a new connection request
    const requestData = {
      Identifier: connectionData.StreamGroupId,
      StreamSessionIdentifier: connectionData.StreamSessionArn,
      SignalRequest: req.body.SignalRequest,
    };

    gameliftstreams.createStreamSessionConnection(requestData, (err, data) => {
      if (err) {
        console.log(`ReconnectStreamSession -> CreateStreamSessionConnection ERROR: ${err}`);
        res.status(generalErrorStatusCode).json({ error: 'Failed to reconnect to stream' });
      } else {
        console.log(`ReconnectStreamSession -> CreateStreamSessionConnection SUCCESS: Arn=${connectionData.StreamSessionArn}`);

        // Return the new signal response for the client to complete reconnection
        res.json({ SignalResponse: data.SignalResponse });
      }
    });
}

// Expose a "destroy stream session" API which calls TerminateStreamSession to
// asynchronously end an existing stream, based on the private connection token
// which was originally sent to the client by CreateStreamSesssion.
function destroyStreamSession(req, res) {
    console.log(`DestroyStreamSession request received: ${JSON.stringify(req.body)}`);

    // Validate required inputs
    if (!req.body.Token) {
      console.error('Missing required Token');
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // For simplicity, we treat knowledge of a valid connection token as authorization.
    // This is a very simple authentication model, and relies on keeping tokens secret,
    // which users might not do! They could share browser URLs, or use a shared system
    // which leaves the client connection token around somewhere on disk.
    // You will want to add additional authentication and authorization checks here.

    // Lookup private unique connection token in "database"
    const connectionData = connectionDatabase[req.body.Token];
    if (!connectionData) {
      console.log('DestroyStreamSession connection token is not recognized');
      return res.status(404).json({ error: 'Token not found' });
    }

    console.log('Connection data from token:', JSON.stringify(connectionData));

    const requestData = {
      Identifier: connectionData.StreamGroupId,
      StreamSessionIdentifier: connectionData.StreamSessionArn,
    };

    gameliftstreams.terminateStreamSession(requestData, (err, data) => {
      if (err) {
        console.log(`DestroyStreamSession -> TerminateStreamSession ERROR: ${err}`);
        res.status(generalErrorStatusCode).json({ error: 'Failed to terminate stream' });
      } else {
        console.log(`DestroyStreamSession -> TerminateStreamSession SUCCESS: Arn=${connectionData.StreamSessionArn}`);

        // Purge the connection token immediately; clients can't make other
        // requests now that the stream has moved to TERMINATING status.
        delete connectionDatabase[req.body.Token];

        res.json({ success: true });
      }
    });
}

module.exports = {
  createStreamSession,
  destroyStreamSession,
  getSignalResponse,
  reconnectStreamSession
}