
// extend Buffer class with helpful methods
require('buffertools').extend();

var Handlebars = require("handlebars");
var _ = require('underscore'); // awww yiss
var net = require('net');
var path = require('path');
var fs = require('fs');
var EventEmitter = require('events').EventEmitter;

var app = module.exports = {};

var config = app.config = require('./config.json');
var pubsub = app.pubsub = require('./pubsub');

for(var p in config.paths) {
  if(config.paths.hasOwnProperty(p)) {
    config.paths[p] = path.resolve(__dirname, config.paths[p] + '/');
  }
}

var pluginLoader = app.plugins = require('./plugin-loader/index')(app);

var HOST = config.sockets.hostBinding;
var PORT = process.argv[2] || config.sockets.port; // "node app.js are [0], [1]"

config.ffmpeg.args = Handlebars.compile(config.ffmpeg.args);

net.createServer(function(sock) {
  var socketPub = new EventEmitter();

  app.pubsub.emit('socket:connect', socketPub, sock.remoteAddress, sock.remotePort);

  sock.on('data', function(data) {
    // ensure that we're dealing with binary data all the time
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

          socketPub.emit.apply(socketPub, cmd);
          pos = end + Buffer.byteLength(config.commandFormat.close);
        }
      } else {
        // data segment?
        if(start === -1) start = buffer.length;
        socketPub.emit('data', buffer.slice(pos, start));
        pos = start;
      }
    }
  });

  sock.on('close', function(data) {
    // TODO: clean up any half-transferred files?
    socketPub.emit('close', data, sock);
    console.log('CLOSED: ' + sock.remoteAddress + ':' + sock.remotePort);
  });
}).listen(PORT, HOST);

console.log('Server listening on ' + HOST + ':' + PORT);
