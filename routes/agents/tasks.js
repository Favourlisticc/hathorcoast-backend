const express = require('express');
const router = express.Router();
const Task = require('../../models/Task');
const Agent = require('../../models/Agent');
const jwt = require('jsonwebtoken');

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

// Get all available tasks for the agent
router.get('/', protect, async (req, res) => {
  try {
    const tasks = await Task.find({
      $or: [
        { assignedTo: { $in: [req.agent._id] } }, // Tasks assigned to this agent
        { assignedTo: { $size: 0 } } // Tasks not assigned to anyone
      ],
      status: { $ne: 'completed' }
    }).sort('-createdAt');

    res.status(200).json({
      success: true,
      data: tasks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Accept a task
router.post('/:taskId/accept', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    // Check if task is already assigned
    if (task.assignedTo.length > 0 && !task.assignedTo.includes(req.agent._id)) {
      return res.status(400).json({
        success: false,
        error: 'Task is already assigned to other agents'
      });
    }

    // Add agent to assignedTo if not already there
    if (!task.assignedTo.includes(req.agent._id)) {
      task.assignedTo.push(req.agent._id);
      task.status = 'in_progress';
      await task.save();
    }

    res.status(200).json({
      success: true,
      data: task
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Update task progress
router.put('/:taskId/progress', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    // Verify agent is assigned to this task
    if (!task.assignedTo.includes(req.agent._id)) {
      return res.status(403).json({
        success: false,
        error: 'You are not assigned to this task'
      });
    }

    // Update progress
    const newProgress = Number(req.body.progress);
    if (isNaN(newProgress) || newProgress < task.requirements.current) {
      return res.status(400).json({
        success: false,
        error: 'Invalid progress value'
      });
    }

    task.requirements.current = newProgress;

    // Check if task is completed
    if (task.requirements.current >= task.requirements.target) {
      task.status = 'completed';
      task.completedAt = new Date();

      // Add bonus to agent's commission
      await req.agent.updateOne({
        $inc: {
          'commission.balance': task.bonus,
          'commission.totalEarned': task.bonus
        }
      });
    }

    await task.save();

    res.status(200).json({
      success: true,
      data: task
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get agent's task history
router.get('/history', protect, async (req, res) => {
  try {
    const tasks = await Task.find({
      assignedTo: req.agent._id
    }).sort('-createdAt');

    res.status(200).json({
      success: true,
      data: tasks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 