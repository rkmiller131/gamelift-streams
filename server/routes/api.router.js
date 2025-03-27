const express = require('express');

// Local Modules
const {
  createStreamSession,
  getSignalResponse,
  reconnectStreamSession,
  destroyStreamSession
} = require('../controllers/streamSession.controller');

const apiRouter = express.Router();

// Paths are relative to the collection name defined in app.js ('/api')
// All endpoints are POST because they modify server state
// and need to receive JSON data in the request body
apiRouter.post('/CreateStreamSession', createStreamSession);
apiRouter.post('/GetSignalResponse', getSignalResponse);
apiRouter.post('/ReconnectStreamSession', reconnectStreamSession);
apiRouter.post('/DestroyStreamSession', destroyStreamSession);

module.exports = apiRouter;