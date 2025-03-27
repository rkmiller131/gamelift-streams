const express = require('express');
const path = require('path');

const router = require('./routes');

// Create server and serve up client-side folders to view in the browser.
const app = express();
app.use(express.static(path.join(__dirname, '../client')));

// Enable parsing of JSON request bodies
app.use(express.json());

app.use(router);

module.exports = app;