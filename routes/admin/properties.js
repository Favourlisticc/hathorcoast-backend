const express = require('express');
const router = express.Router();
const Property = require('../../models/Property');
const { adminMiddleware } = require('../../middleware');
const Agent = require('../../models/Agent');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const Tenant = require('../../models/Tenant');
const Eviction = require('../../models/Eviction');
const fs = require('fs').promises;

// Configure Cloudinary (you can move this to a separate config file)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer for multiple file uploads
const upload = multer({ dest: 'uploads/' });

// Add a new route for handling image uploads
router.post('/upload', adminMiddleware, upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const uploadPromises = req.files.map(async (file) => {
      try {
        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'properties', // Optional: organize uploads in folders
        });

        // Delete the temporary file
        await fs.unlink(file.path);

        return {
          url: result.secure_url,
          caption: '',
        };
      } catch (error) {
        // If there's an error, still try to delete the temporary file
        try {
          await fs.unlink(file.path);
        } catch (unlinkError) {
          console.error('Error deleting temporary file:', unlinkError);
        }
        throw error;
      }
    });

    const uploadedImages = await Promise.all(uploadPromises);
    res.json(uploadedImages);

  } catch (error) {
    console.error('Error uploading images:', error);
    res.status(500).json({ 
      message: 'Error uploading images', 
      error: error.message 
    });
  }
});

// Update the create property route to handle images
router.post('/create', adminMiddleware, async (req, res) => {
  try {
    // Create new property without specifying propertyCode
    const newProperty = new Property({
      landlord: req.body.landlord,
      propertyType: req.body.propertyType,
      propertyName: req.body.propertyName,
      address: req.body.address,
      unitsInstalled: req.body.unitsInstalled,
      propertyManager: req.body.propertyManager,
      lawyerInCharge: req.body.lawyerInCharge,
      utilities: req.body.utilities,
      images: req.body.images || [],
      rentDetails: req.body.rentDetails,
      status: req.body.status,
      financials: req.body.financials
    });

    // Generate property code
    const count = await Property.countDocuments();
    newProperty.propertyCode = `PROP-${String(count + 1).padStart(6, '0')}`;
    // The propertyCode will be automatically generated before saving
    await newProperty.save();

    res.status(201).json({
      success: true,
      data: newProperty
    });
  } catch (error) {
    console.error('Error creating property:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating property',
      error: error.message
    });
  }
});

// Update the property update route to handle images
router.put('/:id', adminMiddleware, async (req, res) => {
  try {
    const { images, ...updateData } = req.body;
    
    // If there are new images, append them to existing ones
    if (images) {
      const property = await Property.findById(req.params.id);
      if (property) {
        updateData.images = [...(property.images || []), ...images];
      }
    }

    const updatedProperty = await Property.findByIdAndUpdate(
      req.params.id, 
      updateData,
      { new: true }
    );

    if (!updatedProperty) {
      return res.status(404).json({ message: 'Property not found' });
    }
    res.json(updatedProperty);
  } catch (error) {
    res.status(500).json({ message: 'Error updating property', error: error.message });
  }
});

// @desc    Create eviction notice
// @route   POST /api/agents/evictions
// @access  Private
router.post('/evictions', adminMiddleware, async (req, res) => {
  try {
    const { tenant, property, landlord, reason, noticeDate, scheduledEvictionDate, documents, notes, legalProceedings } = req.body;

    const eviction = await Eviction.create({
      tenant,
      property,
      landlord,
      reason,
      noticeDate,
      scheduledEvictionDate,
      documents,
      notes,
      legalProceedings
    });

    res.status(201).json({ success: true, data: eviction });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @desc    Get all eviction notices
// @route   GET /api/agents/evictions
// @access  Private
router.get('/evictions', adminMiddleware, async (req, res) => {
  try {
    const evictions = await Eviction.find()
      .populate('tenant', 'firstName lastName email phoneNumber')
      .populate('property', 'name address')
      .populate('landlord', 'firstName lastName email phoneNumber');

    res.status(200).json({ success: true, data: evictions });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @desc    Get single eviction notice
// @route   GET /api/agents/evictions/:id
// @access  Private
router.get('/evictions/:id', adminMiddleware, async (req, res) => {
  try {
    const eviction = await Eviction.findById(req.params.id)
      .populate('tenant', 'firstName lastName email phoneNumber')
      .populate('property', 'name address')
      .populate('landlord', 'firstName lastName email phoneNumber');

    if (!eviction) {
      return res.status(404).json({ success: false, message: 'Eviction notice not found' });
    }

    res.status(200).json({ success: true, data: eviction });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @desc    Update eviction notice
// @route   PUT /api/agents/evictions/:id
// @access  Private
router.put('/evictions/:id', adminMiddleware, async (req, res) => {
  try {
    const eviction = await Eviction.findById(req.params.id);
    if (!eviction) {
      return res.status(404).json({ success: false, message: 'Eviction notice not found' });
    }

    const updatedEviction = await Eviction.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true, runValidators: true }
    ).populate('tenant property landlord');

    res.status(200).json({ success: true, data: updatedEviction });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @desc    Delete eviction notice
// @route   DELETE /api/agents/evictions/:id
// @access  Private
router.delete('/evictions/:id', adminMiddleware, async (req, res) => {
  try {
    const eviction = await Eviction.findById(req.params.id);
    if (!eviction) {
      return res.status(404).json({ success: false, message: 'Eviction notice not found' });
    }

    await eviction.deleteOne();
    res.status(200).json({ success: true, message: 'Eviction notice deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Add a route to delete a specific image from a property
router.delete('/:propertyId/images/:imageIndex', adminMiddleware, async (req, res) => {
  try {
    const { propertyId, imageIndex } = req.params;
    const property = await Property.findById(propertyId);

    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    if (!property.images || imageIndex >= property.images.length) {
      return res.status(404).json({ message: 'Image not found' });
    }

    // Remove the image from the array
    property.images.splice(parseInt(imageIndex), 1);
    await property.save();

    res.json({ message: 'Image deleted successfully', property });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting image', error: error.message });
  }
});

// Get all properties
router.get('/properties', adminMiddleware, async (req, res) => {
  try {
    const properties = await Property.find().populate('landlord', 'firstName lastName phoneNumber').populate('propertyType', 'name');
    res.json(properties);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching properties', error: error.message });
  }
});

// Get a single property
router.get('/:id', adminMiddleware, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id).populate('landlord', 'personalInfo.firstName personalInfo.lastName');
    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }
    res.json(property);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching property', error: error.message });
  }
});

// Get tenants by property
router.get('/:propertyId/tenants', adminMiddleware, async (req, res) => {
  try {
    const { propertyId } = req.params;

    // Validate property exists
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    // Find all tenants for this property by checking the currentTenant field
    const tenants = await Tenant.find({
      _id: property.currentTenant
    }).select('-password');

    res.json(tenants);

  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching tenants for property', 
      error: error.message 
    });
  }
});

// Delete a property
router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    const deletedProperty = await Property.findByIdAndDelete(req.params.id);
    if (!deletedProperty) {
      return res.status(404).json({ message: 'Property not found' });
    }
    res.json({ message: 'Property deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting property', error: error.message });
  }
});

module.exports = router;
