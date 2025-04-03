const express = require('express');

// Local Modules
const apiRouter = require('./api.router');
const rootRouter = require('./root.router');

const router = express.Router();

router.use('/', rootRouter);
router.use('/api', apiRouter);

module.exports = router;