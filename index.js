var soap = require('soap-q'),
    Q = require('q'),
    _ = require('lodash');

function Plex(username, password, memcached, test) {
  this.username = username;
  this.password = password;
  this.test = test;
  this.dataSourceKeys = {};

  if(memcached) {
    this.memcached = memcached;
    this.memcachedTtl = 360;
  }
}

Plex.prototype.call = function(dataSourceName, plexArgs, cacheArgs){
  var self = this;
  if(!cacheArgs || !cacheArgs.cache || plexArgs)
    return self.callPlex(dataSourceName, plexArgs);

  return self.memcached.get(key).then(function(val){
    if(val) return val;

    return self.callPlex(dataSourceName, plexArgs).then(function(ret){
      return self.memcached.set(key, ret, cacheArgs.ttl).then(function(){
        return ret;
      });
    });
  });
};

Plex.prototype.callPlex = function(dataSourceName, args) {
  var self = this;

  if(!args) args = {};

  return this.connect().then(function(client) {
    return self.findDataSourceKey(dataSourceName).then(function(dataSourceKey) {
      var keys = _(args).keys().map(function(key) {
        return '@' + key;
      }).valueOf();

      return client.ExecuteDataSourcePost({
        dataSourceKey: dataSourceKey,
        parameterNames: keys.join(','),
        parameterValues: _.values(args).join(','),
        delimeter: ','
      }).then(function(results) {
        return self.normalizeResults(results);
      });
    });
  });
};

Plex.prototype.connect = function() {
  var self = this;
  return Q.fcall(function() {
    if(self.client) return self.client;
    else {
      var url = 'https://' + (self.test ? 'test' : '') + 'api.plexonline.com/DataSource/Service.asmx?WSDL';

      var auth = new soap.BasicAuthSecurity(self.username, self.password);
      var headers = {};
      auth.addHeaders(headers);
      return soap.createClient(url, { wsdl_headers: headers }).then(function(client) {
        client.setSecurity(auth);
        self.client = client;
        return self.client;
      });
    }
  });
};

Plex.prototype.findDataSourceKey = function(dataSourceName) {
  var self = this;

  return Q.fcall(function() {
    if(isFinite(dataSourceName)) return dataSourceName;

    return self.getDataSourceKey(dataSourceName).then(function(key) {
      if(key)
        return key;
      else {
        return self.call(1825, {
          DatasourceName: dataSourceName
        }).then(function (result) {
          var key = _.result(_.find(result, { Datasource_Name: dataSourceName }), 'Datasource_Key');
          return self.setDataSourceKey(dataSourceName, parseInt(key));
        });
      }
    });
  });
};

Plex.prototype.normalizeResults = function(results) {
  if(results.Error)
    throw new Error(results.Message);

  try {
    results = _.map(results.ResultSets.ResultSet[0].Rows.Row, function(row) {
      var result = {};

      _.each(row.Columns.Column, function(col) {
        result[col.Name] = col.Value;
      });

      return result;
    });

    return results;
  }
  catch(e) {
    return null;
  }
};

Plex.prototype.getDataSourceKey = function(name) {
  var self = this;

  return Q.fcall(function() {
    if (self.dataSourceKeys[name])
      return self.dataSourceKeys[name];

    if (self.memcached) {
      return self.memcached.get(name).then(function (key) {
        if (key) self.dataSourceKeys[name] = key;

        return key;
      });
    }
  });
};

Plex.prototype.setDataSourceKey = function(name, key) {
  var self = this;

  return Q.fcall(function() {
    if(self.memcached) {
      return self.memcached.set(name, key, self.memcachedTtl).then(function() {
        self.dataSourceKeys[name] = key;
      });
    }
    else {
      self.dataSourceKeys[name] = key;
    }
  }).then(function() {
    return key;
  });
};

module.exports = Plex;
