'use strict';

var mysql = require('mysql');
var config = require('./config');
var pool = mysql.createPool(config.mysql);
var Promise = require('bluebird');
var logger = require('./log');

// Db values
var dbName = config.mysql.database || 'sync_log_db';
var tableName = 'client_sync_log';

function acquireConnection(consumerCb) {
  pool.getConnection(function(err, connection) {
    if(err) {
      logger.error('Error acquiring connection from pool');
      throw err;
    }
    consumerCb(null,connection);
  });
}

function getLastSyncRecord(recordConsumerCb, consumerArgsArry) {
  pool.getConnection(function(err, connection) {
    if(err) {
      logger.error('Error acquiring connection from pool');
      throw err;
    }
    var status = "'SUCCESS'";
    var query = 'select * from ' + tableName + ' where status = ' + status 
                + ' and sequence_number = '
                + '(select max(sequence_number) from ' + tableName + ')';
    
    logger.debug('Running query ' + query);            
    connection.query(query, function(err, results) {
      connection.release();
      if(err) {
        console.error('An error occured while running query ' + query 
              + ', error message is ', err.message);
        throw new Error(err.message);
      }
      if(results.length > 0) {
        consumerArgsArry.splice(0, 0, results[0]);
        recordConsumerCb.apply(null, consumerArgsArry);
      } else {
        consumerArgsArry.splice(0, 0, null);
        recordConsumerCb.apply(null, consumerArgsArry);
      }
    }); 
  });           
}

var getConnection = Promise.promisify(pool.getConnection);

module.exports = {
  getLastSyncRecord: getLastSyncRecord,
  acquireConnection: acquireConnection,
  getConnection: getConnection,
}
