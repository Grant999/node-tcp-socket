
// extend Buffer class with helpful methods
require('buffertools').extend();

var net = require('net');
var path = require('path');
var fs = require('fs');

var incomingFilePath = path.resolve(__dirname, 'incoming/');
var HOST = '0.0.0.0';
var PORT = process.argv[2] || 9000; // "node app.js are [0], [1]"

var markers = {
  start: '{{cmd}}',
  end: '{{/cmd}}'
};

net.createServer(function(sock) {
  var incomingFileName = null;

  var processInstruction = function(instruction) {
    var isNewFile = instruction.txt.indexOf('newFile:') != -1;
    var isEndOfFile = instruction.txt.indexOf('EOF') != -1;
    var isEcho = instruction.txt.indexOf('echo:') != -1;
    var isDataSegment = instruction.txt === 'data:segment';

    if(isNewFile) {
      incomingFileName = instruction.txt.split(':')[1] + '.part';
      console.log('new file: ', incomingFileName);
    } else if(isEcho) {
      var txt = instruction.txt.split(':')[1];
      console.log('ECHO: ' + txt);
    } else if(isEndOfFile) {
      console.log('end of file: ', incomingFileName);
      var finalPath = path.resolve(incomingFilePath, incomingFileName.replace('.part', ''));
      var partialPath = path.resolve(incomingFilePath, incomingFileName);
      var rename = function() { fs.rename(partialPath, finalPath); };
      fs.exists(finalPath, function(exists) {
        if(exists) {
          fs.unlink(finalPath, rename);
          return;
        }
        rename();
      });
      incomingFileName = null;
    } else if(isDataSegment && incomingFileName != null) {
      var filePath = path.resolve(incomingFilePath, incomingFileName);

      console.log('data segment: writing ' + instruction.data.length + 'bytes of data to ', filePath);

      fs.appendFileSync(filePath, instruction.data);
    }
  };

  console.log('CONNECTED: ' + sock.remoteAddress + ':' + sock.remotePort);

  sock.on('data', function(data) {
    // ensure that we're dealing with binary data all the time
    console.log('-=-=-=-=-=-=-=- new data packet -=-=-=-=-=-=-=-');
    var buffer = data;
    if(!Buffer.isBuffer(buffer)) buffer = new Buffer(data);
    var pos = 0;

    while(pos < buffer.length) {
      // check the string buffer to see if an instruction is there
      var start = buffer.indexOf(markers.start, pos);
      var end = buffer.indexOf(markers.end, start);
      if(~start && start === pos) {
        if(~end) {
          var start = buffer.indexOf(markers.start) + Buffer.byteLength(markers.start);
          var end = buffer.indexOf(markers.end);
          var strBuffer = buffer.slice(start, end).toString();
          processInstruction({ txt: strBuffer });
          pos = end + Buffer.byteLength(markers.end);
        }
      } else {
        // data segment?
        if(start === -1) start = buffer.length;
        processInstruction({
          txt: 'data:segment',
          data: buffer.slice(pos, start)
        });
        pos = start;
      }
    }
    console.log('-=-=-=-=-=-=-=- done processing -=-=-=-=-=-=-=-\n');
  });

  sock.on('close', function(data) {
    console.log('CLOSED: ' + sock.remoteAddress + ':' + sock.remotePort);
  });
}).listen(PORT, HOST);

console.log('Server listening on ' + HOST + ':' + PORT);
