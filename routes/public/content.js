const express = require('express');
const router = express.Router();
const Content = require('../../models/Content');
const { adminMiddleware } = require('../../middleware');

// Create new content (Admin only)
router.post('/', adminMiddleware, async (req, res) => {
  try {
    const { type, title, body, link } = req.body;
    const content = new Content({
      type,
      title,
      body,
      link,
      createdBy: req.admin._id,
    });
    await content.save();
    res.status(201).json({ success: true, data: content });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update content (Admin only)
router.put('/:id', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { type, title, body, link } = req.body;
    
    const content = await Content.findByIdAndUpdate(
      id,
      { type, title, body, link },
      { new: true }
    );
    
    if (!content) {
      return res.status(404).json({ success: false, error: 'Content not found' });
    }
    
    res.status(200).json({ success: true, data: content });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete content (Admin only)
router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const content = await Content.findByIdAndDelete(id);
    
    if (!content) {
      return res.status(404).json({ success: false, error: 'Content not found' });
    }
    
    res.status(200).json({ success: true, data: content });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all content
router.get('/', async (req, res) => {
  try {
    const content = await Content.find()
      .sort('-createdAt')
      .populate('createdBy', 'firstName lastName email');
    res.status(200).json({ success: true, data: content });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router; 