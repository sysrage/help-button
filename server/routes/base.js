'use strict';

const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const chalk = require('chalk');
const express = require('express');
const Push = require('pushover-notifications');
const { WebSocketServer } = require('ws');
const webpush = require('web-push');

// eslint-disable-next-line
const router = express.Router();
const config = require('../config');

// State objects
let pushInterval = null;
let statusInterval = null;
let ackTimeout = null;
let resetTimeout;
const alertState = {
  status: 'ready',
  lastTrigger: null,
};

const sendAllPushover = () => {
  // Send Pushover notifications to all targets
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
    push.send({ ...pushMessage, user: config.pushoverTargets[i] }, (err, res) => {
      if (err) {
        console.error(`${chalk.red('[Error]')} Error sending Pushover alert:\n${err}`);
      } else {
        console.log(`${chalk.green('[Info]')} Successfully sent Pushover alert:\n${res}`);
      }
    });
  }
};

// TODO: read/write webPushSubscriptions to disk
const vapidDetails = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
  subject: process.env.VAPID_SUBJECT,
};
const loadWebPushSubscriptions = () => {
  try {
    const data = fs.readFileSync(path.resolve(__dirname, 'web-push-subscriptions.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.log(`${chalk.yellow('[Warning]')} Unable to read web-push-subscriptions.json:`, error);
    return [];
  }
};
const webPushSubscriptions = loadWebPushSubscriptions();
let writingWebPushSubscriptions = false;
const addWebPushSubscription = (subscription) => {
  if (writingWebPushSubscriptions) {
    setTimeout(() => addWebPushSubscription(subscription), 200);
    return;
  }
  webPushSubscriptions.push(subscription);
  writingWebPushSubscriptions = true;
  try {
    fs.writeFileSync(path.resolve(__dirname, 'web-push-subscriptions.json'), JSON.stringify(webPushSubscriptions));
  } catch (error) {
    console.log(`${chalk.red('[Error]')} Unable to write web-push-subscriptions.json:`, error);
  }
  writingWebPushSubscriptions = false;
};
const sendAllWebPush = async () => {
  // Send Web Push notifications to all targets

  // Create the notification content.
  const notification = JSON.stringify({
    title: 'Help Needed!',
    options: {
      body: 'The help button has been pressed.',
      icon: '/logo512.png',
    },
  });

  // Customize how the push service should attempt to deliver the push message.
  // And provide authentication information.
  const options = {
    TTL: 10000,
    vapidDetails
  };

  // Send a push message to each client specified in the subscriptions array.
  for (const subscription of webPushSubscriptions) {
    const { endpoint } = subscription;
    const id = endpoint.substr((endpoint.length - 8), endpoint.length);
    try {
      const result = await webpush.sendNotification(subscription, notification, options);
      if (result.statusCode !== 201) {
        console.log(`${chalk.yellow('[Warning]')} Unexpected status code sending Web Push notification (${result.statusCode}):`, result);
      }
    } catch (error) {
      console.log(`${chalk.red('[Error]')} Error sending Web Push:`, error);
    }
  };
};

const clearAlert = () => {
  alertState.status = 'ready';
  clearInterval(pushInterval);
  clearTimeout(ackTimeout);
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

const triggerAlert = () => {
  alertState.status = 'triggered';
  alertState.lastTrigger = new Date();
  sendAllPushover();
  sendAllWebPush();

  // Clear any existing timeouts
  if (resetTimeout) clearTimeout(resetTimeout);
  if (pushInterval) clearInterval(pushInterval);
  if (ackTimeout) clearTimeout(ackTimeout);

  // Re-send Pushover notice every 10 seconds
  pushInterval = setInterval(() => {
    sendAllPushover();
    sendAllWebPush();
  }, 10 * 1000);

  // Reset alert state if not acknowledged in 60 minutes
  ackTimeout = setTimeout(() => {
    console.log(`${chalk.green('[Info]')} Resetting alert state...`);
    clearAlert();
    console.log(`${chalk.green('[Info]')} New Alert State: ${JSON.stringify(alertState)}`);
  }, 60 * 60 * 1000);
};

/* WebSocket Setup */
const wsConnections = [];
const wss = new WebSocketServer({ server: global.httpServer });

wss.on('connection', (ws) => {
  const id = randomUUID();
  let wsAuthenticated = false;

  // Start a timeout to ensure authentication occurs within 20 seconds
  setTimeout(() => {
    if (!wsAuthenticated) {
      ws.send('Unauthorized');
      ws.close();
    }
  }, 20000);

  // Error handler
  ws.on('error', (error) => {
    console.error(error);
  });

  // Listen for messages
  ws.on('message', (data) => {
    // Validate proper message was sent
    const message = (() => {
      try {
        return JSON.parse(data.toString());
      } catch {
        return undefined;
      }
    })();

    if (!message) {
      console.log(`${chalk.yellow('[Warning]')} Invalid WebSocket request: ${data.toString()}`);
      if (!wsAuthenticated) {
        ws.send('Unauthorized');
        ws.close();
      }

      return;
    }

    // If user is not authenticated, ensure message is an authentication request
    if (!wsAuthenticated) {
      if (message.type === 'authenticate' && message.appToken === config.alertAppToken) {
        wsAuthenticated = true;
        // Add connection to connection list for tracking
        wsConnections.push({ id, ws });
        ws.send(JSON.stringify({ type: 'authenticate', status: 'success' }));

        return;
      }
      console.log(`${chalk.yellow('[Warning]')} Unauthorized WebSocket request: ${data.toString()}`);
      ws.send('Unauthorized');
      ws.close();

      return;
    }

    // Handle push notification registration messages
    if (message.type === 'register') {
      // TODO: clean up this verification
      if (
        !['endpoint', 'expirationTime', 'keys'].every((key) => Object.hasOwn(message.subscription, key)) ||
        !['p256dh', 'auth'].every((key) => Object.hasOwn(message.subscription.keys, key))
      ) {
        ws.send(JSON.stringify({ type: 'result', error: 'Invalid registration.' }));

        return;
      }

      // Save subscription information
      addWebPushSubscription(message.subscription);
      ws.send(JSON.stringify({ type: 'result', status: 'success', message: 'Web Push client has been registered.' }));

      console.log(`${chalk.green('[Info]')} New Web Push subscription added...`);

      return;
    }

    // Handle command messages
    if (message.type === 'command') {
      if (!message.command) {
        ws.send(JSON.stringify({ type: 'result', error: 'Invalid command.' }));

        return;
      }
      switch (message.command) {
        case 'acknowledge':
          if (alertState.status === 'ready' || alertState.status === 'acknowledged') {
            ws.send(JSON.stringify({ type: 'result', status: 'ignored', message: 'No alerts ready for acknowledgement.' }));

            return;
          }
          console.log(`${chalk.green('[Info]')} Current Alert State: ${JSON.stringify(alertState)}`);
          console.log(`${chalk.green('[Info]')} Alert state change has been requested...`);
          ackAlert();
          console.log(`${chalk.green('[Info]')} New Alert State: ${JSON.stringify(alertState)}`);
          ws.send(JSON.stringify({ type: 'result', status: 'success', message: 'Alert has been acknowledged.' }));

          return;
        case 'alert':
          if (alertState.status === 'triggered') {
            ws.send(JSON.stringify({ type: 'result', status: 'ignored', message: 'Alert was already triggered.' }));

            return;
          }
          console.log(`${chalk.green('[Info]')} Current Alert State: ${JSON.stringify(alertState)}`);
          console.log(`${chalk.green('[Info]')} Alert state change has been requested...`);
          triggerAlert();
          console.log(`${chalk.green('[Info]')} New Alert State: ${JSON.stringify(alertState)}`);
          ws.send(JSON.stringify({ type: 'result', status: 'success', message: 'Alert has been triggered.' }));

          return;
        default:
          ws.send(JSON.stringify({ type: 'result', error: 'Invalid command.' }));

          return;
      }
    }

    // Default response for unknown command
    console.log('received:', data.toString());
  });

  // Remove connection from connection list when closed
  ws.on('close', () => {
    wsConnections.splice(wsConnections.findIndex((c) => c.id === id), 1);
  });
});
// Send current button status every X seconds to all active WS connections
statusInterval = setInterval(() => {
  for (const connection of wsConnections) {
    connection.ws.send(JSON.stringify({ type: 'status', status: { ...alertState, connections: wsConnections.length } }));
  }
}, 1000);

/* REST Setup */
// # Add status endpoint
router.get('/status', (req, res) => {
  res.send(JSON.stringify(alertState));
});

// # Add login endpoint
router.post('/login', (req, res) => {
  // Reject the request if token doesn't match
  if (req.body.password !== config.alertAppToken) {
    res.status(401);

    return res.send({
      message: 'Invalid Application Token!',
      status: 'error',
    });
  }

  return res.send({ message: 'Success', status: 'success' });
});

// # Add register endpoint for push notifications
router.post('/register', (req, res) => {
  // Reject request if app token doesn't match
  if (req.body.appToken !== config.alertAppToken) {
    res.status(401);

    return res.send({
      message: 'Invalid Application Token!',
      status: 'error',
    });
  }

  console.log(`${chalk.green('[Info]')} New push subscription: ${JSON.stringify(req.body.subscription)}`);
  addWebPushSubscription(req.body.subscription);

  return res.send({
    message: 'Successfully registered for push notifications!',
    status: 'success',
  });
});

// # Add alert endpoint
router.post('/alert', (req, res) => {
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

  return res.send({
    message: 'Alert has been triggered!',
    status: 'triggered',
  });
});

// # Add admin endpoint
router.post('/admin', (req, res) => {
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

  return res.send({
    message: 'Invalid command.',
    status: 'error',
  });
});

// # Serve static client page for base routes
router.use([ '/admin', '/logout', '/' ], express.static(path.join(__dirname, '../../button/build/')));

// Cleanup when server is stopped
process.on('SIGINT', () => {
  console.log(`${chalk.green('[Info]')} Closing all WebSocket connections...`);
  for (const connection of wsConnections) {
    connection.ws.close();
  }
  wss.close();

  console.log(`${chalk.green('[Info]')} Clearing all timeouts...`);
  if (pushInterval) clearInterval(pushInterval);
  if (statusInterval) clearInterval(statusInterval);
  if (resetTimeout) clearTimeout(resetTimeout);
  if (ackTimeout) clearTimeout(ackTimeout);
});

module.exports = router;
