const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Agent = require('../../models/Agent');
const AgentStatsService = require('../../services/agentStatsService');

// Middleware to protect routes
const protect = async (req, res, next) => {
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.agent = await Agent.findById(decoded.id).select('-password');
      next();
    } catch (error) {
      res.status(401).json({ success: false, message: 'Not authorized' });
    }
  }

  if (!token) {
    res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }
};

// @desc    Get agent's sales revenue stats
// @route   GET /api/agents/stats/revenue
// @access  Private
router.get('/stats/revenue', protect, async (req, res) => {
  try {
    const stats = await AgentStatsService.getSalesRevenue(req.agent._id);
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Get agent's client stats
// @route   GET /api/agents/stats/clients
// @access  Private
router.get('/stats/clients', protect, async (req, res) => {
  try {
    const stats = await AgentStatsService.getClientStats(req.agent._id);
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Get agent's location stats
// @route   GET /api/agents/stats/locations
// @access  Private
router.get('/stats/locations', protect, async (req, res) => {
  try {
    const stats = await AgentStatsService.getLocationStats(req.agent._id);
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router; 