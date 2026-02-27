require('dotenv').config(); // Must be FIRST — loads env vars before anything else

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting for email sending
const emailLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: process.env.MAX_EMAILS_PER_DAY || 20,
  message: {
    error: 'Email limit exceeded. You can send up to 20 emails per day.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/job-application-agent', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/cover-letter', require('./routes/coverLetter'));
app.use('/api/email', emailLimiter, require('./routes/email'));
app.use('/api/test', require('./routes/test'));
app.use('/api/orchestrator', require('./routes/orchestrator'));
app.use('/api/pipeline', require('./routes/pipeline'));
app.use('/api/fte', require('./routes/fte'));

// File upload handling
app.use('/uploads', express.static('uploads'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  // ── Verify email service on startup ────────────────────────────────────────
  try {
    const { emailService } = require('./services/emailService');
    const ok = await emailService.verifyConnection();
    if (ok) {
      console.log(`✅ Email service ready — ${process.env.EMAIL_USER}`);
    } else {
      console.warn(`⚠️  Email service NOT connected — check EMAIL_USER / EMAIL_PASS in .env`);
    }
  } catch (e) {
    console.warn(`⚠️  Email service error: ${e.message}`);
  }

  // ── Confirm API keys ────────────────────────────────────────────────────────
  console.log(`🔑 SERPAPI_KEY: ${process.env.SERPAPI_KEY ? '✅ set' : '❌ MISSING'}`);
  console.log(`🔑 GROQ_API_KEY: ${process.env.GROQ_API_KEY ? '✅ set' : '❌ MISSING'}`);
  console.log(`🔑 EMAIL_USER: ${process.env.EMAIL_USER || '❌ MISSING'}`);
});

module.exports = app;