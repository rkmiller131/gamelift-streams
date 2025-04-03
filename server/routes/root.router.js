const express = require('express');

const rootRouter = express.Router();

rootRouter.get('/', (req, res) => {
  res.status(200).send('Health check: Server is running');
});

module.exports = rootRouter;