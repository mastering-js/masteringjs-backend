'use strict';

const Article = require('./db/article');
const RateLimit = require('./db/rateLimit');
const connect = require('./connect');

run().catch(error => {
  console.error(error);
  process.exit(0);
});

async function run() {
  await connect();

  await Article.createCollection();
  await RateLimit.createCollection();
  console.log('Done');
  process.exit(0);
}