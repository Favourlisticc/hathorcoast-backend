const express = require('express');
const router = express.Router();
const { adminMiddleware } = require('../../middleware');
const UnitPurchase = require('../../models/UnitPurchase');

// Get all unit purchases with pagination and search
router.get('/purchases', adminMiddleware, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10,
      search = "" 
    } = req.query;

    const query = {};
    
    if (search) {
      query.$or = [
        { 'landlord.firstName': { $regex: search, $options: 'i' } },
        { 'landlord.lastName': { $regex: search, $options: 'i' } },
        { 'landlord.email': { $regex: search, $options: 'i' } },
        { paymentReference: { $regex: search, $options: 'i' } }
      ];
    }

    const purchases = await UnitPurchase.find(query)
      .populate('landlord', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await UnitPurchase.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        purchases,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          page: parseInt(page),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 