'use strict';

const express = require('express');
const { name, version } = require('./package.json');

const port = process.env.PORT || 3000;

const app = express();

app.get('/', (req, res) => {
  res.json({ name, version, answer: 42 });
});

app.listen(port);
console.log('Listening on port', port);