var path = require('path');
var fs = require('fs');

module.exports = function SocketData(app) {
  var config = app.config;

  app.pubsub.on('socket:connect', function(socket) {
    console.log('[SocketData]', 'connected!');

    var incomingFileName;
    socket.on('newFile', function(fileName) {
      incomingFileName = fileName + '.part';
      console.log('[SocketData]', 'new file: ', incomingFileName);
    });

    socket.on('close', function() {
      // clean up any event listeners for this connection
      socket.removeAllListeners('newFile');
      socket.removeAllListeners('data');
      socket.removeAllListeners('EOF');
      socket.removeAllListeners('close');
    });

    socket.on('data', function(data) {
      var filePath = path.resolve(config.paths.incoming, incomingFileName);

      // console.log('data segment: writing ' + instruction.data.length + 'bytes of data to ', filePath);

      fs.appendFileSync(filePath, data);
    });

    socket.on('EOF', function() {
      console.log('[SocketData]', 'got EOF');
      if(!incomingFileName) {
        console.log('[SocketData]', 'incoming file name not set, but EOF received!');
        return;
      }
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
  });

  app.pubsub.on('plugins:ready', function() {
    // called once all plugins have been loaded
    console.log("[SocketData]", 'ready!');
  });
};
