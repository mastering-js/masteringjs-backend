'use strict';

const Article = require('./src/db/article');
const assert = require('assert');
const axios = require('axios');
const { Configuration, OpenAIApi } = require('openai');

const apiKey = process.env.OPEN_AI_KEY;
assert.ok(apiKey, 'No OPEN_AI_KEY specified');

const configuration = new Configuration({
  apiKey
});
const openai = new OpenAIApi(configuration);

module.exports = async function chatbot(req, res) {
  const { question } = req.body;
  const embedding = await createEmbedding(question).catch(err => {
    console.log('F', err);
    throw err;
  });

  const articles = await Article
    .find()
    .select({ $similarity: 1, title: 1, content: 1, url: 1 })
    .sort({ $vector: { $meta: embedding } })
    .limit(1);
  
  const prompt = `Answer this question with this context:\n\nQuestion: ${question}\n\nContext: ${articles[0].content}`;
  const response = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0,
    max_tokens: 2000
  });

  res.json({ content: response.data.choices[0].message.content });
}

function createEmbedding(input) {
  return axios({
    method: 'POST',
    url: 'https://api.openai.com/v1/embeddings',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    data: {
      model: 'text-embedding-ada-002',
      input
    }
  }).then(res => res.data.data[0].embedding);
}