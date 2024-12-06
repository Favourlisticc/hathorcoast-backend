const mongoose = require('mongoose');

const vatSchema = new mongoose.Schema({
  rate: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 7.5 // Default VAT rate
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  }
}, {
  timestamps: true
});

// Modified getCurrentVatRate to include updatedBy
vatSchema.statics.getCurrentVatRate = async function(userId) {
  const vatSetting = await this.findOne().sort({ createdAt: -1 });
  if (vatSetting) return vatSetting;
  
  // Create default if none exists
  return await this.create({ 
    rate: 7.5,
    updatedBy: userId // Include the userId for the default creation
  });
};

const VAT = mongoose.model('VAT', vatSchema);

module.exports = VAT;