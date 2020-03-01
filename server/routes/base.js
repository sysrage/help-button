const express = require('express');
const path = require('path');
const Push = require('pushover-notifications');

const router = express.Router();
const config = require('../config');

// State objects
let pushTimer = null;
let ackTimer = null;
const alertState = {
  status: 'ready',
  lastTrigger: null,
}

const sendPush = () => {
  // Send Pushover notifications
  const push = new Push({
    token: config.pushoverAppToken,
  });

  const pushMessage = {
    message: 'The help button has been pressed.',
    title: 'Help Needed!',
    sound: 'siren',
    priority: 1,
  };

  // Send alert to each Pushover target
  for (let i = 0; i < config.pushoverTargets.length; i++) {
    push.send({...pushMessage, user: config.pushoverTargets[i]}, (err, res) => {
      if (err) {
        console.log('***fix-error: Error sending Pushover alert.');
        console.log(err);
      } else {
        console.log('***fix-info: Successfully sent Pushover alert.')
        console.log(res);
      }
    });
  }
}

const triggerAlert = () => {
  alertState.status = 'triggered';
  alertState.lastTrigger = new Date();
  sendPush();

  // Re-send Pushover notice every 10 seconds
  pushTimer = setInterval(() => {
    sendPush();
  }, 10 * 1000);

  // Reset alert state if not acknowledged in 60 minutes
  ackTimer = setTimeout(() => {
    clearAlert();
  }, 60 * 60 * 1000);

}

const ackAlert = () => {
  alertState.status = 'acknowledged';
  clearInterval(pushTimer);
  clearInterval(ackTimer);
}

const clearAlert = () => {
  alertState.status = 'ready';
  clearInterval(pushTimer);
  clearTimeout(ackTimer);
}

// # Add alert endpoint
router.post('/alert', (req, res, next) => {
  console.log('alertState', alertState);
  // Reject request if app token doesn't match
  if (req.body.appToken !== config.alertAppToken) {
    return res.send({
      message: 'Invalid Application Token!',
      status: 'error',
    });
  }

  console.log('***fix-info: alert has been requested');
  // App Token matches, check if alert already triggered
  if (alertState.status === 'triggered') {
    return res.send({
      message: 'Alert already triggered.',
      status: 'ignored',
    });
  }

  // Trigger an alert
  console.log('***fix-info: alert has been triggered');
  triggerAlert();
  console.log('alertState', alertState);

  res.send({
    message: 'Alert has been triggered!',
    status: 'triggered',
  });
});

// # Add admin endpoint
router.post('/admin', (req, res, next) => {
  console.log('alertState', alertState);
  // Reject request if app token doesn't match
  if (req.body.appToken !== config.alertAppToken) {
    return res.send({
      message: 'Invalid Application Token!',
      status: 'error',
    });
  }

  if (req.body.command === 'acknowledge') {
    console.log('***fix-info: acknowledgement has been requested');
    // App Token matches, check if alert not triggered or already acknowledged
    if (alertState.status === 'ready' || alertState.status === 'acknowledged') {
      return res.send({
        message: 'No alerts ready for acknowledgement.',
        status: 'ignored',
      });
    }

    // Acknowledge the alert
    console.log('***fix-info: alert has been triggered');
    ackAlert();
    console.log('alertState', alertState);

    setTimeout(() => {
      // Reset alert state after 2 minutes
      console.log('***fix-info: alert has been cleared');
      clearAlert();
      console.log('alertState', alertState);
    }, 2 * 60 * 1000);

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
