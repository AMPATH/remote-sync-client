var config = require('./config');
var winston = require('winston');
var execSync = require('child_process').execSync;

var logFile = config.logFile || 'logs/client.log';

var lastSlashIndex = logFile.lastIndexOf('/');

if(lastSlashIndex != -1) {
  //Create the directory if it doesn't exist yet
  var dir = logFile.substring(0, lastSlashIndex);
  if(!dir.startsWith('/') && !dir.startsWith('.')) {
    dir = __dirname + '/' + dir;
  }
  execSync('mkdir -p ' + dir);
}

module.exports = new winston.Logger({
  transports: [
    new (winston.transports.Console)(),
    new (winston.transports.File)({ filename: logFile, json:false })
  ]
});
