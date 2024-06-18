'use strict';

const Article = require('../../src/db/article');
const { Configuration, OpenAIApi } = require('openai');
const assert = require('assert');
const axios = require('axios');
const similarity = require('compute-cosine-similarity');
const RateLimit = require('../../src/db/rateLimit');
const mongoose = require('mongoose');

const maxOpenAIRequestsPerHour = 250;

const apiKey = process.env.OPEN_AI_KEY;
assert.ok(apiKey, 'No OPEN_AI_KEY specified');

const configuration = new Configuration({
  apiKey
});
const openai = new OpenAIApi(configuration);

exports.handler = async (event, context, callback) => {
    const { question } = JSON.parse(event.body);
    const embedding = await createEmbedding(question).catch(err => {
      throw err;
    });
  
    let articles = await Article
      .find()
      .select({ $similarity: 1, $vector: 1, title: 1, content: 1, url: 1 })
      .sort({ $vector: { $meta: embedding } })
      .limit(10);
  
    articles = mmr(articles, embedding).slice(0, 3);
    
    const prompt = `Answer this question with this context:\n\nQuestion: ${question}\n\nContext: ${articles[0].content}\n\nContext: ${articles[1].content}\n\nContext: ${articles[2].content}`;
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
  
    return callback(null, {
        statusCode: 200,
        content: response.data.choices[0].message.content,
        link: articles[0].url,
        title: articles[0].title,
        sources: articles.map(article => ({ link: article.url, title: article.title }))
    });
};

async function createEmbedding(input) {
    await checkRateLimit('createEmbedding');
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
  
function mmr(docs, embedding) {
    // Result set
    const s = [];
    // Original phrases
    const r = [...docs];

    const lambda = 0.7;
    let score = 0;

    while (r.length > 0) {
        let docToAdd = 0;

        for (let i = 0; i < r.length; ++i) {
            const originalSimilarity = similarity(embedding, r[i].$vector);
            let maxDistance = 0;
        for (let j = 0; j < s.length; ++j) {
            const similarityToCurrent = similarity(r[i].$vector, s[j].$vector);
            if (similarityToCurrent > maxDistance) {
                maxDistance = similarityToCurrent;
            }
        }

        const equationScore = lambda * originalSimilarity - (1 - lambda) * maxDistance;
            if (equationScore > score) {
                score = equationScore;
                docToAdd = i;
            }
        }

        const [doc] = r.splice(docToAdd, 1);
        s.push(doc);
    }

    return s;
}

async function checkRateLimit(functionName) {
    await mongoose.connect('mongodb://localhost:27017/rates');
    const rateLimit = await RateLimit.collection.findOneAndUpdate(
      {},
      { $push: { recentRequests: { date: new Date(), url: functionName } } },
      { returnDocument: 'before', upsert: true }
    );
    const recentRequests = rateLimit?.recentRequests ?? [];
  
    if (recentRequests.length >= maxOpenAIRequestsPerHour) {
      await RateLimit.collection.updateOne({ _id: rateLimit._id }, { $pop: { recentRequests: -1 } });
  
      if (recentRequests[0].date > Date.now() - 1000 * 60 * 60) {
        throw new Error(`Maximum ${maxOpenAIRequestsPerHour} requests per hour`);
      }
    }
    await mongoose.disconnect();
  }