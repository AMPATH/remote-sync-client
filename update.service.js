(function() {
  'use strict';
  
  var config = require('./config');
  var execSync = require('child_process').execSync;
  var fs = require('fs');
  var Client = require('scp2').Client;
  var db = require('./db');
  var cron = require('node-cron');
  var mysql = require('mysql');
  
  var STATUS_ERROR = 2;
  var STATUS_PROGRESS = 0;
  var STATUS_SUCCESS = 1;
  var DEFAULT_HTTP_PORT = 80;
  // Schedule the task.
  function scheduleUpdates(scheduleConfig, once) {
    if(once) {
      db.getLastSyncRecord(getDbUpdatesInfoFromServer, [ config, processUpdates]);
    } else {
      return cron.schedule(scheduleConfig, function() {
        db.getLastSyncRecord(getDbUpdatesInfoFromServer, [ config, processUpdates]);
      });
    }
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
    
    console.log('Getting new updates from: ' + options.path);
    var req = http.request(options, function(resp) {
      var serverStuff = '';
      resp.on('data', function(chunk) {
        serverStuff += chunk;
      });
      
      resp.on('end', function(){
        var updatesDetails = JSON.parse(serverStuff);
        if(updatesDetails.result && updatesDetails.result.length>0) {
          processUpdates(updatesDetails.result, config);
        } else {
          console.log('No new updates, the server returned an empty array');
        }
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
  
  function processUpdates(updates, config, callback) {
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
    
    for(var i=0; i<maxFilesNumber; i++) {
      clients[i] = new Client();
      clients[i].defaults({
        host: config.remoteServer.sshConfig.host || config.remoteServer.host,
        port: config.remoteServer.sshConfig.port || 22,
        username: config.remoteServer.sshConfig.username,
        password: config.remoteServer.sshConfig.password,
        // privateKey: ...
      });
      status[i] = STATUS_PROGRESS;
    }
    
    var __allDone = function(status) {
      for(var x=0; x<status.length; x++) {
        if(status[x] == STATUS_PROGRESS) return false;
      }
      return true;
    }
    
    var __updateDb = function(updates, status) {
      var openmrsDatabase = config.openmrsDatabase || 'amrs';
      var inflateCmd = 'tar xz -C '; 
      var cmd = 'mysql -u' + config.mysql.user + ' -p' + config.mysql.password
                + ' ' + openmrsDatabase;
                
      var _run_command = function(command) {
        console.log('Running ' + command);
        execSync(command);
      };
                
      for(var z=0; z<updates.length; z++) {
        if(status[z] == STATUS_SUCCESS) {
          if(updates[z].filePath.lastIndexOf('.tar.gz') != -1) {
            var until = updates[z].filePath.lastIndexOf('.tar.gz');
            updates[z].dirname = updates[z].filePath.substring(0, until);
          }
          else if(updates[z].filePath.lastIndexOf('.tgz') != -1) {
              var until = updates[z].filePath.lastIndexOf('.tgz');
              updates[z].dirname = updates[z].filePath.substring(0, until);
          }
          else {
            throw new Error('Wrong file type passed! ' + updates[z].filePath);
          }
          
          var dateRun = (new Date()).toISOString()
                          .substring(0, 19).replace('T', ' ');

          execSync('mkdir -p ' + updates[z].dirname);
          var fileInflateCmd = inflateCmd + updates[z].dirname + ' -f ' + updates[z].filePath;

          try {
            console.log('Running ' + fileInflateCmd);
            execSync(fileInflateCmd);
            var files = fs.readdirSync(updates[z].dirname);
            
            console.log(updates[z].dirname + ':Running with files ' + files.join(','));
            var disableChecksCmd = cmd + ' -e "SET GLOBAL FOREIGN_KEY_CHECKS=0"';
            var enableChecksCmd = cmd + ' -e "SET GLOBAL FOREIGN_KEY_CHECKS=1"';
            _run_command(disableChecksCmd);
            files.forEach(function(file) {
              if(file.endsWith('.sql')) {
                var tableName = file.substring(0, file.indexOf('.sql'));
                var checkTableExistCmd = cmd + " -e \"SHOW TABLES LIKE '"+ tableName + "'\"";
                var retValue = execSync(checkTableExistCmd);
                if(retValue.toString() != ''){
                var mysqlCmd = cmd + ' < ' + updates[z].dirname + '/' + file;
                try {
                  console.log('Importing ' + updates[z].dirname + '/' +file);
                  _run_command(mysqlCmd);
                } catch (err) {
                  _run_command(enableChecksCmd);
                  // Write a log file 
                  // var table = file.substring(0,file.lastIndexOf('.sql'));
                  // var errorFile = config.errorDirectory + 'table_' + table
                  //              + '_' + (new Date()).toISOString() + '.log';
                  // var message = 'There was an error importing data from ' + file
                  //           + '\n' +  err.stack || err.message;
                  //           
                  // fs.writeFileSync(errorFile, message);
                  throw err;          
                }
                }  
              }
            });
            _run_command(enableChecksCmd);   
          } catch (err) {
            var details = err.stack || err.message;
            var query = "insert into " + config.mysql.database 
                + ".client_sync_log(filename,uuid,datetime_run,"
                + "sequence_number,status,details) values('" 
                + updates[z].filename + "','"
                + updates[z].uuid + "','"
                + dateRun + "',"
                + updates[z].sequenceNumber + ","
                + "'ERROR'," + mysql.escape(details) + ")"; 
            
            var recordErrorCmd = cmd + ' -e "' + query + '"';    
            _run_command(recordErrorCmd);     
            console.error('Error updating database', err);
            throw err;
          }
          
          // Reflect in sync log
          try {
            var query = "insert into " + config.mysql.database 
                + ".client_sync_log(filename,uuid,datetime_run,"
                + "sequence_number,status) values('" 
                + updates[z].filename + "','"
                + updates[z].uuid + "','"
                + dateRun + "',"
                + updates[z].sequenceNumber + ","
                + "'SUCCESS')";
            
            //Update DB after the previous update call is done
            var updateTableCmd = cmd + ' -e "' + query +'"';
            console.log('Running query ' + query);
            execSync(updateTableCmd); 
          }
          catch(dbErr) {
            console.error('Error updating sync log table with error', dbErr);
            console.log('IMPORTANT! Updates from ' + updates[z].filePath 
                      + ' may have proceeded successfully, check to confirm');
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
          var cleanFilename = updates[index].filename.replace(/\s/g,'-');
          cleanFilename = cleanFilename.replace(/:/g, '.');
          var src = config.remoteServer.sshConfig.zipBasePath + cleanFilename;
          var dest = config.zipDirectory;
          updates[index].filePath = dest + cleanFilename;
          clients[index].download(src, updates[index].filePath , function(err) {
            if(err) {
              status[index] = STATUS_ERROR;
              console.error('Error downloading ' + src, err);
            }
            else {
              status[index] = STATUS_SUCCESS;
              console.log('Downloaded ' + src + ' to ' + updates[index].filePath);
            }
            pending--;
            if(__allDone(status)) {
              __updateDb(updates, status);
              if(typeof callback === 'function') {
                callback();
              }
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
    processUpdates: processUpdates,
    scheduleUpdates: scheduleUpdates
  } 
})();
