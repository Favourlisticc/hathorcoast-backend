const express = require('express');
const router = express.Router();
const Task = require('../../models/Task');
const Agent = require('../../models/Agent');
const { adminMiddleware } = require('../../middleware');

// Create a new task
router.post('/', adminMiddleware, async (req, res) => {
  try {
    // First check if there are agents available
    const agentsCount = await Agent.countDocuments();
    if (agentsCount === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot create tasks: No agents available in the system'
      });
    }

    // Validate required fields
    const requiredFields = ['title', 'description', 'deadline'];
    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({
          success: false,
          error: `${field} is required`
        });
      }
    }
    
    // Create task with validated data
    const taskData = {
      ...req.body,
      createdBy: req.admin._id,
      status: 'pending'
    };

    const task = new Task(taskData);
    await task.save();

    res.status(201).json({
      success: true,
      data: task
    });
  } catch (error) {
    console.error('Task creation error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create task'
    });
  }
});

// Get all tasks
router.get('/', adminMiddleware, async (req, res) => {
  try {
    const tasks = await Task.find()
      .populate('assignedTo', 'firstName lastName email')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Update task
router.put('/:id', adminMiddleware, async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
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

// Delete task
router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

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

module.exports = router; 