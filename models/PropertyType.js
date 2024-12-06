const mongoose = require('mongoose');

const propertyTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

const PropertyType = mongoose.model('PropertyType', propertyTypeSchema);

module.exports = PropertyType;
