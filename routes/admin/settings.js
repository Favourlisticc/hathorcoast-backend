const express = require('express');
const router = express.Router();
const SystemSetting = require('../../models/SystemSetting');
const { adminMiddleware } = require('../../middleware');

// Get all system settings
router.get('/settings', adminMiddleware, async (req, res) => {
  try {
    const settings = await SystemSetting.find();
    const settingsObject = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});
    res.json(settingsObject);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching system settings', error: error.message });
  }
});

// Update system settings
router.put('/settings', adminMiddleware, async (req, res) => {
  try {
    const updates = Object.entries(req.body).map(([key, value]) => ({
      updateOne: {
        filter: { key },
        update: { $set: { value, updatedBy: req.admin._id } },
        upsert: true
      }
    }));

    await SystemSetting.bulkWrite(updates);
    res.json({ message: 'System settings updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating system settings', error: error.message });
  }
});

module.exports = router;
