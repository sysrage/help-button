const path = require('path');

// # Server Configuration
module.exports = {
  port: process.env.PORT || 4000,

  pushoverAppToken: process.env.PO_APP_TOKEN || '',

  pushoverTargets: process.env.PO_TARGETS ? process.env.PO_TARGETS.split(',') : [],

  alertAppToken: process.env.ALERT_APP_TOKEN || 'top_secret_alert_token',

};
