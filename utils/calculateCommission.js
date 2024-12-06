const Property = require('../models/Property');

async function calculateCommission(referral) {
  try {
    // Fetch the property associated with the referred tenant
    const property = await Property.findOne({ tenant: referral.referred });
    
    if (!property) {
      console.error('Property not found for referred tenant');
      return 0; // Return 0 if no property is found
    }

    // Get the monthly rent of the property
    const monthlyRent = property.monthlyRent;

    // Calculate commission based on your business rules
    // Example: 50% of first month's rent, capped at $500
    let commission = monthlyRent * 0.5;
    commission = Math.min(commission, 500);

    // Round to two decimal places
    return Math.round(commission * 100) / 100;
  } catch (error) {
    console.error('Error calculating commission:', error);
    return 0; // Return 0 in case of any error
  }
}

module.exports = calculateCommission;

