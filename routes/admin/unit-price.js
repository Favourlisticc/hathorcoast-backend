const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { adminMiddleware } = require('../../middleware');
const UnitPrice = require('../../models/UnitPrice');

// Set new unit price
router.post('/set-price', adminMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { price, effectiveFrom, effectiveTo } = req.body;

    // Deactivate current active price
    await UnitPrice.findOneAndUpdate(
      { status: 'active' },
      { 
        status: 'inactive',
        effectiveTo: effectiveFrom || new Date()
      },
      { session }
    );

    // Create new price
    const newPrice = await UnitPrice.create([{
      price,
      effectiveFrom: effectiveFrom || new Date(),
      effectiveTo,
      createdBy: req.admin._id
    }], { session });

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      data: newPrice[0]
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({
      success: false,
      error: error.message
    });
  } finally {
    session.endSession();
  }
});

// Get current unit price
router.get('/current-price', async (req, res) => {
  try {
    const currentPrice = await UnitPrice.findOne({ status: 'active' })
      .sort('-effectiveFrom');

    if (!currentPrice) {
      return res.status(404).json({
        success: false,
        error: 'No active unit price found'
      });
    }

    res.status(200).json({
      success: true,
      data: currentPrice
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get all unit prices with pagination
router.get('/prices', adminMiddleware, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      sortBy = 'effectiveFrom', 
      sortOrder = 'desc' 
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 },
      populate: {
        path: 'createdBy',
        select: 'firstName lastName email'
      }
    };

    const prices = await UnitPrice.find()
      .sort({ effectiveFrom: -1 })
      .populate('createdBy', 'firstName lastName email');

    const total = await UnitPrice.countDocuments();

    res.status(200).json({
      success: true,
      data: {
        prices,
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

// Get price history for a specific date range
router.get('/history', adminMiddleware, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query = {};
    if (startDate && endDate) {
      query.effectiveFrom = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const prices = await UnitPrice.find(query)
      .sort({ effectiveFrom: -1 })
      .populate('createdBy', 'firstName lastName email');

    res.status(200).json({
      success: true,
      data: prices
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 