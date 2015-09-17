# node-plex-systems-api
API for accessing Plex Systems Manufacturing ERP Web Services

```
var Plex = require('node-plex-systems-api');

var Memcached = require('q-memcached');
var cache = new Memcached(yourSettings);

// The q-memcached that's on NPM is broken. Use ours instead. https://github.com/machinemetrics/node-q-memcached
// Instead of passing q-memcached, you can pass in an object with two methods: get and set. They must return a promise.

var useTestApi = false;

var plex = new Plex('username', 'password', cache /* optional */, useTestApi /* optional */);

plex.call('Workcenter_Setup_Get', { Workcenter_Key: 11111 }).then(function(workcenter) {
  console.log(workcenter.Job_No + ' ' + workcenter.Part_No + ' ' + workcenter.Workcenter_Status_Description);
});

```
