const mongoose = require('mongoose');

const tokenBlacklistSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  reason: String,
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 } // Document will be automatically deleted after expiry
  }
});

const TokenBlacklist = mongoose.model('TokenBlacklist', tokenBlacklistSchema); 

module.exports = TokenBlacklist;