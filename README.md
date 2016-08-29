# Remote Sync Client
This application works with [Remote Sync Server](https://github.com/AMPATH/ampath-remote-sync-server)
to update the client OpenMRS database periodically depending on configurations

It does so by downloading and running incremental mysql dumps from the server. It communicates with
the server via REST API to obtain information about list of pending updates. It downloads compressed
files using `scp` command.

## Configuration
Create a configuration file `config.json` at the root of the application with the following contents
```javascript
{
  "port": 8000,                       // http server port
  "maxFileUpdates": 5,                // maximum number of files that can be downloaded at once
  "updateSchedule": "*/15 * * *",     // In Unix cron format
  "zipDirectory": "/opt/sync-client/",  // Where downloaded zip files should be stored (ensure proper permissions)
  "errorDirectory": "/opt/sync-client/errors/", //dir to record errors on client
  "openmrsDatabase": "amrs",            // Client Openmrs database name to be updated 
  "logFile": "logs/client.log",         // If not specified default is logs/client.log relative to app dir
  "location": {                                 // (mysql username and password should access to this database)
    "uuid": "AMRS location Uuid",     // uuid of the client location (from openmrs.location)
    "name": "location name"           // client location name
  },
  "remoteServer": {
    "host": "sync.server.io",         // Name/IP of the server hosting the http server
    "httpConfig": {
      "port": 8444,                   // port if different that 80 or 443
      "tls": true                     // whether it uses TLS or not
    },
    "sshConfig": {
      "host": "Use this if different from remote host",
      "port": 24,                     // remote server ssh port   
      "zipBasePath": "/opt/sync-server/",    // base path where compressed files to be downloaded are stored (on the server)
      "username": "username",                // username of to be used with scp command
      "password": "password",                
      "privateKeyFile": "/home/syncuser/.ssh/id_rsa", // password & privateKeyFile are mutually exclusive
      "numberAttempts": 3                     // Number of times to attempt downloads in case of failure
    }
  },
  "mysql": {
    "connectionLimit": 2,               // Clients local sync log database configurations
    "host": "localhost",
    "database": "sync_log_db",
    "port": "3306",
    "user": "user1",                    // Should have privileges to change global variable values.
    "password": "secret",
    "multipleStatements": false
  }
}
```

Create database `sync_log_db` and then add a table `client_sync_log` by running `sync_log.sql` script.

## Running
Change to the application directory

`node server.js`
