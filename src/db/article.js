'use strict';

const mongoose = require('../mongoose');

const articleSchema = new mongoose.Schema({
  $vector: [Number],
  title: String,
  content: String,
  url: String
});

module.exports = mongoose.model('Article', articleSchema, 'articles');