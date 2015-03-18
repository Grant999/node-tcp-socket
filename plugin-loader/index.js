var path = require('path');
var fs = require('fs');
var _ = require('underscore');

var PluginLoader = function(app) {
  var config = app.config;
  // start scanning the directories
  console.log('[PluginLoader]', config.paths.plugins);
  fs.readdir(config.paths.plugins, function(err, dirs) {
    var plugins = _.filter(dirs, function(filePath) {
      var dir = config.paths.plugins + '/' + filePath;
      var stat = fs.statSync(dir);
      if(stat.isDirectory()) {
        return fs.existsSync(dir + '/index.js');
      }
    });

    // load the plugins
    _.each(plugins, function(p) {
      console.log('[PluginLoader]', 'found plugin: ', p);
      var fn = require(config.paths.plugins + '/' + p);
      if(fn.call) {
        fn.call(app, app);
      }
    });

    app.pubsub.emit('plugins:ready', plugins);
  });
};

module.exports = function(app) {
  return new PluginLoader(app);
}
