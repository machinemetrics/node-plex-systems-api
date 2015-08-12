var soap = require('soap-q'),
  Q = require('q'),
  Memcached = require('q-memcached'),
  _ = require('lodash');

function Plex(username, password, memcached, test) {
  this.username = username;
  this.password = password;
  this.test = test;
  this.dataSourceKeys = {};

  if(memcached) {
    this.memcached = new Memcached(memcached.hosts);
    this.memcachedTtl = memcached.defaultTtl;
  }
}

Plex.prototype.call = function(dataSourceName, args) {
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
        if(dataSourceKey === 1825 && results.ResultSets.ResultSet[0].Rows.Row.length > 1) {
          var tmp = results;
          results.ResultSets.ResultSet[0].Rows.Row = _.filter(tmp.ResultSets.ResultSet[0].Rows.Row, function (n) {
            return (n.Columns.Column[1].Value === args.DatasourceName);
          });
        }
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
          return self.setDataSourceKey(dataSourceName, parseInt(result.Datasource_Key));
        });
      }
    });
  });
};

Plex.prototype.normalizeResults = function(results) {
  results = _.map(results.ResultSets.ResultSet[0].Rows.Row, function(row) {
    var result = {};

    _.each(row.Columns.Column, function(col) {
      result[col.Name] = col.Value;
    });

    return result;
  });

  if(results.length == 1)
    results = _.first(results);

  return results;
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