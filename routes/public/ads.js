const express = require('express');
const router = express.Router();
const Ad = require('../../models/Ad');

// Get active ads for specific placement and audience
router.get('/', async (req, res) => {
  try {
    const currentDate = new Date();

    const ads = await Ad.find({
      status: 'active',
      startDate: { $lte: new Date(currentDate.setHours(23, 59, 59)) },
      endDate: { $gte: new Date(currentDate.setHours(0, 0, 0)) },
    })
    .select('_id title description image targetUrl')
    .sort('-createdAt')
    .limit(5);

    if (ads.length > 0) {
      await Ad.updateMany(
        { _id: { $in: ads.map(ad => ad._id) } },
        { $inc: { impressions: 1 } }
      );
    }


    res.status(200).json({
      success: true,
      data: ads
    });
  } catch (error) {
    console.log(error)
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