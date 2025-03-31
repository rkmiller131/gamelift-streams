require('dotenv').config();
const { GameLiftStreams } = require('@aws-sdk/client-gameliftstreams');

const config = {
  ...(process.env.AWS_REGION && { region: process.env.AWS_REGION })
};

// Configure AWS SDK for keep-alive reuse of HTTPS connections
// https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/node-reusing-connections.html
process.env.AWS_NODEJS_CONNECTION_REUSE_ENABLED = '1';

// Disable annoying "maintenance mode" console message
process.env.AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE = '1';

// Initialize GameLiftStreams client
const gameliftstreams = new GameLiftStreams(config);

if (!gameliftstreams.config.region) {
  console.error('Unable to determine region. Set AWS_REGION in your .env file or use "aws configure"');
  process.exit(1);
}

// console.log(`GameLiftStreams client initialized with region: ${gameliftstreams.config.region}`);

module.exports = gameliftstreams;