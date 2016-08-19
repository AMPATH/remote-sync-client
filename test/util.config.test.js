(function() {
  'use strict';
  
  let eConfig = require('../util.config');
  let expect = require('chai').expect;
  let testConfig = {
    port: 8000,
    remoteServer: {
      host: 'remote.server.io',
      httpConfig: {
        port: 8008,
      },
      sshConfig: {
        port: 22,
        zipBasePath: '/opt/sync/',
        username: 'username',
        password: 'password',
        privateKeyFile: '/home/syncuser/.ssh/id_rsa',
        numberAttempts: 3
      }
    }
  }
  describe('Util Config unit tests', () => {
    it('Should have the correct effective values', () => {
      let expectedBaseUrl = 'http://remote.server.io:8008/';
      let baseUrl = eConfig.getHttpServerBaseUrl(testConfig);
      expect(expectedBaseUrl).to.equal(baseUrl);
      
      delete testConfig.port;
      expect(eConfig.getServerPort(testConfig)).to.equal(8000);
      
      testConfig.port = 9000;
      expect(eConfig.getServerPort(testConfig)).to.equal(9000);
    })
  })
})();
