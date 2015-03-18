var path = require('path');
var fs = require('fs');

var incomingFileName;

module.exports = function SocketData(app) {
  var config = app.config;
  app.pubsub.on('plugins:ready', function() {
    // called once all plugins have been loaded
    console.log("[SocketData]", 'ready!');
  });

  app.pubsub.on('socket:newFile', function(fileName) {
    incomingFileName = fileName + '.part';
    console.log('[SocketData]', 'new file: ', incomingFileName);
  });

  app.pubsub.on('socket:data', function(data) {
    var filePath = path.resolve(config.paths.incoming, incomingFileName);

    // console.log('data segment: writing ' + instruction.data.length + 'bytes of data to ', filePath);

    fs.appendFileSync(filePath, data);
  });

  app.pubsub.on('socket:EOF', function() {
    // console.log('end of file: ', incomingFileName);
    var finalPath = path.resolve(config.paths.incoming, incomingFileName.replace('.part', ''));
    var partialPath = path.resolve(config.paths.incoming, incomingFileName);
    var isFinalFragment = ~finalPath.indexOf('-final');
    var rename = function() {
      fs.rename(partialPath, finalPath, function() {
        if(isFinalFragment) {
          app.pubsub.emit('video:ready', finalPath);
        }
      });
    };
    fs.exists(finalPath, function(exists) {
      if(exists) {
        fs.unlink(finalPath, rename);
        return;
      }
      rename();
    });
    incomingFileName = null;
  });

  // spin up any other objects needed
};
