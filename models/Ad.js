const mongoose = require('mongoose');

const AdSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Ad title is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Ad description is required']
  },
  image: {
    type: String,
  },
  targetUrl: {
    type: String,
    required: [true, 'Target URL is required'],
    match: [/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/, 'Please enter a valid URL']
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'scheduled'],
    default: 'active'
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  targetAudience: [{
    type: String,
    enum: ['agents', 'landlords', 'tenants'],
    required: true
  }],
  placement: {
    type: String,
    enum: ['sidebar', 'banner', 'popup', 'feed'],
    required: true
  },
  clicks: {
    type: Number,
    default: 0
  },
  impressions: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  budget: {
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'NGN'
    }
  }
});

// Add index for efficient querying
AdSchema.index({ status: 1, startDate: 1, endDate: 1 });

const Ad = mongoose.model('Ad', AdSchema);

module.exports = Ad; 