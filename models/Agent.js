const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const AddressSchema = new mongoose.Schema({
  street: String,
  city: String,
  state: String,
  country: String,
  postalCode: String
});

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
  },
  transactions: [{
    amount: {
      type: Number,
      required: true
    },
    commission: {
      type: Number,
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    },
    description: {
      type: String,
      default: 'Commission earned'
    },
    status: {
      type: String,
      enum: ['pending', 'completed'],
      default: 'completed'
    }
  }]
});

const BankDetailsSchema = new mongoose.Schema({
  bankName: {
    type: String,
    required: [true, 'Bank name is required']
  },
  accountNumber: {
    type: String,
    required: [true, 'Account number is required'],
    match: [/^\d{10}$/, 'Please enter a valid account number']
  },
  accountName: {
    type: String,
    required: [true, 'Account name is required']
  },
  accountType: {
    type: String,
    enum: ['savings', 'current']
  }
});

const NextOfKinSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Next of kin name is required']
  },
  relationship: {
    type: String,
    required: [true, 'Relationship is required']
  },
  phoneNumber: {
    type: String,
    match: [/^0\d{10}$/, 'Please enter a valid phone number']
  },
  email: {
    type: String,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  address: AddressSchema
});

// Add to existing AgentSchema
const WithdrawalSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed'],
    default: 'pending'
  },
  withdrawalType: {
    type: String,
    enum: ['partial', 'quarterly', 'biannual', 'annual'],
    required: true
  },
  requestDate: {
    type: Date,
    default: Date.now
  },
  processedDate: Date,
  remarks: String
});

// Extend existing AgentSchema
const AgentSchema = new mongoose.Schema({
  isApproved: { type: Boolean, default: false },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
  },
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    match: [/^0\d{10}$/, 'Please enter a valid phone number']
  },
  isApproved: { type: Boolean, default: false },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 8,
    select: false
  },
  businessName: {
    type: String,
    required: [true, 'Business name is required'],
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  dateOfBirth: Date,
  gender: {
    type: String,
    enum: ['male', 'female', 'other']
  },
  alternativePhone: {
    type: String,
    match: [/^0\d{10}$/, 'Please enter a valid phone number']
  },
  alternativeEmail: {
    type: String,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  address: AddressSchema,
  avatar: String,
  documents: {
    passport: String,
    signature: String,
    identificationDoc: String
  },
  nextOfKin: NextOfKinSchema,
  bankDetails: BankDetailsSchema,
  status: {
    type: String,
    enum: ['active', 'suspended'],
    default: 'active'
  },
  lastLogin: Date,
  commission: {
    balance: {
      type: Number,
      default: 0
    },
    totalEarned: {
      type: Number,
      default: 0
    },
    lastWithdrawal: Date,
    withdrawalHistory: [WithdrawalSchema],
    withdrawalSettings: {
      preferredWithdrawalType: {
        type: String,
        enum: ['partial', 'quarterly', 'biannual', 'annual'],
        default: 'partial'
      },
      minimumWithdrawalAmount: {
        type: Number,
        default: 10000 // Set your default minimum
      },
      maximumWithdrawalAmount: {
        type: Number,
        default: 1000000 // Set your default maximum
      }
    }
  },
  kycStatus: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'NOT_SUBMITTED'],
    default: 'NOT_SUBMITTED'
  },
  kycVerifiedAt: Date,
  referrals: [{ useremail: String,  id: { type: mongoose.Schema.Types.ObjectId, ref: 'Landlord' }, phonenumber: Number, amountpaid: Number }],
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
  suspensionDetails: {
    reason: String,
    suspendedAt: Date,
    suspendedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    }
  },
  isApproved: { type: Boolean, default: false },
});

// Encrypt password using bcrypt
AgentSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Match user entered password to hashed password in database
AgentSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Add pre-save hook for referral code
AgentSchema.pre('save', async function(next) {
  if (!this.referral?.referralCode) {
    this.referral = {
      ...this.referral,
      referralCode: 'AG' + Math.random().toString(36).substr(2, 8).toUpperCase()
    };
  }
  next();
});

const Agent = mongoose.model('Agent', AgentSchema);

module.exports = Agent;
