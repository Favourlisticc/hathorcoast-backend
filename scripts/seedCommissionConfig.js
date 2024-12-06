const mongoose = require('mongoose');
const CommissionConfig = require('../models/CommissionConfig');
require('dotenv').config();

const seedCommissionConfig = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    // Delete existing configurations
    await CommissionConfig.deleteMany({});

    // Create default commission configuration
    const defaultConfig = new CommissionConfig({
      baseRate: 10, // 10% base rate
      tierRates: [
        {
          minAmount: 0,
          maxAmount: 100000,
          rate: 7 // 7% for rent up to 100,000
        },
        {
          minAmount: 100001,
          maxAmount: 500000,
          rate: 10 // 10% for rent between 100,001 and 500,000
        },
        {
          minAmount: 500001,
          maxAmount: 1000000,
          rate: 12 // 12% for rent between 500,001 and 1,000,000
        },
        {
          minAmount: 1000001,
          maxAmount: Number.MAX_SAFE_INTEGER,
          rate: 15 // 15% for rent above 1,000,000
        }
      ],
      status: 'active'
    });

    await defaultConfig.save();
    console.log('Commission configuration seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding commission configuration:', error);
    process.exit(1);
  }
};

seedCommissionConfig(); 