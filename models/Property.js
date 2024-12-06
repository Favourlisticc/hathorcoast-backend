// models/propertyModel.js
const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  propertyCode: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  landlord: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Landlord',
    required: true
  },
  propertyType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PropertyType',
    required: true
  },
  propertyName: {
    type: String,
    required: true
  },
  address: {
    propertyAddress: { type: String, required: true },
    state: { type: String, required: true }
  },
  unitsInstalled: {
    type: Number,
    required: true,
    min: 1
  },
  propertyManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent'
  },
  lawyerInCharge: {
    type: String
  },
  utilities: [{
    utility: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UtilityBill'
    },
    amountPerAnnum: { type: Number }
  }],
  status: {
    type: String,
    required: true,
    enum: ['Available', 'Occupied', 'Maintenance', 'Not Available'],
    default: 'Available'
  },
  currentTenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant'
  },
  images: [{
    url: String,
    caption: String
  }],
  documents: [{
    type: { type: String },
    fileUrl: String,
    uploadDate: Date
  }],
  maintenanceRequests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MaintenanceRequest'
  }],
  rentDetails: {
    annualRent: { type: Number, required: true },
    agreementFees: { type: Number },
    cautionFees: { type: Number }
  },
  financials: {
    totalRevenue: { 
      type: Number, 
      default: 0 
    },
    outstandingBalance: { 
      type: Number, 
      default: 0 
    },
    lastPaymentDate: Date,
    lastInvoiceDate: Date
  },
  notes: [{
    date: Date,
    author: String,
    content: String
  }],
  agent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent'
  },
  rentalHistory: [{
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant'
    },
    startDate: Date,
    endDate: Date,
    monthlyRent: Number,
    commission: {
      amount: Number,
      status: {
        type: String,
        enum: ['pending', 'paid'],
        default: 'pending'
      },
      paidDate: Date
    },
    status: {
      type: String,
      enum: ['active', 'ended', 'terminated'],
      default: 'active'
    }
  }]
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual fields for reports
propertySchema.virtual('payments', {
  ref: 'Payment',
  localField: '_id',
  foreignField: 'property'
});

propertySchema.virtual('invoices', {
  ref: 'Invoice',
  localField: '_id',
  foreignField: 'property'
});

// Indexes for better report performance
propertySchema.index({ status: 1 });
propertySchema.index({ 'rentDetails.annualRent': 1 });
propertySchema.index({ 'financials.totalRevenue': 1 });
propertySchema.index({ 'financials.outstandingBalance': 1 });
propertySchema.index({ createdAt: -1 });

// Method to calculate property revenue for a date range
propertySchema.methods.calculateRevenue = async function(fromDate, toDate) {
  const payments = await mongoose.model('Payment').aggregate([
    {
      $match: {
        property: this._id,
        date: { $gte: new Date(fromDate), $lte: new Date(toDate) },
        status: 'Completed'
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' }
      }
    }
  ]);

  return payments[0]?.total || 0;
};

// Method to calculate outstanding balance
propertySchema.methods.calculateOutstanding = async function() {
  const pendingInvoices = await mongoose.model('Invoice').aggregate([
    {
      $match: {
        property: this._id,
        status: 'Pending'
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$total' }
      }
    }
  ]);

  return pendingInvoices[0]?.total || 0;
};

// Update financials after payment
propertySchema.methods.updateFinancials = async function() {
  const [latestPayment, latestInvoice] = await Promise.all([
    mongoose.model('Payment').findOne({ property: this._id }).sort({ date: -1 }),
    mongoose.model('Invoice').findOne({ property: this._id }).sort({ createdAt: -1 })
  ]);

  this.financials = {
    ...this.financials,
    lastPaymentDate: latestPayment?.date,
    lastInvoiceDate: latestInvoice?.createdAt
  };

  await this.save();
};

const Property = mongoose.model('Property', propertySchema);

module.exports = Property;
