var fs = require('fs');
var path = require('path');
var _ = require('underscore');
var Promise = require('promise');
var exec = require('child_process').exec;

var FfmpegTask = function(videoPath, config) {
  this.videoPath = videoPath;
  this.config = config;

  var log = this.log = '';
  this.run = function() {
    var promise = new Promise(function(resolver, rejecter) {
      var videoKey = videoPath.split('-')[0]; // grab the capture UUID
      fs.readdir(config.paths.incoming, function(err, files) {
        var fragments = _.filter(files, function(file) {
          return ~file.indexOf(videoKey);
        });

        var outputPath = path.join(config.paths.outgoing, '/' + videoKey + '.mp4');

        var cmd = config.ffmpeg.cmd;
        var args = config.ffmpeg.args({ inputs: fragments, output: outputPath });

        var ffmpeg = exec([cmd, args].join(' '), {
          cwd: config.paths.incoming
        });

        ffmpeg.stdout.on('data', function (data) { log += data; });
        ffmpeg.stderr.on('data', function (data) { log += data; });

        ffmpeg.on('close', function(code) {
          console.log('[ffmpeg]', 'process exit', code);
          if(~code) {
            resolver(outputPath);
            _.each(fragments, function(fragment) {
              console.log('[ffmpeg]', 'cleaning up', 'removing ' + fragment);
              fs.unlink(path.join(config.paths.incoming, '/' + fragment));
            });
          }
          return rejecter(log);
        });
      });
    });

    return promise;
  };
};

module.exports = FfmpegTask;
