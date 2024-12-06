const express = require('express');
const { authMiddleware } = require('../../middleware');
const Eviction = require('../../models/Eviction');
const router = express.Router();
const multer = require('multer');

const upload = multer();

// Create a new eviction
router.post('/create', authMiddleware, upload.array('documents'), async (req, res) => {
  try {
    const {
      tenant,
      property,
      reason,
      noticeDate,
      scheduledEvictionDate,
      notes
    } = req.body;

    const documents = req.files ? req.files.map(file => ({
      filename: file.originalname,
      path: file.buffer.toString('base64') // Store as base64 string, or use a file storage service
    })) : [];

    const evictionData = {
      tenant,
      property,
      landlord: req.landlord._id,
      reason,
      noticeDate: new Date(noticeDate),
      scheduledEvictionDate: new Date(scheduledEvictionDate),
      documents
    };

    // Only add notes if it's not an empty string
    if (notes && notes.trim() !== '') {
      evictionData.notes = notes;
    }

    const newEviction = new Eviction(evictionData);

    await newEviction.save();

    res.status(201).json({
      message: 'Eviction notice created successfully',
      eviction: newEviction
    });
  } catch (error) {
    console.error('Create eviction error:', error);
    res.status(400).json({ message: 'Error creating eviction notice', error: error.message });
  }
});

// Get all evictions (with optional filtering)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const evictions = await Eviction.find({ landlord: req.landlord._id })
      .populate('tenant', 'firstName lastName')
      .populate('property', 'address')
      .populate('landlord', 'personalInfo.firstName personalInfo.lastName contactInfo.email contactInfo.phoneNumber');
    res.json(evictions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add this new route
router.get('/tenant', authMiddleware, async (req, res) => {
  try {
    const evictions = await Eviction.find({ tenant: req.tenant._id })
      .populate('property', 'address')
      .populate('landlord', 'personalInfo.firstName personalInfo.lastName')
      .sort({ noticeDate: -1 }) // Sort by notice date, most recent first
      .lean();

    res.json(evictions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching eviction notices', error: error.message });
  }
});

// Get a specific eviction
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const eviction = await Eviction.findById(req.params.id)
      .populate('tenant', 'firstName lastName')
      .populate('property', 'address')
      .populate('landlord', 'firstName lastName');
    if (!eviction) return res.status(404).json({ message: 'Eviction not found' });
    res.json(eviction);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update an eviction
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const eviction = await Eviction.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!eviction) return res.status(404).json({ message: 'Eviction not found' });
    res.json(eviction);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete an eviction
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const eviction = await Eviction.findByIdAndDelete(req.params.id);
    if (!eviction) return res.status(404).json({ message: 'Eviction not found' });
    res.json({ message: 'Eviction deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add a note to an eviction
router.post('/:id/notes', authMiddleware, async (req, res) => {
  try {
    const eviction = await Eviction.findById(req.params.id);
    if (!eviction) return res.status(404).json({ message: 'Eviction not found' });
    eviction.notes.push({
      date: new Date(),
      content: req.body.content,
      author: req.user._id  // Assuming the authenticated user's ID is available
    });
    await eviction.save();
    res.status(201).json(eviction);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
