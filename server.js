(function() {
  'use strict';
  
  const Hapi = require('hapi');
  const serverConfigs = require('./config');
  
  const server = new Hapi.Server();
  
  server.connection({
    host: serverConfigs.host || 'localhost',
    port: serverConfigs.port || 8000,
  });
  
  server.route({
    method: 'GET',
    path: '/',
    handler: function(request, reply) {
      console.log('Request is ', request);
      return reply('Wassup buddy!');
    }
  });
  
  server.start((err) => {
    if(err) {
      throw err;
    }
    console.log('Kick as* server running at: ', server.info.uri);
  })
})();
