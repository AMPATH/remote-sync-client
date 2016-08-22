(function() {
  'use strict';
  
  var config = require('./config');
  var configUtil = require('./util.config');
  var execSync = require('child_process').execSync;
  var client = require('scp2');
  var Client = require('scp2').Client;
  var db = require('./db');
  var cron = require('node-cron');
  
  client.defaults({
    host: config.remoteServer.host,
    username: config.remoteServer.sshConfig.username,
    password: config.remoteServer.sshConfig.password,
    // privateKey: ...
  })
  var STATUS_ERROR = 2;
  var STATUS_PROGRESS = 0;
  var STATUS_SUCCESS = 1;
  var DEFAULT_HTTP_PORT = 80;
  // Schedule the task.
  function scheduleUpdates() {
    return cron.schedule('*/1 * * * *', function() {
      console.log('This runs every one minute!')
      db.getLastSyncRecord(getDbUpdatesInfoFromServer)
    });
  }
  /**
   * Fetches the db updates from the server
   */
  function getDbUpdatesInfoFromServer(lastSyncRecord, config, processUpdates){
    var http = _http();

    var options = {
      path: _path(lastSyncRecord),
      host: config.remoteServer.host,
      port: config.remoteServer.httpConfig.port || DEFAULT_HTTP_PORT,
    };

    var req = http.request(options, function(resp) {
      var serverStuff = '';
      resp.on('data', function(chunk) {
        serverStuff += chunk;
      });
      
      resp.on('end', function(){
        var updatesDetails = JSON.parse(serverStuff);
          processUpdates(updatesDetails.result);
      });
      
      resp.on('error', function(err) {
        console.error('Server error: ' + err.message);
      });
    });
    
    req.on('error', function(err) {
      console.error('Request/client error: ',err);
    });
    req.end();
  }
  
  function processUpdates(updates) {
    var maxFilesNumber = config.maxFileUpdates || 4;
    
    if(updates.length > 1) {
      updates.sort(function(u1, u2) {
        return u1.sequenceNumber - u2.sequenceNumber;
      });
    }
    
    if(updates.length > maxFilesNumber) {
      updates.length = maxFilesNumber;
    } else {
      maxFilesNumber = updates.length;
    }
    
    var clients = new Array(maxFilesNumber);
    var status = new Array(maxFilesNumber);
    var pending = 0;
    
    for(var i=0; i<parallel; i++) {
      clients[i] = new Client();
      status[i] = STATUS_PROGRESS;
    }
    
    var __allDone = function(status) {
      for(var x=0; x<status.length; x++) {
        if(status[x] == STATUS_PROGRESS) return false;
      }
      return true;
    }
    
    var __updateDb = function(updates, status) {
      var inflateCmd = 'tar xzf ';
      var cmd = 'mysql -u' + config.mysql.user + ' -p' + config.mysql.password
                + ' ' + config.mysql.database;

      for(var z=0; z<updates.length; z++) {
        if(status[z] == STATUS_SUCCESS) {
          var dateRun = (new Date()).toISOString();
          cmd += updates[z].filePath;
          inflateCmd += updates[z].filePath;
          if(updates[z].filePath.lastIndexOf('.tar.gz') != -1) {
            var until = updates[z].filePath.lastIndexOf('.tar.gz');
            updates[z].dirname = updates[z].filePath.substring(0, until);
          } else {
            if(updates[z].filePath.lastIndexOf('.tgz') != -1) {
              var until = updates[z].filePath.lastIndexOf('.tgz');
              updates[z].dirname = updates[z].filePath.substring(0, until);
            } 
          }
          
          try {
            execSync(inflateCmd);
            var files = readdirSync(updates[z].dirname);
            files.forEach(function(file) {
              if(file.endsWith('.sql')) {
                var mysqlCmd = cmd + ' < ' + updates[z].dirname + '/' + file;
                try {
                  execSync(mysqlCmd);
                } catch (err) {
                  // Write a log file 
                  var table = file.substring(0,file.lastIndexOf('.sql'));
                  var errorFile = updates[z].zipDirectory + 'errors/table_'
                              + table + '_' + (new Date()).toISOString() + '.log';
                  var message = 'There was an error importing data from ' + file
                            + '\n' +  err.stack || err.message;
                  fs.writeFileSync(errorFile, message);
                  throw err;          
                }  
              }
            });
            var query = 'insert into client_sync_log(filename,uuid,datetime_run,'
                + 'sequence_number,status) values(' 
                + updates[z].filename + ','
                + updates[z].uuid + ','
                + '\'' + dateRun + '\','
                + updates[z].sequenceNumber + ','
                + '\'SUCCESS\')';
            
            //Update DB after the previous update call is done
            var updateTableCmd = cmd + ' -e "' + query +'"';
            execSync(updateTableCmd);    
          } catch (err) {
            var details = err.stack || err.message;
            var query = 'insert into client_sync_log(filename,uuid,datetime_run,'
                + 'sequence_number,status,details) values(' 
                + updates[z].filename + ','
                + updates[z].uuid + ','
                + '\'' + dateRun + '\','
                + updates[z].sequenceNumber + ','
                + '\'ERROR\',\'' + details + '\')'; 
            console.error('Error updating database', err);
            break;
          }
        } else {
          // Abort immediately 
          break;
        }
      }
    }
    
    for(var i=0; i<maxFilesNumber; i++) {
      (function(index) {
          status[index] = STATUS_PROGRESS;
          pending++;
          var src = config.remoteServer.sshConfig.zipBasePath + updates[index].filename;
          var dest = config.zipDirectory;
          updates[index].filePath = dest + updates[index].filename;
          clients[index].download(src, dest, function(err) {
            console.error('Error downloading ' + src, err.message);
            status[index] = STATUS_ERROR;
            pending--;
          });
          
          clients[index].on('end', function() {
            status[index] = STATUS_SUCCESS
            pending--;
            
            if(__allDone(status)) {
              __updateDb(updates, status);
            }
          });
      })(i);
    }
  }
  
  function _path(lastSyncRecord) {
    var path = '/db-updates'
    if(lastSyncRecord) {
        path += '?lastUuid=' + lastSyncRecord.uuid;
    }
    return path;
  }
  
  function _http() {
    DEFAULT_HTTP_PORT = 80;
    if(config.tls) {
      DEFAULT_HTTP_PORT = 443;
      return require('https');
    }
    return require('http');
  }
  
  module.exports = {
    getDbUpdatesInfoFromServer: getDbUpdatesInfoFromServer,
    scheduleUpdates: scheduleUpdates
  } 
})();
