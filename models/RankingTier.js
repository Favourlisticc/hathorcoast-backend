const mongoose = require('mongoose');

const RankingTierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tier name is required'],
    unique: true,
    trim: true
  },
  minimumEarnings: {
    type: Number,
    required: [true, 'Minimum earnings is required'],
    min: 0
  },
  bonus: {
    type: Number,
    required: [true, 'Bonus percentage is required'],
    min: 0,
    max: 100
  },
  color: {
    type: String,
    default: 'bg-gray-500'
  },
  order: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

// Ensure tiers are returned in correct order
RankingTierSchema.pre('find', function() {
  this.sort('order');
});

const RankingTier = mongoose.model('RankingTier', RankingTierSchema);

module.exports = RankingTier;