const express = require('express');
const router = express.Router();
const Utility = require('../../models/Utility');
const UtilityBill = require('../../models/UtilityBill');
const VAT = require('../../models/VAT');
const PropertyType = require('../../models/PropertyType');
const { adminMiddleware } = require('../../middleware');

// Get all utilities
router.get('/', async (req, res) => {
  try {
    const utilities = await Utility.find();
    res.json(utilities);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching utilities', error: error.message });
  }
});

// Get all utility bills
router.get('/bills', async (req, res) => {
  try {
    const utilityBills = await UtilityBill.find();
    res.json(utilityBills);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching utility bills', error: error.message });
  }
});

// Add a new utility
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    const utility = new Utility({ name });
    await utility.save();
    res.status(201).json(utility);
  } catch (error) {
    res.status(500).json({ message: 'Error adding utility', error: error.message });
  }
});

// Add a new utility bill
router.post('/bills', async (req, res) => {
  try {
    const { name } = req.body;
    const utilityBill = new UtilityBill({ name });
    await utilityBill.save();
    res.status(201).json(utilityBill);
  } catch (error) {
    res.status(500).json({ message: 'Error adding utility bill', error: error.message });
  }
});


// Update VAT rate
router.put('/vat', adminMiddleware, async (req, res) => {
  try {
    const { rate } = req.body;

    // Validate rate
    if (typeof rate !== 'number' || rate < 0 || rate > 100) {
      return res.status(400).json({
        success: false,
        message: 'Invalid VAT rate. Must be between 0 and 100'
      });
    }

    // Create new VAT setting
    const vatSetting = new VAT({
      rate,
      updatedBy: req.admin._id
    });

    await vatSetting.save();

    res.json({
      success: true,
      message: 'VAT rate updated successfully',
      rate: vatSetting.rate
    });
  } catch (error) {
    console.error('Update VAT setting error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error updating VAT rate', 
      error: error.message 
    });
  }
});

// Update a utility
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const utility = await Utility.findByIdAndUpdate(id, { name }, { new: true });
    if (!utility) {
      return res.status(404).json({ message: 'Utility not found' });
    }
    res.json(utility);
  } catch (error) {
    res.status(500).json({ message: 'Error updating utility', error: error.message });
  }
});

// Update a utility bill
router.put('/bills/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const utilityBill = await UtilityBill.findByIdAndUpdate(id, { name }, { new: true });
    if (!utilityBill) {
      return res.status(404).json({ message: 'Utility bill not found' });
    }
    res.json(utilityBill);
  } catch (error) {
    res.status(500).json({ message: 'Error updating utility bill', error: error.message });
  }
});

// Get all property types
router.get('/property-types', async (req, res) => {
  try {
    const propertyTypes = await PropertyType.find().sort({ createdAt: -1 });
    res.json(propertyTypes);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching property types', error: error.message });
  }
});

// Add a new property type
router.post('/property-types', async (req, res) => {
  try {
    const { name } = req.body;
    const propertyType = new PropertyType({ name });
    await propertyType.save();
    res.status(201).json(propertyType);
  } catch (error) {
    res.status(500).json({ message: 'Error adding property type', error: error.message });
  }
});

// Update a property type
router.put('/property-types/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const propertyType = await PropertyType.findByIdAndUpdate(id, { name }, { new: true });
    if (!propertyType) {
      return res.status(404).json({ message: 'Property type not found' });
    }
    res.json(propertyType);
  } catch (error) {
    res.status(500).json({ message: 'Error updating property type', error: error.message });
  }
});

// Delete a property type
router.delete('/property-types/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const propertyType = await PropertyType.findByIdAndDelete(id);
    if (!propertyType) {
      return res.status(404).json({ message: 'Property type not found' });
    }
    res.json({ message: 'Property type deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting property type', error: error.message });
  }
});

// Get current VAT rate
router.get('/vat', adminMiddleware, async (req, res) => {
  try {
    const vatSetting = await VAT.getCurrentVatRate(req.admin._id);
    
    res.json({
      success: true,
      rate: vatSetting.rate
    });
  } catch (error) {
    console.error('Fetch VAT setting error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching VAT rate', 
      error: error.message 
    });
  }
});

module.exports = router;

