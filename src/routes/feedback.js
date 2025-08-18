// routes/feedback.js (for public feedback submit)
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController'); 

router.post('/', adminController.submitFeedback);

module.exports = router;


