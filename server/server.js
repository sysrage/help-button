// ## Help Button -- Web / API Server

// const fs = require('fs');
// const path = require('path');

const express = require('express');

// const winston = require('winston');
// const expressWinston = require('express-winston');

const config = require('./config');

// # Winston (Logger) Setup
// if (!fs.existsSync(config.helpServerLogDir)) {
//   try {
//     fs.mkdirSync(config.helpServerLogDir);
//   } catch (error) {
//     console.error(`Error creating log directory: ${error.message}`);
//     process.exit(1);
//   }
// }
// winston.loggers.add('mainLogger', {
//   transports: [
//     new winston.transports.Console({
//       level: 'info',
//       format: winston.format.combine(
//         winston.format.colorize(),
//         winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
//         winston.format.printf((info) => `[${info.timestamp}] ${info.level}: ${info.message}`),
//       ),
//       handleExceptions: true,
//     }),
//     new winston.transports.File({
//       level: 'debug',
//       format: winston.format.combine(
//         winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
//         winston.format.printf((info) => `[${info.timestamp}] ${info.level}: ${info.message}`),
//       ),
//       filename: path.join(config.helpServerLogDir, config.helpServerLogFile),
//       handleExceptions: true,
//     }),
//   ],
// });
// const logger = winston.loggers.get('mainLogger');

// logger.info('Help Button API Server\n'
console.log('Starting Help Button API Server\n'
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
// logger.debug('Creating express server object');
console.log('***fix-debug: Creating express server object');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// **TODO: should this be writing to the same log file?
// app.use(expressWinston.logger({
//   transports: [
//     new winston.transports.File({
//       format: winston.format.combine(
//         winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
//         winston.format.printf((info) => `[${info.timestamp}] debug-www: ${info.message}`),
//       ),
//       filename: path.join(config.helpServerLogDir, config.helpServerLogFile),
//     }),
//   ],
// }));

// Enable CORS for all HTTP methods in development
if (process.env.NODE_ENV !== 'production') {
  // logger.warn('Development Environment - Enabling CORS for all requests');
  console.log('***fix-warn: Development Environment - Enabling CORS for all requests');
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
// **TODO: implement this
// app.use((err, req, res, next) => {
//   if (err) {
//     logger.debug(err);
//     logger.debug('Express Error: ' + err.stack);
//     res.status(500).send('Something broke!');
//   }
// });

const server = app.listen(config.port, () => {
  // logger.info(`Server listening on port: ${config.port}`);
  console.log(`***fix-info: Server listening on port: ${config.port}`);
});


// # Function to gracefully shutdown
const shutDown = () => {
  server.close(() => {
    // logger.info('Server has been stopped.');
    console.log('***fix-info: Server has been stopped.');
//    db.close(() => {
      process.exit(0);
//    });
  });
};
process.on('SIGINT', shutDown);
process.on('SIGTERM', shutDown);

module.exports = app;
