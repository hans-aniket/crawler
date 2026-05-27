const express = require('express');
const router = express.Router();
const { crawlPage, getJobStatus, getRecentJobs, getAllJobs, getAnalytics } = require('../controllers/crawlController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/', authMiddleware, crawlPage);
router.get('/history', authMiddleware, getRecentJobs);
router.get('/jobs', authMiddleware, getAllJobs);
router.get('/analytics', authMiddleware, getAnalytics);
router.get('/:jobId', authMiddleware, getJobStatus);

module.exports = router;
