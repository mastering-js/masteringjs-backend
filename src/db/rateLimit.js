'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const rateLimitSchema = new Schema(
  {
    recentRequests: [{
      date: {
        type: Date,
        required: true,
        default: () => Date.now()
      },
      url: {
        type: String,
        required: true
      }
    }]
  },
  { timestamps: true }
);

module.exports = mongoose.model("RateLimit", rateLimitSchema, "ratelimits", { overwriteModels: true });