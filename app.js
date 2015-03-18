
// extend Buffer class with helpful methods
require('buffertools').extend();

var Handlebars = require("handlebars");
var _ = require('underscore'); // awww yiss
var net = require('net');
var path = require('path');
var fs = require('fs');

var app = module.exports = {};

var config = app.config = require('./config.json');
var pubsub = app.pubsub = require('./pubsub');

for(var p in config.paths) {
  if(config.paths.hasOwnProperty(p)) {
    config.paths[p] = path.resolve(__dirname, config.paths[p] + '/');
  }
}

var pluginLoader = app.plugins = require('./plugin-loader/index')(app);

var HOST = config.defaults.hostBinding;
var PORT = process.argv[2] || config.defaults.port; // "node app.js are [0], [1]"

config.ffmpeg.args = Handlebars.compile(config.ffmpeg.args);

net.createServer(function(sock) {
  // TODO: later, support multiple connections by spinning up a listener
  // for each socket connection

  console.log('CONNECTED: ' + sock.remoteAddress + ':' + sock.remotePort);

  sock.on('data', function(data) {
    // ensure that we're dealing with binary data all the time
    // console.log('-=-=-=-=-=-=-=- new data packet -=-=-=-=-=-=-=-');
    var buffer = data;
    if(!Buffer.isBuffer(buffer)) buffer = new Buffer(data);
    var pos = 0;

    while(pos < buffer.length) {
      // check the string buffer to see if an instruction is there
      var start = buffer.indexOf(config.commandFormat.open, pos);
      var end = buffer.indexOf(config.commandFormat.close, start);
      if(~start && start === pos) {
        if(~end) {
          var start = buffer.indexOf(config.commandFormat.open) + Buffer.byteLength(config.commandFormat.open);
          var end = buffer.indexOf(config.commandFormat.close);
          var strBuffer = buffer.slice(start, end).toString();
          var cmd = strBuffer.split(':');
          cmd[0] = 'socket:' + cmd[0];

          pubsub.emit.apply(pubsub, cmd);
          pos = end + Buffer.byteLength(config.commandFormat.close);
        }
      } else {
        // data segment?
        if(start === -1) start = buffer.length;
        pubsub.emit('socket:data', buffer.slice(pos, start));
        pos = start;
      }
    }
    // console.log('-=-=-=-=-=-=-=- done processing -=-=-=-=-=-=-=-\n');
  });

  sock.on('close', function(data) {
    // TODO: clean up any half-transferred files?
    // TODO: spin down any listeners assigned to this socket...
    console.log('CLOSED: ' + sock.remoteAddress + ':' + sock.remotePort);
  });
}).listen(PORT, HOST);

console.log('Server listening on ' + HOST + ':' + PORT);
