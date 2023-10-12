'use strict';

const Article = require('../src/db/article');
const articles = require('masteringjs.io/src/tutorials');
const axios = require('axios');
const fs = require('fs');
const mongoose = require('../src/mongoose');
const nlcstToString = require('nlcst-to-string');
const remark = require('remark');

run().catch(err => console.log(err));

async function run() {
  await mongoose.connect(process.env.ASTRA_URI, { isAstra: true });

  await Article.db.dropCollection('articles');
  await Article.createCollection({
    vector: { size: 1536, function: 'cosine' } 
  });

  console.log(`Importing ${articles.length} articles`);
  let i = 0;
  for (const { title, raw, url, tags } of articles) {
    if (tags.includes('temporal') || tags.includes('tools')) {
      continue;
    }
    console.log('Importing', title);
    const content = fs.readFileSync(`${__dirname}/../node_modules/masteringjs.io${raw.replace(/^\./, '')}`, 'utf8');
    
    const ast = remark.parse(content);
    const sections = [{ heading: null, nodes: [] }];
    let currentSection = 0;
    ast.children.forEach(node => {
      if (node.type === 'heading') {
        ++currentSection;
        console.log(nlcstToString(node));
        sections[currentSection] = {
          heading: nlcstToString(node),
          nodes: []
        };
      } 
      sections[currentSection].nodes.push(node);
    });

    console.log(`Importing ${sections.length} sections`);
    for (const section of sections) {
      const content = remark.stringify({
        type: 'root',
        children: section.nodes
      });

      const embedding = await createEmbedding(content);
      const contentTitle = section.heading ? `${title}: ${section.heading}` : title;
      const contentUrl = section.heading ? `${url}#${toKebabCase(section.heading)}` : url;

      await Article.create({
        title: contentTitle,
        url: contentUrl,
        content,
        $vector: embedding
      });
    }
    
    console.log(`Imported article ${++i} / ${articles.length}`);
  }
}

function createEmbedding(input) {
  return axios({
    method: 'POST',
    url: 'https://api.openai.com/v1/embeddings',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPEN_AI_KEY}`
    },
    data: {
      model: 'text-embedding-ada-002',
      input
    }
  }).then(res => res.data.data[0].embedding);
}

function toKebabCase(str) {
  return str.toLowerCase().split(/\s+/).map(word => word.replace(/\W+/g, '')).join('-');
}