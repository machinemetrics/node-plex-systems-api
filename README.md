# node-plex-systems
API for accessing Plex Systems Manufacturing ERP Web Services

```
var Plex = require('node-plex-systems-api');

var memcachedConfig = {
  hosts: ['localhost:11211'], 
  defaultTtl: 3600  
};

var useTestApi = false;

var plex = new Plex('username', 'password', memcachedConfig /* optional */, useTestApi /* optional */);

plex.call('Workcenter_Setup_Get', { Workcenter_Key: 11111 }).then(function(workcenter) {
  console.log(workcenter.Job_No + ' ' + workcenter.Part_No + ' ' + workcenter.Workcenter_Status_Description);
});

```
