const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Update the referralHistory schema definition
const ReferralHistorySchema = new mongoose.Schema({
  referredUser: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'referral.referralHistory.userType'
  },
  userType: {
    type: String,
    enum: ['Landlord', 'Tenant', 'Agent']
  },
  commission: Number,
  date: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'pending'
  }
});

const tenantSchema = new mongoose.Schema({
  title: { type: String, required: true }, // Added title field
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  contactInfo: {
    email: { type: String, required: true, unique: true },
    phoneNumber: { type: String },
  },
  password: { type: String }, // Ensure password is required
  passwordResetToken: String,
  passwordResetExpires: Date,
  dateOfBirth: { type: Date }, // Changed to Date type
  currentAddress: { type: String, }, // Added current address field
  nextOfKin: { // Added next of kin details 
    name: { type: String },
    phoneNumber: { type: String },
    address: { type: String }
  },
  employmentStatus: { type: String }, // Added employment status
  establishmentName: { type: String }, // Added optional establishment name
  employmentAddress: { type: String }, // Added optional employment address
  documents: [{
    type: { type: String },
    fileUrl: String,
    uploadDate: Date
  }],
  invitationCode: String,
  profileImage: String, // Added avatar field
  landlord: { type: mongoose.Schema.Types.ObjectId, ref: 'Landlord' },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
  agent: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  isApproved: { type: Boolean, default: false },
  unitsLeased: { type: Number, min: 1 }, // Added units leased
  leaseType: { 
    type: String, 
    enum: ['Daily', 'Monthly', 'Annually'],
    
  },
  rent: { 
    type: Number, 
    
    min: 0 
  },
  cautionFee: { 
    type: Number, 
   
    min: 0 
  },
  dates: {
    startDate: {
      type: Date
    },
    endDate: {
      type: Date
    }
  },
  kycDocuments: {
    passport: String,
    identityProof: String,
    identityProofType: {
      type: String,
      enum: ['NIN', 'Voters Card', 'International Passport', 'None Available Yet'],
      default: 'None Available Yet'
    },
    uploadedAt: Date
  },
  referral: {
    referralCode: {
      type: String,
      unique: true,
      sparse: true
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'referral.referrerType'
    },
    referrerType: {
      type: String,
      enum: ['Landlord', 'Tenant', 'Agent']
    },
    commission: {
      balance: {
        type: Number,
        default: 0
      },
      totalEarned: {
        type: Number,
        default: 0
      },
      withdrawalHistory: [{
        amount: Number,
        date: Date,
        status: {
          type: String,
          enum: ['pending', 'completed', 'rejected'],
          default: 'pending'
        }
      }],
      referralHistory: [ReferralHistorySchema]
    }
  },
  status: {
    type: String,
    enum: ['active', 'suspended'],
    default: 'active'
  },
  suspensionDetails: {
    reason: String,
    suspendedAt: Date,
    suspendedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    }
  },
  kycStatus: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'NOT_SUBMITTED'],
    default: 'NOT_SUBMITTED'
  },
  kycVerifiedAt: Date,
  kycVerifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  kycAdminComment: String,
}, { timestamps: true });

// Hash the password before saving
tenantSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  if (!this.referral.referralCode) {
    this.referral.referralCode = 'TN' + Math.random().toString(36).substr(2, 8).toUpperCase();
  }
  next();
});

const Tenant = mongoose.model('Tenant', tenantSchema);
module.exports = Tenant;
