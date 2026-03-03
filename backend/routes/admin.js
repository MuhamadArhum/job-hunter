/**
 * Admin Routes — user management & stats
 * All routes require auth + admin role
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const User = require('../models/User');
const Memory = require('../models/Memory');

// Apply both middlewares to all admin routes
router.use(authMiddleware, adminAuth);

/**
 * GET /api/admin/stats
 * Returns aggregate platform statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const [totalUsers, activeUsers, newUsersThisWeek] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ createdAt: { $gte: weekAgo } }),
    ]);

    // Sum all emailSentCount across users
    const emailAgg = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$emailSentCount' } } },
    ]);
    const emailsSent = emailAgg[0]?.total || 0;

    res.json({ success: true, stats: { totalUsers, activeUsers, emailsSent, newUsersThisWeek } });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * GET /api/admin/users
 * List users with search, status filter, pagination
 * Query: ?search=&status=all|active|inactive&page=1&limit=20
 */
router.get('/users', async (req, res) => {
  try {
    const { search = '', status = 'all', page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    if (status === 'active')   query.isActive = true;
    if (status === 'inactive') query.isActive = false;

    const [users, total] = await Promise.all([
      User.find(query)
        .select('name email role isActive lastLogin emailSentCount createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(query),
    ]);

    res.json({
      success: true,
      users,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    console.error('Admin list users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * GET /api/admin/users/:id
 * User detail + FTE state from Memory
 */
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('name email role isActive lastLogin emailSentCount createdAt');
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Fetch FTE state from memory
    const fteState = await Memory.findOne({
      userId: user._id,
      memoryType: 'long_term',
      category: 'fte_state',
      key: 'current',
    });

    const historyCount = await Memory.countDocuments({
      userId: user._id,
      category: 'fte_history',
    });

    res.json({
      success: true,
      user,
      fteState: fteState?.value?.state || null,
      historyCount,
    });
  } catch (error) {
    console.error('Admin get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

/**
 * PATCH /api/admin/users/:id/status
 * Toggle user isActive status
 * Body: { isActive: boolean }
 */
router.patch('/users/:id/status', async (req, res) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be a boolean' });
    }

    // Prevent admin from deactivating themselves
    if (req.params.id === String(req.user._id)) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true, select: 'name email role isActive lastLogin emailSentCount createdAt' }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ success: true, user });
  } catch (error) {
    console.error('Admin toggle status error:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

module.exports = router;
