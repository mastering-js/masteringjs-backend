'use strict';

const assert = require('assert');
const { Configuration, OpenAIApi } = require('openai');

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

module.exports = async function awaitify(req, res) {
  const response = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'user',
        content: prompt(req.body.code)
      }
    ],
    temperature: 0,
    max_tokens: 2000
  });

  return res.json({
    content: response.data.choices[0].message.content
  });
};