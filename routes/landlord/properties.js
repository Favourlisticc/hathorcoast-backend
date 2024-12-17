const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const Property = require('../../models/Property'); // Adjust the path as needed
const Tenant = require('../../models/Tenant'); // Make sure to import the Tenant model
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { authMiddleware } = require('../../middleware');
const Landlord = require('../../models/Landlord');
const mongoose = require('mongoose');
const fs = require('fs').promises;
const Counter = require('../../models/Counter');
const UnitPurchase = require('../../models/UnitPurchase');

// Configure Cloudinary (you can move this to a separate config file)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});


// Configure multer for multiple file uploads
const upload = multer({ dest: 'uploads/' });

router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: true }));

// Place this route before any routes with path parameters
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const properties = await Property.find({ landlord: req.landlord._id });
    const totalProperties = properties.length;
    const occupiedProperties = properties.filter(p => p.status === 'Occupied').length;
    const availableProperties = properties.filter(p => p.status === 'Available').length;

    res.status(200).json({
      totalProperties,
      occupiedProperties,
      availableProperties
    });
  } catch (error) {
    console.error('Fetch property summary error:', error);
    res.status(500).json({ message: 'Error fetching property summary', error: error.message });
  }
});

// Create a new property
router.post('/create', authMiddleware, upload.array('files', 10), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Fetch the landlord's unit balance
    const landlord = await Landlord.findById(req.landlord._id).session(session);

    if (!landlord) {
      return res.status(404).json({
        success: false,
        message: 'Landlord not found',
      });
    }

    const availableUnits = parseInt(landlord.amountofunit || '0', 10); // Convert string to number
    const unitsRequired = parseInt(req.body.unitsInstalled, 10) || 0;

    // Check if the landlord has enough units
    if (unitsRequired > availableUnits) {
      return res.status(400).json({
        success: false,
        message: `Insufficient units. Available: ${availableUnits}, Required: ${unitsRequired}`,
      });
    }

    // Generate property code
    const counter = await Counter.findByIdAndUpdate(
      'propertyCode',
      { $inc: { sequence: 1 } },
      { 
        new: true, 
        upsert: true,
        session 
      }
    );

    const propertyCode = `PROP-${String(counter.sequence).padStart(6, '0')}`;

    // Parse JSON strings from form data
    const utilities = JSON.parse(req.body.utilities);
    const rentDetails = JSON.parse(req.body.rentDetails);
    const financials = JSON.parse(req.body.financials);

    // Handle file uploads to Cloudinary
    const uploadImages = req.files.map(async (file) => {
      try {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'properties',
          public_id: `${propertyCode}-${Date.now()}`,
        });

        await fs.unlink(file.path);

        return {
          url: result.secure_url,
          publicId: result.public_id,
          caption: '',
        };
      } catch (error) {
        await fs.unlink(file.path);
        throw error;
      }
    });

    const uploadedImages = await Promise.all(uploadImages);

    // Create new property
    const newProperty = new Property({
      propertyCode,
      landlord: req.landlord._id,
      propertyType: req.body.propertyType,
      propertyName: req.body.propertyName,
      address: {
        propertyAddress: req.body.propertyAddress,
        state: req.body.state,
      },
      unitsInstalled: unitsRequired,
      propertyManager: req.body.propertyManager || undefined,
      lawyerInCharge: req.body.lawyerInCharge || undefined,
      utilities: utilities.map(util => ({
        utility: util.utility,
        amountPerAnnum: parseFloat(util.amountPerAnnum),
      })),
      images: uploadedImages,
      rentDetails: {
        annualRent: parseFloat(rentDetails.annualRent),
        agreementFees: parseFloat(rentDetails.agreementFees),
        cautionFees: parseInt(rentDetails.cautionFees, 10),
      },
      status: req.body.status,
      financials: {
        totalRevenue: financials.totalRevenue || 0,
        outstandingBalance: financials.outstandingBalance || 0,
      },
    });

    // Update landlord's balance
    landlord.amountofunit = (availableUnits - unitsRequired).toString(); // Convert updated balance to string
    await landlord.save({ session });

    // Save property
    await newProperty.save({ session });

    // Commit the transaction
    await session.commitTransaction();

    res.status(201).json({
      success: true,
      data: {
        property: newProperty,
        remainingUnits: availableUnits - unitsRequired,
      },
    });
  } catch (error) {
    // Rollback the transaction
    await session.abortTransaction();

    // Clean up uploaded images if they exist
    if (req.files) {
      await Promise.all(
        req.files.map(file =>
          fs.unlink(file.path).catch(err =>
            console.error('Error deleting temporary file:', err)
          )
        )
      );
    }

    console.error('Error creating property:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating property',
      error: error.message,
    });
  } finally {
    session.endSession();
  }
});


// Fetch all properties for the logged-in landlord
router.get('/', authMiddleware, async (req, res) => {
  try {
    const properties = await Property.find({ landlord: req.landlord._id })
      .select('-documents') // Exclude documents for faster query, if not needed
      .sort({ createdAt: -1 }); // Sort by creation date, newest first
    res.status(200).json({
      message: 'Properties fetched successfully',
      count: properties.length,
      properties: properties
    });
 
  } catch (error) {
    console.log('Fetch properties error:', error);
    res.status(500).json({ message: 'Error fetching properties', error: error.message });
  }
});

