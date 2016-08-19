(function() {
  'use strict';
  
  var config = require('./config');
  var configUtil = require('util.config');
  var Client = require('scp2').Client;
  
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
    f(updates.length > 1) {
      updates.sort(function(u1, u2) {
        return u1.sequenceNumber - u2.sequenceNumber;
      });
    }
    
    if(updates.length > config.parallelDownloads) {
      var parallel = config.parallelDownloads || 4;
      var iterations = Math.floor(updates.length/parallel);
      var clients = new Array(parallel);
      var status = new Array(parallel);
      var pending = 0;
      var firstIteration = true;
      
      for(var i=0; i<parallel; i++) {
        clients[i] = new Client();
        status[i] = STATUS_PROGRESS;
      }
      
      function __allSuccess(status) {
        for(var x=0; x<status.length; x++) {
          if(status[x] != STATUS_SUCCESS) return false;
        }
        return true;
      }
      
      for(var i=0; i<iterations; i++) {
        if(pending==0 && (__allSuccess(status) || firstIteration)) {
          setTimeout(function() {
            for(var j=i*parallel; j<(i+1) * parallel; j++) {
              status[j%parallel] = STATUS_PROGRESS;
              pending++;
              var src = config.remoteServer.sshConfig.zipBasePath + updates[i].filename;
              var dest = config.zipDirectory;
              clients[j%parallel].download(src, dest, function(err) {
                console.error('Error downloading ' + src, err.message);
                status[j%parallel] = STATUS_ERROR;
                pending--;
              });
              
              clients[j%parallel].on('end', function() {
                status[j%parallel] = STATUS_SUCCESS
                pending--;
              });
            }
          },200);
          
          // Bad way of doing it
          while()  
        }
      }
    }
    for(var i=0; i<updates.length; i++) {
      status.push(STATUS_PROGRESS);
      client.scp({
            host: config.remoteServer.host,
            username: config.remoteServer.sshConfig.username,
            password: config.remoteServer.sshConfig.password,
            path: config.remoteServer.sshConfig.zipBasePath + updates[i].filename;
        }, config.zipDirectory, function(err) {
          console.error('Error downloading file ' + updates[i].filename);
        });
      client.on('end',function() {
        status[i] = STATUS_SUCCESS;    
      })
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
