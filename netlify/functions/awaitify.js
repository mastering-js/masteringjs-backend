'use strict';

const assert = require('assert');
const { Configuration, OpenAIApi } = require('openai');
const RateLimit = require('../../src/db/rateLimit');
const connect = require('../../src/connect');

const maxOpenAIRequestsPerHour = 250;

const apiKey = process.env.OPEN_AI_KEY;
assert.ok(apiKey, 'No OPEN_AI_KEY specified');

const prompt = code => `
You are a software developer refactoring a legacy codebase.
The codebase uses Node.js callbacks. Refactor the code snippet to use async functions and await instead.
Assume that any function that takes a callback parameter also returns a promise.

Input:
const A = db.model('A', { n: [{ age: 'number' }] });
const a = new A({ n: [{ age: '47' }] });
assert.strictEqual(47, a.n[0].age);
a.save(function(err) {
  assert.ifError(err);
  A.findById(a, function(err) {
    assert.ifError(err);
    assert.strictEqual(47, a.n[0].age);
  });
});
Output:
const A = db.model('A', { n: [{ age: 'number' }] });
const a = new A({ n: [{ age: '47' }] });
assert.strictEqual(47, a.n[0].age);
await a.save();
await A.findById(a);
assert.strictEqual(47, a.n[0].age);

Input:
${code}

Output:`.trim();

const configuration = new Configuration({
  apiKey
});
const openai = new OpenAIApi(configuration);

const headers = Object.freeze({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,PUT,PATCH,POST,DELETE'
});

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      body: '',
      headers
    };
  }

  try {
    await connect();
    await checkRateLimit('openai.createChatCompletion');
    const { code } = JSON.parse(event.body || {});

    const response = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: prompt(code)
        }
      ],
      temperature: 0,
      max_tokens: 2000
    });
    return {
      statusCode: 200,
      body: response.data.choices[0].message.content,
      headers
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: error.message,
      headers
    };
  }
}

async function checkRateLimit(functionName) {
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
}