// Fetch all occupied properties for the logged-in landlord
router.get('/occupied', authMiddleware, async (req, res) => {
  try {
    const query = { landlord: req.landlord._id };
    if (req.query.status) {
      query.status = req.query.status;
    }
    const properties = await Property.find(query)
      .select('-documents')
      .populate('currentTenant', 'firstName lastName')
      .sort({ createdAt: -1 });
    res.status(200).json({
      message: 'Properties fetched successfully',
      count: properties.length,
      properties: properties
    });
  } catch (error) {
    console.error('Fetch properties error:', error);
    res.status(500).json({ message: 'Error fetching properties', error: error.message });
  }
});

// Get details of a particular property
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const property = await Property.findOne({ 
      _id: req.params.id, 
      landlord: req.landlord._id 
    })
    .populate({
      path: 'currentTenant',
      select: 'title firstName lastName contactInfo dateOfBirth currentAddress employmentStatus rent paymentMode startDate endDate unitsLeased leaseType'
    })
    .populate({
      path: 'propertyManager',
      select: 'firstName lastName contactInfo'
    })
    .populate({
      path: 'utilities.utility',
      select: 'name description cost'
    })
    .populate({
      path: 'propertyType',
      select: 'name'
    })

    if (!property) {
      return res.status(404).json({ 
        message: 'Property not found or you do not have permission to view it' 
      });
    }

    res.status(200).json({
      message: 'Property details fetched successfully',
      property: property
    });
  } catch (error) {
    console.error('Fetch property details error:', error);
    res.status(500).json({ 
      message: 'Error fetching property details', 
      error: error.message 
    });
  }
});

// Edit a property
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const property = await Property.findOneAndUpdate(
      { _id: req.params.id, landlord: req.landlord._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!property) {
      return res.status(404).json({ message: 'Property not found or you do not have permission to edit' });
    }
    res.status(200).json({ message: 'Property updated successfully', property });
  } catch (error) {
    res.status(400).json({ message: 'Error updating property', error: error.message });
  }
});

// Delete a property
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const property = await Property.findOneAndDelete({ _id: req.params.id, landlord: req.landlord._id });
    if (!property) {
      return res.status(404).json({ message: 'Property not found or you do not have permission to delete' });
    }
    res.status(200).json({ message: 'Property deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: 'Error deleting property', error: error.message });
  }
});

// Assign a tenant to a property
router.put('/:id/assign-tenant', authMiddleware, async (req, res) => {
  try {
    const { tenantId, leaseDetails } = req.body;
    
    // Start a transaction
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Check if the property exists and belongs to the landlord
      const property = await Property.findOne({ 
        _id: req.params.id, 
        landlord: req.landlord._id 
      }).session(session);
      
      if (!property) {
        throw new Error('Property not found or you do not have permission to edit');
      }

      // Check if the tenant exists
      const tenant = await Tenant.findById(tenantId).session(session);
      if (!tenant) {
        throw new Error('Tenant not found');
      }

      // Find the landlord
      const landlord = await Landlord.findById(req.landlord._id).session(session);
      if (!landlord) {
        throw new Error('Landlord not found');
      }

      // Update the property with the new tenant
      property.currentTenant = tenantId;
      property.status = 'Occupied';
      await property.save({ session });
      
      // Update the tenant's details
      tenant.landlord = req.landlord._id;
      tenant.property = property._id;
      tenant.unitsLeased = leaseDetails.unitsLeased;
      tenant.leaseType = leaseDetails.leaseType;
      tenant.dates.startDate = leaseDetails.startDate;
      tenant.dates.endDate = leaseDetails.endDate;
      tenant.rent = leaseDetails.rent;
      tenant.apartmentName = leaseDetails.apartmentName;
      tenant.cautionFee = leaseDetails.cautionFee;
      tenant.paymentMode = leaseDetails.paymentMode;
      await tenant.save({ session });

      // Find and update referral history entry
      const referralEntry = landlord.referral.commission.referralHistory.find(
        entry => entry.referredUser.toString() === tenant._id.toString()
      );

  

      if (referralEntry) {
        // Update the referral status and add commission to balance
        referralEntry.status = 'completed';
        
        // Add commission to balance if not already added
        if (!referralEntry.isPaid) {
          landlord.referral.commission.balance += referralEntry.commission;
          landlord.referral.commission.totalEarned += referralEntry.commission;
          referralEntry.isPaid = true;
          referralEntry.paidAt = new Date();
        }
      }

      await landlord.save({ session });

      // Commit the transaction
      await session.commitTransaction();

      res.status(200).json({ 
        message: 'Tenant assigned to property successfully', 
        property,
        tenant,
        landlord: {
          referral: landlord.referral
        }
      });
    } catch (error) {
      // Rollback transaction on error
      await session.abortTransaction();
      throw error;
    } finally {
      // End session
      session.endSession();
    }
  } catch (error) {
    console.error('Assign tenant error:', error);
    res.status(400).json({ 
      message: 'Error assigning tenant to property', 
      error: error.message 
    });
  }
});

module.exports = router;