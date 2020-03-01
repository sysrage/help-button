const express = require('express');

const router = express.Router();

const path = require('path');

const config = require('../config');

// # Add alert endpoint
router.post('/alert', async (req, res, next) => {
  // Reject request if app token doesn't match
  if (req.body.appToken !== config.alertAppToken) {
    return res.send({
      message: 'Invalid Application Token!',
      status: 'error'
    });
  }

  console.log('***fix-info: alert has been requested');
  // App Token matches, check if alert already triggered

  res.send({ 
    message: 'Alert has been triggered!',
    status: 'triggered'
  });
});

// # Serve static client page for base routes
router.use(['/admin', '/'], express.static(path.join(__dirname, '../../button/build/')));

module.exports = router;
