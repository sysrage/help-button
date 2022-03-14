// ## Help Button -- Web / API Server
const chalk = require('chalk');
const express = require('express');
const stoppable = require('stoppable');

// Read environment variables from .env file
require('dotenv').config()
console.log('process.env', JSON.stringify(process.env, null, 2));

const config = require('./config');
const debugEnabled = ['-debug', '--debug'].some(d => process.argv.includes(d));

console.log(`${chalk.cyan('Starting Help Button API Server...')}\n`
+ '  _   _      _        ______       _   _               \n'
+ ' | | | |    | |       | ___ \\     | | | |             \n'
+ ' | |_| | ___| |_ __   | |_/ /_   _| |_| |_ ___  _ __  \n'
+ ' |  _  |/ _ \\ | \'_ \\  | ___ \\ | | | __| __/ _ \\| \'_ \\ \n'
+ ' | | | |  __/ | |_) | | |_/ / |_| | |_| || (_) | | | |\n'
+ ' \\_| |_/\\___|_| .__/  \\____/ \\__,_|\\__|\\__\\___/|_| |_|\n'
+ '              | |                                     \n'
+ '              |_|                                     \n'
);


// # Express (Web Server) Setup
if (debugEnabled) console.log(`${chalk.yellow('[Debug]')} Creating express server object...`);
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Enable CORS for all HTTP methods in development
if (process.env.NODE_ENV !== 'production') {
  console.log(`${chalk.yellow('[Warning]')} Development Environment - Enabling CORS for all requests`);
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });
}

// Add unsecure base routes
const baseRoutes = require('./routes/base');

app.use('/', baseRoutes);

// Express error handling
app.use((err, req, res, next) => {
  if (err) {
    console.error(`${chalk.red('[Error]')} Express error encountered:\n${err.stack}`);
    res.status(500).send('Something broke!');
  }
});

const server = stoppable(app.listen(config.port, () => {
  console.log(`${chalk.green('[Info]')} Server listening on port: ${config.port}`);
}));


// # Function to gracefully shutdown
const shutDown = () => {
  console.log(`${chalk.green('[Info]')} Shutting down server...`);
  server.stop();
  server.close(() => {
    console.log(`${chalk.green('[Info]')} Server has been stopped.`);
      process.exit(0);
  });
};
process.on('SIGINT', shutDown);
process.on('SIGTERM', shutDown);

module.exports = app;
