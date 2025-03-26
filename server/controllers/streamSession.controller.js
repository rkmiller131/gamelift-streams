const gameliftstreams = require('../services/gameLiftStreams.service');

function createStreamSession(req, res) {
  console.log(`CreateStreamSession request received: ${JSON.stringify(req.body)}`);

  // Ideally your backend server will validate all of these configuration parameters,
  // or ignore the client and look up predetermined values from a configuration table.
  // You likely want to override AdditionalLaunchArgs/AdditionalEnvironmentVariables.
  // At the very least, you should authenticate the user id and stream group ids here.
  // You should never trust the client! But we will trust the client for the purposes
  // of this very simple demo application.
  const requestData = {
      Identifier: req.body.StreamGroupId,
      AdditionalLaunchArgs: req.body.AdditionalLaunchArgs,
      AdditionalEnvironmentVariables: req.body.AdditionalEnvironmentVariables,
      UserId: req.body.UserId,
      Protocol: 'WebRTC',
      SignalRequest: req.body.SignalRequest,
      ConnectionTimeoutSeconds: STREAM_CONNECTION_TIMEOUT_SECONDS,
      SessionLengthSeconds: 12*3600, // Note: GameLiftStreams stream duration limit at 24 hours
      ApplicationIdentifier: req.body.ApplicationIdentifier, // Note: Optional field for multi-app feature
      Locations: req.body.Locations, // Note: Optional field for multi-region feature
  };

  gameliftstreams.startStreamSession(requestData, (err, data) => {
      if (err) {
          console.log(`CreateStreamSession -> StartStreamSession ERROR: ${err}`);
          res.status(generalErrorStatusCode);
          res.json({});
      } else {
          console.log(`CreateStreamSession -> StartStreamSession SUCCESS: Arn=${JSON.stringify(data.Arn)}`);
          console.debug(data);
          // Generate a unique private token that can be used to query for a signal response
          const connectionId = crypto.randomUUID();
          connectionDatabase[connectionId] = {
              StreamGroupId: req.body.StreamGroupId,
              StreamSessionArn: data.Arn,
              Timestamp: Date.now()
          };
          res.json({ Token: connectionId });
          // Purge the token and related state after 24 hours (longest possible stream duration)
          setTimeout(() => { delete connectionDatabase[connectionId]; }, /*milliseconds per day*/ 24*60*60*1000);
      }
  });
}

function reconnectStreamSession(req, res) {

}

function destroyStreamSession(req, res) {

}

module.exports = {
  createStreamSession,
  reconnectStreamSession,
  destroyStreamSession
}