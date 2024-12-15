const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const landlordSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  dateOfBirth: { type: Date },
  phoneNumber: { 
    type: String, 
    required: true, 
    // match: [/^0\d{13}$/, 'Please enter a valid phone number'] 
  },
  propertyAddress: { type: String },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  password: { type: String, required: true },
  address: { type: String },
  alternatePhoneNumber: { type: String },
  gender: { type: String },
  nationality: { type: String },
  stateOfOrigin: { type: String },
  localGovernmentArea: { type: String },
  amountofunit: { type: String },
  amountpaid: { type: String },
  agentreferral: { type: String },
  transferAccount: { type: String },
  
  // Keeping some fields from the original model for completeness
  properties: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Property' }],
  tenants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' }],
  documents: [{ 
    type: { type: String },
    fileUrl: String, 
    uploadDate: Date 
  }],
  notes: [{ 
    date: Date, 
    author: String, 
    content: String 
  }],
  accountOfficer: {
    name: { type: String },
    email: { type: String },
    phone: { type: String },
    photo: { type: String },
  },
  preferences: {
    emailNotifications: { type: Boolean, default: true },
    smsNotifications: { type: Boolean, default: true },
    twoFactorAuth: { type: Boolean, default: false }
  },
  isApproved: { type: Boolean, default: false },
  avatar: String,
  referral: {
    referralCode: {
      type: String,
      unique: true
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
      referralHistory: [{
        referredUser: {
          type: mongoose.Schema.Types.ObjectId,
          refPath: 'referral.referrerType'
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
        },
        isPaid: {
          type: Boolean,
          default: false
        },
        paidAt: {
          type: Date
        }
      }]
    }
  },
  accountOfficerRequest: {
    status: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected'],
      default: 'none'
    },
    requestedAt: Date,
    processedAt: Date,
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
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
}, { timestamps: true });

// Pre-save hook to hash password before saving
landlordSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password for login
landlordSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate unique referral code before saving
landlordSchema.pre('save', async function(next) {
  if (!this.referral.referralCode) {
    this.referral.referralCode = 'LL' + Math.random().toString(36).substr(2, 8).toUpperCase();
  }
  next();
});

const Landlord = mongoose.model('Landlord', landlordSchema);

module.exports = Landlord;
