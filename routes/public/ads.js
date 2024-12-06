const express = require('express');
const router = express.Router();
const Ad = require('../../models/Ad');

// Get active ads for specific placement and audience
router.get('/', async (req, res) => {
  try {
    const { placement, userType } = req.query;
    const currentDate = new Date();

    // Validate userType
    if (!['tenant', 'agent', 'landlord'].includes(userType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user type'
      });
    }

    // Map user types to match schema
    const audienceType = {
      'tenant': 'tenants',
      'landlord': 'landlords',
      'agent': 'agents'
    }[userType];

    // Find ads
    const ads = await Ad.find({
      status: 'active',
      startDate: { $lte: new Date(currentDate.setHours(23, 59, 59)) }, // End of current day
      endDate: { $gte: new Date(currentDate.setHours(0, 0, 0)) }, // Start of current day
      placement: placement || 'sidebar',
      targetAudience: { $in: [audienceType] },
    })
    .select('_id title description image targetUrl placement')
    .sort('-createdAt')
    .limit(5);

    // For debugging, find all ads regardless of date
    const allAds = await Ad.find({
      status: 'active',
      placement: placement || 'sidebar',
      targetAudience: { $in: [audienceType] },
    }).select('_id title startDate endDate');

    // Increment impressions for fetched ads
    if (ads.length > 0) {
      await Ad.updateMany(
        { _id: { $in: ads.map(ad => ad._id) } },
        { $inc: { impressions: 1 } }
      );
    }

    res.status(200).json({
      success: true,
      data: ads,
      debug: {
        currentDate,
        queryParams: { placement, userType, audienceType },
        totalAdsFound: allAds.length
      }
    });
  } catch (error) {
    console.error('Ad fetch error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Track ad clicks
router.post('/click/:adId', async (req, res) => {
  try {
    const { adId } = req.params;
    
    await Ad.findByIdAndUpdate(adId, {
      $inc: { clicks: 1 }
    });

    res.status(200).json({
      success: true
    });
  } catch (error) {
    console.error('Ad click tracking error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;