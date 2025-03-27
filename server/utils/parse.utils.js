require('dotenv').config();

// Parse comma-separated list into array ['us-west-2', 'us-east-1']
function parseLocations() {
  if (!process.env.STREAM_LOCATIONS) return undefined;

  return process.env.STREAM_LOCATIONS
    .split(',')
    .map(location => location.trim())
    .filter(location => location.length > 0);
}

module.exports = {
  parseLocations
}