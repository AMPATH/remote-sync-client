(function() {
  'use strict';
  
  var config = require('./config');
  var configUtil = require('util.config');
  var execSync = require('child_process').execSync;
  var Client = require('scp2').Client;
  var db = require('./db');
  
  Client.defaults({
    host: config.remoteServer.host,
    username: config.remoteServer.sshConfig.username,
    password: config.remoteServer.sshConfig.password,
    // privateKey: ...
  })
  var STATUS_ERROR = 2;
  var STATUS_PROGRESS = 0;
  var STATUS_SUCCESS = 1;
  /**
   * Fetches the db updates from the server
   */
  function handleDbUpdates(lastSyncRecord){
    var http = _http();

    var options = {
      path: _path(lastSyncRecord),
      host: config.remoteServer.host
    }
    
    var req = http.request(options, function(resp) {
      var serverStuff = '';
      resp.on('data', function(chunk) {
        serverStuff += chunk;
      });
      
      resp.on('end', function(){
        var updatesDetails = JSON.parse(serverStuff);
        if(updatesDetails.length == 0) {
          console.log('Already up to date, no new updates from server');
        } else {
          _processUpdates(updatesDetails);
        }
      });
      
      resp.on('error', function(err) {
        console.error('Server error: ' + err.message);
      });
    });
    
    req.on('error', function(err) {
      console.error('Request/client error: ' + err.message);
    });
    
    req.end();
  }
  
  function _processUpdates(updates) {
    var maxFilesNumber = config.maxFileUpdates || 4;
    
    f(updates.length > 1) {
      updates.sort(function(u1, u2) {
        return u1.sequenceNumber - u2.sequenceNumber;
      });
    }
    
    if(updates.length > maxFilesNumber) {
      updates.length = maxFilesNumber;
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
      var cmd = 'mysql -u' + config.mysql.user + ' -p' + config.mysql.password;
      cmd += ' < ';
      var ret;
      for(var z=0; z<updates.length; z++) {
        if(status[z] == STATUS_SUCCESS) {
          var dateRun = (new Date()).toISOString();
          cmd += updates[z].filePath;
          try {
            var ret = execSync(cmd);
            var query = 'insert into client_sync_log(filename,uuid,datetime_run,'
                + 'sequence_number,status) values(' 
                + updates[z].filename + ','
                + updates[z].uuid + ','
                + '\'' + dateRun + '\','
                + updates[z].sequenceNumber + ','
                + '\'SUCCESS\')';
                
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
          } finally {
            // run the query
            db.acquireConnection(function(err, connection) {
              console.log('Updating sync status, running query: ' + query);
              connection.query(query, function(err, status) {
                
              });
            })
          }
        } else {
          // Abort immediately 
          break;
        }
      }
    }
    
    for(var i=0; i<maxFilesNumber; i++) {
      status[i] = STATUS_PROGRESS;
      pending++;
      var src = config.remoteServer.sshConfig.zipBasePath + updates[i].filename;
      var dest = config.zipDirectory;
      updates[i].filePath = dest + updates[i].filename;
      clients[i].download(src, dest, function(err) {
        console.error('Error downloading ' + src, err.message);
        status[i] = STATUS_ERROR;
        pending--;
      });
      
      clients[i].on('end', function() {
        status[i] = STATUS_SUCCESS
        pending--;
        
        if(__allDone(status)) {
          
        }
      });
    }

  }
  
  function _path(lastSyncRecord) {
    var path = '/db-updates'
    var location = config.location || {};
    if(location.uuid) {
      path += '?location=' + location.uuid
      if(lastSyncRecord) {
         path += '&delta-uuid=' + lastSyncRecord.uuid;
      }
    } else {
      if(lastSyncRecord) {
        path += '?delta-uuid' + lastSyncRecord.uuid;
      }
    }
    return path;
  }
  
  function _http() {
    if(config.tls) {
      return require('https');
    }
    return require('http');
  }
  
  module.exports = {
    handleDbUpdates: handleDbUpdates
  } 
})();
