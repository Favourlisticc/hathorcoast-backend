const mongoose = require('mongoose');

const KYCSchema = new mongoose.Schema({
  user: {
    id: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'user.type' },
    type: { type: String, required: true, enum: ['Agent', 'Tenant', "Landlord"] },
  },
  documents: [
    {
      type: { type: String, },
      documenturl: { type: String, required: true },
      selfieurl: { type: String,  },
      publicId: String,
      description: String,
    },
  ],
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
  adminComment: String,
  submittedAt: { type: Date, default: Date.now },
  verifiedAt: Date,
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
}, { timestamps: true });

module.exports = mongoose.model('KYC', KYCSchema);
