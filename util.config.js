(function() {
  'use strict';
  
  function getHttpServerBaseUrl(userJsonConfig) {    
    let baseUrl = '';
    if(userJsonConfig.remoteServer.tls) {
      baseUrl = 'https://';
    } else {
      baseUrl = 'http://';
    }
    
    baseUrl += userJsonConfig.remoteServer.host;
    
    if(userJsonConfig.remoteServer.httpConfig.port) {
      baseUrl += ':' + userJsonConfig.remoteServer.httpConfig.port + '/';  
    }
    
    if(userJsonConfig.remoteServer.httpConfig.appName) {
      baseUrl += userJsonConfig.remoteServer.httpConfig.appName + '/';
    }
    
    return baseUrl;
  }
  
  function getServerPort(userJsonConfig) {
    // Default port is
    return userJsonConfig.port || 8000;   
  }
  
  module.exports = {
    getHttpServerBaseUrl: getHttpServerBaseUrl,
    getServerPort: getServerPort
  };
  
})();
