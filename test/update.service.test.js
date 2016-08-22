'use strict';

var updateService = require('../update.service');
var expect = require('chai').expect;
var nock = require('nock');
var testUrl = 'http://test.wicked.tech';
var testConfig = {
  port: 8000,
  maxFileUpdates: 5,
  zipDirectory: '/Users/willa/Projects/scratchpad/testzip/',
  location: {
    uuid: 'AMRS location Uuid',
    name: 'location name'
  },
  remoteServer: {
    host: 'test.wicked.tech',
    httpConfig: {
      port: 80,
      tls: false
    },
    sshConfig: {
      port: 22,
      zipBasePath: '/root/',
      username: 'root',
      password: '1hat3th15',
      privateKeyFile: '/home/syncuser/.ssh/id_rsa',
      numberAttempts: 3
    }
  },
  mysql: {
    connectionLimit: 4,
    host: 'localhost',
    database: 'sync_log_db',
    port: 3306,
    user: 'sync',
    password: 'sync',
    multipleStatements: false
  }
};

var updatesResponse = {
 "result": [
   {
     "filename": "coco1.tgz",
     "uuid": "later-uuid",
     "dateCreated": "2016-08-22 15:29:53",
     "sequenceNumber": 3,
     "deltaRange": {
       "startDatetime": "2016-08-22T10:40:55.000Z",
       "endDatetime": "2016-08-22 15:29:53"
     }
   },
   {
     "filename": "coco.tgz",
     "uuid": "earlier-uuid",
     "dateCreated": "2016-08-22 13:40:55",
     "sequenceNumber": 2,
     "deltaRange": {
       "startDatetime": "2016-08-22T10:40:06.000Z",
       "endDatetime": "2016-08-22 13:40:55"
     }
   }
 ]
};

describe('Update service unit tests', function(){
  var secondResponse = {
   "result": [{
       "filename": "2016-08-22 15:29:53.tar.gz",
       "uuid": "later-uuid",
       "dateCreated": "2016-08-22 15:29:53",
       "sequenceNumber": 3,
       "deltaRange": {
         "startDatetime": "2016-08-22T10:40:55.000Z",
         "endDatetime": "2016-08-22 15:29:53"
       }
    }]
  };
  
  var request = nock(testUrl)
    .get('/db-updates')
    .reply(200, updatesResponse)
    .get('/db-updates?lastUuid=earlier-uuid')
    .reply(200, secondResponse);
    
  it('getDbUpdatesInfoFromServer() should make the correct rest call without lastUuid',
  function(done) {  
    updateService.getDbUpdatesInfoFromServer(null,testConfig, function(data) {
      expect(data).to.be.an('array');
      expect(data).to.deep.equal(updatesResponse.result);
      done();
    }); 
  });
    
  it('getDbUpdatesInfoFromServer() should make correct rest call with lastUuid parameter',
  function(done) {
    updateService.getDbUpdatesInfoFromServer({uuid: 'earlier-uuid'}, testConfig, function(data) {
      expect(data).to.be.an('array');
      expect(data).to.deep.equal(secondResponse.result);
      done();
    });
  });
  
  it.skip('processUpdates should do the right thing', function(done) {
    updateService.processUpdates(updatesResponse.result, testConfig, done);
  });
});  
