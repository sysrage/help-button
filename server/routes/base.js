const path = require('path');

const chalk = require('chalk');
const express = require('express');
const Push = require('pushover-notifications');

const router = express.Router();
const config = require('../config');

// State objects
let pushInterval = null;
let ackTimeout = null;
let resetTimeout;
const alertState = {
  status: 'ready',
  lastTrigger: null,
};

const sendPush = () => {
  // Send Pushover notifications
  const push = new Push({
    token: config.pushoverAppToken,
  });

  const pushMessage = {
    message: 'The help button has been pressed.',
    title: 'Help Needed!',
    sound: 'gamelan',
    priority: 1,
  };

  // Send alert to each Pushover target
  for (let i = 0; i < config.pushoverTargets.length; i++) {
    push.send({...pushMessage, user: config.pushoverTargets[i]}, (err, res) => {
      if (err) {
        console.error(`${chalk.red('[Error]')} Error sending Pushover alert:\n${err}`);
      } else {
        console.log(`${chalk.green('[Info]')} Successfully sent Pushover alert:\n${res}`);
      }
    });
  }
};

const triggerAlert = () => {
  alertState.status = 'triggered';
  alertState.lastTrigger = new Date();
  sendPush();

  // Clear any existing timeouts
  if (resetTimeout) clearTimeout(resetTimeout);
  if (pushInterval) clearInterval(pushInterval);
  if (ackTimeout) clearTimeout(ackTimeout);

  // Re-send Pushover notice every 10 seconds
  pushInterval = setInterval(() => {
    sendPush();
  }, 10 * 1000);

  // Reset alert state if not acknowledged in 60 minutes
  ackTimeout = setTimeout(() => {
    console.log(`${chalk.green('[Info]')} Resetting alert state...`);
    clearAlert();
    console.log(`${chalk.green('[Info]')} New Alert State: ${JSON.stringify(alertState)}`);
  }, 60 * 60 * 1000);
};

const ackAlert = () => {
  alertState.status = 'acknowledged';

  // Clear any existing timeouts
  if (pushInterval) clearInterval(pushInterval);
  if (resetTimeout) clearTimeout(resetTimeout);
  if (ackTimeout) clearTimeout(ackTimeout);

  resetTimeout = setTimeout(() => {
    // Reset alert state after 2 minutes
    console.log(`${chalk.green('[Info]')} Resetting alert state...`);
    clearAlert();
    console.log(`${chalk.green('[Info]')} New Alert State: ${JSON.stringify(alertState)}`);
  }, 2 * 60 * 1000);
};

const clearAlert = () => {
  alertState.status = 'ready';
  clearInterval(pushInterval);
  clearTimeout(ackTimeout);
};

// Cleanup when server is stopped
process.on('SIGINT', () => {
  console.log(`${chalk.green('[Info]')} Clearing all timeouts...`);
  if (pushInterval) clearInterval(pushInterval);
  if (resetTimeout) clearTimeout(resetTimeout);
  if (ackTimeout) clearTimeout(ackTimeout);
});

// # Add status endpoint
router.get('/status', (req, res, next) => {
  res.send(JSON.stringify(alertState));
});

// # Add login endpoint
router.post('/login', (req, res, next) => {
  // Reject the request if token doesn't match
  if (req.body.password !== config.alertAppToken) {
    res.status(401);
    return res.send({
      message: 'Invalid Application Token!',
      status: 'error'
    });
  }
  res.send({ message: 'Success', status: 'success' });
});

// # Add alert endpoint
router.post('/alert', (req, res, next) => {
  // Reject request if app token doesn't match
  if (req.body.appToken !== config.alertAppToken) {
    res.status(401);
    return res.send({
      message: 'Invalid Application Token!',
      status: 'error',
    });
  }

  console.log(`${chalk.green('[Info]')} Current Alert State: ${JSON.stringify(alertState)}`);
  console.log(`${chalk.green('[Info]')} Alert state change has been requested...`);
  // App Token matches, check if alert already triggered
  if (alertState.status === 'triggered') {
    return res.send({
      message: 'Alert already triggered.',
      status: 'ignored',
    });
  }

  // Trigger an alert
  triggerAlert();
  console.log(`${chalk.green('[Info]')} New Alert State: ${JSON.stringify(alertState)}`);

  res.send({
    message: 'Alert has been triggered!',
    status: 'triggered',
  });
});

// # Add admin endpoint
router.post('/admin', (req, res, next) => {
  // Reject request if app token doesn't match
  if (req.body.appToken !== config.alertAppToken) {
    res.status(401);
    return res.send({
      message: 'Invalid Application Token!',
      status: 'error',
    });
  }

  console.log(`${chalk.green('[Info]')} Current Alert State: ${JSON.stringify(alertState)}`);
  if (req.body.command === 'acknowledge') {
    console.log(`${chalk.green('[Info]')} Alert acknowledgement has been requested...`);
    // App Token matches, check if alert not triggered or already acknowledged
    if (alertState.status === 'ready' || alertState.status === 'acknowledged') {
      return res.send({
        message: 'No alerts ready for acknowledgement.',
        status: 'ignored',
      });
    }

    // Acknowledge the alert
    ackAlert();
    console.log(`${chalk.green('[Info]')} New Alert State: ${JSON.stringify(alertState)}`);

    return res.send({
      message: 'Alert has been acknowledged.',
      status: 'acknowledged',
    });
  }

  res.send({
    message: 'Invalid command.',
    status: 'error',
  });

});

// # Serve static client page for base routes
router.use(['/admin', '/'], express.static(path.join(__dirname, '../../button/build/')));

module.exports = router;
