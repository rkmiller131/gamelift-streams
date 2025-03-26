const express = require('express');

// Local Modules
const apiRouter = require('./api.router');

const router = express.Router();

router.use('/api', apiRouter);