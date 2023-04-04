'use strict';

const path = require('path');

const chalk = require('chalk');
const express = require('express');
const Push = require('pushover-notifications');
const { randomUUID } = require('crypto');
const { WebSocketServer } = require('ws');

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
    push.send({ ...pushMessage, user: config.pushoverTargets[i] }, (err, res) => {
      if (err) {
        console.error(`${chalk.red('[Error]')} Error sending Pushover alert:\n${err}`);
      } else {
        console.log(`${chalk.green('[Info]')} Successfully sent Pushover alert:\n${res}`);
      }
    });
  }
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
