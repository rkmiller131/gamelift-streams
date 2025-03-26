const express = require('express');

// Local Modules
const {
  createStreamSession,
  reconnectStreamSession,
  destroyStreamSession
} = require('../controllers/streamSession.controller');

const apiRouter = express.Router();

// Paths are relative to the collection name defined in app.js
apiRouter.post('/CreateStreamSession', createStreamSession);
// apiRouter.post('/GetSignalResponse', getSignalResponse);
apiRouter.post('/ReconnectStreamSession', reconnectStreamSession);
apiRouter.post('/DestroyStreamSesssion', destroyStreamSession);

module.exports = apiRouter;