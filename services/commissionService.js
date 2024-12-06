const Agent = require('../models/Agent');
const Property = require('../models/Property');
const CommissionConfig = require('../models/CommissionConfig');

class CommissionService {
  static async calculateCommission(rentalAmount, paymentMode) {
    try {
      const config = await CommissionConfig.findOne({ status: 'active' })
        .sort({ effectiveDate: -1 });

      if (!config) {
        throw new Error('Commission configuration not found');
      }

      let baseAmount = parseFloat(rentalAmount);
      
      if (isNaN(baseAmount)) {
        throw new Error('Invalid rental amount');
      }
      
      // Adjust base amount based on payment mode
      switch (paymentMode) {
        case 'annually':
          baseAmount *= 12;
          break;
        case 'biannually':
          baseAmount *= 6;
          break;
        case 'quarterly':
          baseAmount *= 3;
          break;
        default:
          baseAmount *= 1;
      }

      // Find applicable tier rate
      const tierRate = config.tierRates.find(
        tier => baseAmount >= tier.minAmount && baseAmount <= tier.maxAmount
      );

      const rate = tierRate ? tierRate.rate : config.baseRate;
      return (baseAmount * rate) / 100;
    } catch (error) {
      console.error('Commission calculation error:', error);
      throw error;
    }
  }

  static async processRentalCommission(propertyId, tenantId, rentalDetails) {
    try {
      const property = await Property.findById(propertyId);
      if (!property || !property.agent) {
        throw new Error('Property or agent not found');
      }

      // Calculate commission
      const commission = await this.calculateCommission(
        rentalDetails.monthlyRent,
        property.type
      );

      // Create rental history entry
      property.rentalHistory.push({
        tenant: tenantId,
        startDate: rentalDetails.startDate,
        endDate: rentalDetails.endDate,
        monthlyRent: rentalDetails.monthlyRent,
        commission: {
          amount: commission.amount,
          status: 'pending'
        }
      });

      await property.save();

      // Update agent's commission balance
      const agent = await Agent.findById(property.agent);
      agent.commission.totalEarned += commission.amount;
      agent.commission.balance += commission.amount;
      await agent.save();

      return commission;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = CommissionService; 