'use strict';

const Article = require('./src/db/article');
const articles = require('masteringjs.io/src/tutorials');
const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');
const mongoose = require('./src/mongoose');

dotenv.config();

run().catch(err => console.log(err));

async function run() {
  await mongoose.connect(process.env.ASTRA_URI, { isAstra: true });

  await Article.db.dropCollection('articles');
  await Article.createCollection({
    vector: { size: 1536, function: 'cosine' } 
  });

  console.log(`Importing ${articles.length} articles`);
  let i = 0;
  for (const { title, raw, url } of articles) {
    const content = fs.readFileSync(`${__dirname}/node_modules/masteringjs.io${raw.replace(/^\./, '')}`, 'utf8');
    const embedding = await createEmbedding(content);
    await Article.create({
      title,
      url,
      content: `${content.slice(0, 12000)}`,
      $vector: embedding
    });
    console.log(`Imported article ${++i} / ${articles.length}`);
  }
}

function createEmbedding(input) {
  return axios({
    method: 'POST',
    url: 'https://api.openai.com/v1/embeddings',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    data: {
      model: 'text-embedding-ada-002',
      input
    }
  }).then(res => res.data.data[0].embedding);
}