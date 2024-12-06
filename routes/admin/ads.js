const express = require('express');
const router = express.Router();
const Ad = require('../../models/Ad');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { adminMiddleware } = require('../../middleware');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer for file upload
const upload = multer({ dest: 'uploads/' });

// Create a new ad
router.post('/', adminMiddleware, upload.single('image'), async (req, res) => {
  try {
    const adData = {
      ...req.body,
      targetAudience: JSON.parse(req.body.targetAudience),
      budget: JSON.parse(req.body.budget),
      createdBy: req.admin._id
    };
    
    const ad = new Ad(adData);

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path);
      ad.image = result.secure_url;
    }

    await ad.save();

    res.status(201).json({
      success: true,
      data: ad
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get all ads (with filtering)
router.get('/', adminMiddleware, async (req, res) => {
  try {
    const { status, placement, audience } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (placement) filter.placement = placement;
    if (audience) filter.targetAudience = audience;

    const ads = await Ad.find(filter)
      .sort('-createdAt')
      .populate('createdBy', 'name email');

    res.status(200).json({
      success: true,
      count: ads.length,
      data: ads
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Update ad
router.put('/:id', adminMiddleware, upload.single('image'), async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (req.file) {
      updateData.image = req.file.path;
    }

    const ad = await Ad.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true
    });

    if (!ad) {
      return res.status(404).json({
        success: false,
        error: 'Ad not found'
      });
    }

    res.status(200).json({
      success: true,
      data: ad
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Delete ad
router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    const ad = await Ad.findByIdAndDelete(req.params.id);

    if (!ad) {
      return res.status(404).json({
        success: false,
        error: 'Ad not found'
      });
    }

    // You might want to delete the image file as well
    // await deleteFile(ad.image);

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Track ad click
router.post('/:id/click', async (req, res) => {
  try {
    const ad = await Ad.findByIdAndUpdate(
      req.params.id,
      { $inc: { clicks: 1 } },
      { new: true }
    );

    if (!ad) {
      return res.status(404).json({
        success: false,
        error: 'Ad not found'
      });
    }

    res.status(200).json({
      success: true,
      data: ad
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Track ad impression
router.post('/:id/impression', async (req, res) => {
  try {
    const ad = await Ad.findByIdAndUpdate(
      req.params.id,
      { $inc: { impressions: 1 } },
      { new: true }
    );

    if (!ad) {
      return res.status(404).json({
        success: false,
        error: 'Ad not found'
      });
    }

    res.status(200).json({
      success: true,
      data: ad
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 