const express = require('express');
const router = express.Router();
const Task = require('../../models/Task');
const Agent = require('../../models/Agent');
const { adminMiddleware } = require('../../middleware');

// Create a new task
router.post("/", adminMiddleware, async (req, res) => {
  try {
    const { task, deadline, userType } = req.body;
    // console.log(task, deadline, userType);

    // Validate required fields
    if (!task || !deadline || !userType) {

      return res.status(400).json({
        success: false,
        error: "Title, description, and deadline are required",
      });
    }


    // Create task
    const tasks = new Task({
      task,
      deadline,
      assignedTo: userType,
      status: "pending",
    });

    await tasks.save();


    res.status(201).json({
      success: true,
      message: "Task created successfully",
      data: tasks,
    });
  } catch (error) {
    console.log("Task creation error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create task",
    });
  }
});

// Fetch tasks route
router.get("/foradmin", async (req, res) => {
  try {
    const tasks = await Task.find().sort({ deadline: 1 }); // Sort by deadline

   
    res.status(200).json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch tasks",
    });
  }
});


// Get all tasks
router.get('/', async (req, res) => {
  try {
    const tasks = await Task.find()
    

    res.status(200).json({
      success: true,
      count: tasks.length,
      tasks
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