const { GameLiftStreams } = require('@aws-sdk/client-gameliftstreams');

// Initialize GameLiftStreams client
const gameliftstreams = new GameLiftStreams({

});

if (!gameliftstreams.config.region) {
  console.error('Unable to determine region, use "aws configure" or specify --region parameter');
  process.exit(1);
}

export default gameliftstreams;