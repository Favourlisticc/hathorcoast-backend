const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoiceCode: {
    type: String,
    required: true,
    unique: true,
  },
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true,
  },
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
  },
  landlord: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Landlord',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['Pending', 'Paid', 'Overdue', 'Cancelled'],
    default: 'Pending',
  },
  dueDate: {
    type: Date,
    required: true,
  },
  datePrepared: {
    type: Date,
    default: Date.now,
  },
  items: [{
    description: String,
    amount: Number,
    quantity: Number,
    total: Number,
  }],
  subtotal: Number,
  tax: Number,
  total: Number,
  notes: String,
}, { timestamps: true });

const Invoice = mongoose.model('Invoice', invoiceSchema);

module.exports = Invoice; 