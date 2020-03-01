const path = require('path');
const moment = require('moment');

// # Server Configuration
module.exports = {
  port: process.env.PORT || 4000,

  jwtSecretKey: process.env.JWT_SECRET || 'top_secret',

  helpServerLogDir: path.join(__dirname, 'logs/'), // Log directory
  helpServerLogFile: `help-button-server-${moment().format('YYYYMMDDhhmmss')}.log`, // Application Log filename

  pushoverAppToken: process.env.PO_APP_TOKEN || '',

  pushoverTargets: process.env.PO_TARGETS ? process.env.PO_TARGETS.split(',') : [],

  alertAppToken: process.env.ALERT_APP_TOKEN || 'top_secret_alert_token',

};
