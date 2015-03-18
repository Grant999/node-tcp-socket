var FfmpegTask = require('./ffmpeg-task');
var fs = require('fs');
var path = require('path');
var _ = require('underscore');

var queue = [];

module.exports = function VideoFinalizer(app) {
  var config = app.config;

  var nextTask = function() {
    var video = queue.shift();
    var task = new FfmpegTask(video, config);

    console.log('[VideoFinalizer]', 'finalizing video: ' + video);
    task.run().then(function(finalVideo) {
      if(queue.length != 0) nextTask();
      else console.log('[VideoFinalizer]', 'sleeping, waiting for more vidja');
    }, function(log) {
      console.log('[VideoFinalizer]', 'video failed to finalize');
      console.log(log);
      console.log('[VideoFinalizer]', '^^^ logs for the ffmpeg call');
    });
  };

  app.pubsub.on('plugins:ready', function() {
    // populate our queue with any videos waiting
    // to be finalized
    fs.readdir(config.paths.incoming, function(err, files) {
      var waiting = _.filter(files, function(file) {
        return ~file.indexOf('-final.ts');
      });

      queue = queue.concat(waiting);
      if(queue.length > 0) nextTask(); // kick it off!
    });
  });

  app.pubsub.on('video:ready', function(finalPath) {
    console.log('[VideoFinalizer]', 'video ready', finalPath);
    queue.push(path.basename(finalPath)); // only store the file name and ext
    if(queue.length != 0) {
      // start working!
      nextTask();
    }
  });
};
