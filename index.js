'use strict';

const { addAsync } = require('@awaitjs/express');
const express = require('express');
const { name, version } = require('./package.json');

const port = process.env.PORT || 3000;

const app = addAsync(express());
app.use(require('cors')());

app.get('/status', (req, res) => {
  res.json({ name, version, last100Requests });
});

let last100Requests = [];

app.use(express.json());

app.postAsync('/awaitify', limitTo100Requests(), require('./awaitify'));

app.listen(port);
console.log('Listening on port', port);

function limitTo100Requests() {
  return (req, res, next) => {
    if (last100Requests.length < 100) {
      last100Requests.push({
        date: new Date(),
        url: req.url
      });
  
      next();
    } else {
      const oldestRequest = last100Requests[0];
      if (Date.now() - oldestRequest.date.valueOf() <= 1000 * 60 * 60) {
        res.status(400).send('Rate limit exceeded, API only supports 100 requests/hour currently');
        return;
      }
      last100Requests.shift();
      last100Requests.push({
        date: new Date(),
        url: req.url
      });
      next();
    }
  }
}