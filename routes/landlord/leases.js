const express = require('express');
const router = express.Router();
const Lease = require('../../models/Lease');
const Property = require('../../models/Property');
const Tenant = require('../../models/Tenant');
const { authMiddleware } = require('../../middleware');

router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { tenant, property, startDate, endDate, rentAmount, securityDeposit, leaseTerms } = req.body;

    // Verify that the property belongs to the landlord
    const propertyDoc = await Property.findOne({ _id: property, landlord: req.landlord._id });
    if (!propertyDoc) {
      return res.status(404).json({ message: 'Property not found or does not belong to you' });
    }

    // Verify that the tenant exists and is not already assigned
    const tenantDoc = await Tenant.findOne({ _id: tenant, property: { $exists: false } });
    if (!tenantDoc) {
      return res.status(404).json({ message: 'Tenant not found or is already assigned to a property' });
    }

    const newLease = new Lease({
      landlord: req.landlord._id,
      tenant,
      property,
      startDate,
      endDate,
      rentAmount,
      securityDeposit,
      leaseTerms
    });

    await newLease.save();

    // Update property status and current tenant
    propertyDoc.status = 'Occupied';
    propertyDoc.currentTenant = tenant;
    await propertyDoc.save();

    // Update tenant's assigned property
    tenantDoc.property = property;
    tenantDoc.landlord = req.landlord._id;
    await tenantDoc.save();

    res.status(201).json({ message: 'Lease created successfully', lease: newLease });
  } catch (error) {
    console.error('Create lease error:', error);
    res.status(500).json({ message: 'Error creating lease', error: error.message });
  }
});

router.get('/tenant', authMiddleware, async (req, res) => {
  try {
    const lease = await Property.findOne({ currentTenant: req.tenant._id, status: 'Occupied' })
      .populate('landlord', 'firstName lastName email phoneNumber')
      .populate('currentTenant', 'dates.startDate dates.endDate')
      .lean();

    if (!lease) {
      return res.status(404).json({ message: 'No active lease found' });
    }

    res.json(lease);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching lease', error: error.message });
  }
});

// Add this endpoint for editing leases
router.put('/edit/:tenantId', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { 
      unitsLeased,
      leaseType,
      startDate, 
      endDate,
      paymentMode 
    } = req.body;

    // Find tenant and their property
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    const property = await Property.findOne({ 
      _id: tenant.property,
      landlord: req.landlord._id 
    });
    
    if (!property) {
      return res.status(404).json({ 
        message: 'Property not found or does not belong to you' 
      });
    }

    // Update tenant's lease details
    const updatedTenant = await Tenant.findByIdAndUpdate(
      tenantId,
      {
        unitsLeased,
        leaseType,
        startDate,
        endDate,
        paymentMode,
        // Include property's rent details
        rent: property.rentDetails.annualRent,
        cautionFee: property.rentDetails.cautionFees
      },
      { new: true }
    );

    res.json({ 
      message: 'Lease updated successfully', 
      tenant: updatedTenant 
    });
  } catch (error) {
    console.error('Edit lease error:', error);
    res.status(500).json({ 
      message: 'Error updating lease', 
      error: error.message 
    });
  }
});

module.exports = router;
