const mongoose = require('mongoose');
const Counter = require('../models/Counter');

async function initializeCounters() {
  try {
    // Wait for MongoDB connection to be ready
    if (mongoose.connection.readyState !== 1) {
      console.log('Waiting for database connection...');
      await new Promise(resolve => {
        mongoose.connection.once('connected', resolve);
      });
    }

    // Check if propertyCode counter exists
    const counter = await Counter.findById('propertyCode');
    
    if (!counter) {
      // Create initial counter
      await Counter.create({
        _id: 'propertyCode',
        sequence: 0
      });
      console.log('Property code counter initialized');
    } else {
      console.log('Property code counter already exists');
    }
  } catch (error) {
    console.error('Error initializing counters:', error);
    // Optionally, you might want to throw the error to handle it in the calling code
    throw error;
  }
}

module.exports = initializeCounters; 