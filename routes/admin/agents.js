const express = require('express');
const router = express.Router();
const Agent = require('../../models/Agent');
const { adminMiddleware } = require('../../middleware');
const sendEmail = require('../../utils/sendEmail');

// Create a new agent
router.post('/', adminMiddleware, async (req, res) => {
  try {
    const agent = new Agent({
      ...req.body
    });

    await agent.save();

    // Send welcome email with login credentials
    await sendEmail({
      email: agent.email,
      subject: 'Welcome to Hatenant',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <img src="${process.env.FRONTEND_URL}/images/logo.png" alt="Hatenant Logo" style="max-width: 200px; margin-bottom: 20px;">
          <h1 style="color: #333; margin-bottom: 20px;">Welcome to Hatenant!</h1>
          <p style="color: #666; line-height: 1.6;">Dear ${agent.firstName},</p>
          <p style="color: #666; line-height: 1.6;">We're thrilled to have you join our growing community of real estate professionals. Your account has been successfully created, and you can now access our platform to manage properties, interact with tenants, and grow your business.</p>

          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h2 style="color: #333; margin-bottom: 15px;">Your Login Credentials</h2>
            <p style="color: #666; margin: 5px 0;"><strong>Email:</strong> ${agent.email}</p>
            <p style="color: #666; margin: 5px 0;"><strong>Password:</strong> ${req.body.password}</p>
            <a href="${process.env.FRONTEND_URL}/agent/login" style="display: inline-block; background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px;">Login to Your Account</a>
          </div>
          
          <div style="margin: 20px 0;">
            <h3 style="color: #333;">Important Security Steps:</h3>
            <ul style="color: #666; line-height: 1.6;">
              <li>Log in to your account as soon as possible</li>
              <li>Change your password immediately after your first login</li>
              <li>Set up your profile with complete information</li>
              <li>Review our agent guidelines and best practices</li>
            </ul>
          </div>
          
          <div style="margin: 20px 0;">
            <h3 style="color: #333;">Platform Features:</h3>
            <ul style="color: #666; line-height: 1.6;">
              <li>Property management dashboard</li>
              <li>Tenant communication tools</li>
              <li>Commission tracking</li>
              <li>Document management</li>
              <li>Automated reporting</li>
            </ul>
          </div>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #333;">Need Help?</h3>
            <p style="color: #666; line-height: 1.6;">Our support team is here to assist you:</p>
            <p style="color: #666; line-height: 1.6;">
              Email: <a href="mailto:support@hathorcoast.com" style="color: #007bff;">support@hathorcoast.com</a><br>
              Phone: ${process.env.SUPPORT_PHONE || '+1 (555) 123-4567'}<br>
              Support Hours: Monday to Friday, 9 AM - 5 PM EST
            </p>
          </div>
          
          <p style="color: #666; line-height: 1.6;">We look forward to supporting your success at Hatenant!</p>
          
          <p style="color: #666; line-height: 1.6;">
            Best regards,<br>
            The Hatenant Team
          </p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999;">
            <p>This email contains confidential information. If you're not the intended recipient, please notify us immediately.</p>
          </div>
        </div>
      `.trim()
    });

    res.status(201).json({
      success: true,
      data: agent
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get all agents
router.get('/', adminMiddleware, async (req, res) => {
  try {
    const agents = await Agent.find().select('-password');
    res.status(200).json({
      success: true,
      count: agents.length,
      data: agents
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get single agent
router.get('/:id', adminMiddleware, async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.id).select('-password');
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }
    res.status(200).json({
      success: true,
      data: agent
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Update agent
router.put('/:id', adminMiddleware, async (req, res) => {
  try {
    const agent = await Agent.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).select('-password');
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }
    res.status(200).json({
      success: true,
      data: agent
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Delete agent
router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    const agent = await Agent.findByIdAndDelete(req.params.id);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
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

// Add this new route before module.exports
router.get('/rankings/performance', async (req, res) => {
  try {
    const { limit = 10, period = 'all' } = req.query;
    
    let dateFilter = {};
    const now = new Date();
    
    // Add date filtering based on period
    switch (period) {
      case 'month':
        dateFilter = {
          createdAt: {
            $gte: new Date(now.getFullYear(), now.getMonth(), 1)
          }
        };
        break;
      case 'quarter':
        dateFilter = {
          createdAt: {
            $gte: new Date(now.getFullYear(), now.getMonth() - 3, 1)
          }
        };
        break;
      case 'year':
        dateFilter = {
          createdAt: {
            $gte: new Date(now.getFullYear(), 0, 1)
          }
        };
        break;
      // 'all' doesn't need a date filter
    }

    const topAgents = await Agent.find({
      ...dateFilter,
      status: 'active' // Only include active agents
    })
    .select('firstName lastName email businessName commission.totalEarned commission.balance avatar')
    .sort({ 'commission.totalEarned': -1 }) // Sort by highest earnings
    .limit(Number(limit));

    // Calculate additional metrics for each agent
    const agentsWithMetrics = topAgents.map(agent => ({
      _id: agent._id,
      firstName: agent.firstName,
      lastName: agent.lastName,
      email: agent.email,
      businessName: agent.businessName,
      avatar: agent.avatar,
      metrics: {
        totalEarned: agent.commission.totalEarned,
        currentBalance: agent.commission.balance,
        averageEarningsPerMonth: period === 'all' 
          ? agent.commission.totalEarned / Math.max(1, Math.floor((new Date() - agent.createdAt) / (30 * 24 * 60 * 60 * 1000)))
          : agent.commission.totalEarned / (period === 'month' ? 1 : period === 'quarter' ? 3 : 12)
      }
    }));

    res.status(200).json({
      success: true,
      count: agentsWithMetrics.length,
      data: agentsWithMetrics
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Fetch agents with withdrawal requests
router.get('/agents-with-withdrawals', async (req, res) => {
  try {
    const agents = await Agent.find({ 
      'commission.withdrawalHistory': { $exists: true, $ne: [] }
    })
    .select('firstName lastName email commission.withdrawalHistory commission.withdrawalSettings');
    
    res.status(200).json(agents);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch agents with withdrawals' });
  }
});

module.exports = router;
