const express = require('express');
const router = express.Router();
const Tenant = require('../../models/Tenant');
const Property = require('../../models/Property');
const mongoose = require('mongoose');
const { adminMiddleware } = require('../../middleware');
const TokenBlacklist = require('../../models/TokenBlacklist');

// Create a new tenant
router.post('/', adminMiddleware, async (req, res) => {
  try {
    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Create a new tenant instance using the request body
      const newTenant = new Tenant({
        title: req.body.title,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        dateOfBirth: new Date(req.body.dob),
        contactInfo: {
          email: req.body.email,
          phoneNumber: req.body.phone,
        },
        password: req.body.password,
        currentAddress: req.body.currentAddress,
        nextOfKin: {
          name: req.body.nextOfKinName,
          phoneNumber: req.body.nextOfKinPhone,
          address: req.body.nextOfKinAddress,
        },
        employmentStatus: req.body.employmentStatus,
        establishmentName: req.body.establishmentName,
        employmentAddress: req.body.employmentAddress,
        landlord: req.body.landlordId,
        property: req.body.propertyId,
        unitsLeased: req.body.unitsLeased,
        leaseType: req.body.leaseType,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
        apartmentName: req.body.apartmentName,
        rent: req.body.rent,
        cautionFee: req.body.cautionFee,
        paymentMode: req.body.paymentMode,
      });

      // Save the new tenant
      await newTenant.save({ session });

      // Update the property status and currentTenant
      const updatedProperty = await Property.findByIdAndUpdate(
        req.body.propertyId,
        {
          $set: {
            status: 'Occupied',
            currentTenant: newTenant._id
          }
        },
        { 
          new: true,
          session 
        }
      );

      if (!updatedProperty) {
        throw new Error('Property not found');
      }

      // Commit the transaction
      await session.commitTransaction();
      
      res.status(201).json({ 
        message: 'Tenant created successfully and property updated', 
        tenant: newTenant,
        property: updatedProperty
      });

    } catch (error) {
      // If there's an error, abort the transaction
      await session.abortTransaction();
      throw error;
    } finally {
      // End the session
      session.endSession();
    }

  } catch (error) {
    res.status(500).json({ 
      message: 'Error creating tenant and updating property', 
      error: error.message 
    });
  }
});

// Get all tenants
router.get('/tenants', adminMiddleware, async (req, res) => {
  try {
    const tenants = await Tenant.find().select('-password');
    res.json(tenants);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching tenants', error: error.message });
  }
});

// Get a single tenant
router.get('/:id', adminMiddleware, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id).select('-password');
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }
    res.json(tenant);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching tenant', error: error.message });
  }
});

// Update a tenant
router.put('/:id', adminMiddleware, async (req, res) => {
  try {
    const updatedTenant = await Tenant.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
    if (!updatedTenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }
    res.json(updatedTenant);
  } catch (error) {
    res.status(500).json({ message: 'Error updating tenant', error: error.message });
  }
});

// Delete a tenant
router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    const deletedTenant = await Tenant.findByIdAndDelete(req.params.id);
    if (!deletedTenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }
    res.json({ message: 'Tenant deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting tenant', error: error.message });
  }
});

// Suspend a tenant
router.post('/:id/suspend', adminMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({ 
        success: false,
        message: 'Suspension reason is required' 
      });
    }

    // Update tenant status
    const tenant = await Tenant.findByIdAndUpdate(
      req.params.id,
      {
        status: 'suspended',
        suspensionDetails: {
          reason,
          suspendedAt: new Date(),
          suspendedBy: req.admin._id
        }
      },
      { 
        new: true,
        session,
        select: '-password' 
      }
    );

    if (!tenant) {
      await session.abortTransaction();
      return res.status(404).json({ 
        success: false,
        message: 'Tenant not found' 
      });
    }

    // Blacklist all existing tokens for this tenant
    await TokenBlacklist.create([{
      token: '*', // Special marker for all tokens
      userId: tenant._id,
      reason: 'Account suspended',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year expiry
    }], { session });

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Tenant suspended successfully',
      data: {
        tenant,
        suspensionDetails: {
          reason,
          suspendedAt: new Date()
        }
      }
    });

  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ 
      success: false,
      message: 'Error suspending tenant', 
      error: error.message 
    });
  } finally {
    session.endSession();
  }
});

// Reactivate a tenant
router.post('/:id/reactivate', adminMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const tenant = await Tenant.findByIdAndUpdate(
      req.params.id,
      {
        status: 'active',
        $unset: { suspensionDetails: "" }
      },
      { 
        new: true,
        session,
        select: '-password' 
      }
    );

    if (!tenant) {
      await session.abortTransaction();
      return res.status(404).json({ 
        success: false,
        message: 'Tenant not found' 
      });
    }

    // Remove all blacklisted tokens for this tenant
    await TokenBlacklist.deleteMany({ userId: tenant._id }, { session });

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Tenant reactivated successfully',
      data: { tenant }
    });

  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ 
      success: false,
      message: 'Error reactivating tenant', 
      error: error.message 
    });
  } finally {
    session.endSession();
  }
});

module.exports = router;
