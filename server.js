(function() {
  'use strict';
  
  const Hapi = require('hapi');
  const serverConfigs = require('./config');
  const updates = require('./update.service');
  
  const server = new Hapi.Server();
  
  server.connection({
    host: serverConfigs.host || 'localhost',
    port: serverConfigs.port || 8000,
  });
  
  server.route({
    method: 'GET',
    path: '/',
    handler: function(request, reply) {
      return reply('<h2>Karibu sana, kurasa iko kwenye matengenezo!</h2>');
    }
  });
  
  server.start((err) => {
    if(err) {
      throw err;
    }
    var task = updates.scheduleUpdates(serverConfigs.updateSchedule);
    if(task) {
      task.start();
    }  
    console.log('Kick as* server running at: ', server.info.uri);
  })
})();
