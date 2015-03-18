var path = require('path');
var fs = require('fs');
var _ = require('underscore');
var express = require('express');
var Handlebars = require('handlebars');

function not_found(res) {
  res.append('status', 404);
  res.send('404. File Not Found.');
}

module.exports = function Api(app) {
  var api = express();
  var config = app.config;

  app.pubsub.on('plugins:ready', function() {
    api.get('/', function (req, res) {
      res.send('Hello World!');
    });

    api.get('/videos', function (req, res) {
      var files = fs.readdirSync(config.paths.outgoing);
      res.append('Content-Type', 'application/json');
      res.send(JSON.stringify(files));
    });

    api.get('/videos/:video.:ext', function (req, res) {
      var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      var video = path.join(config.paths.outgoing, '/' + req.params.video + '.mp4');
      fs.exists(video, function(exists) {
        if(exists) {
          if(req.params.ext === 'html') {
            console.log('[Api]', 'hosting html5 video for', ip);
            fs.readFile(__dirname + '/template.html', function(err, data) {
              res.append('Content-Type', 'text/html');
              var fn = Handlebars.compile(data.toString());
              res.send(fn({ video: '/videos/' + req.params.video }));
            });
          } else {
            var range = req.headers.range;
            if(!range) {
              //download the file
              console.log('[Api]', 'downloading file to', ip);

              res.writeHead(200, { 'Content-Type': 'video/mp4' });
              var stream = fs.createReadStream(video, { flags: "r" });
              stream.pipe(res);
            } else {
              console.log('[Api]', 'streaming file to', ip, range);
              range = _.map(range.replace(/bytes=/, '').split('-'), function(n) { return parseInt(n, 10); });
              fs.stat(video, function(err, stats) {
                range[1] = isNaN(range[1]) ? stats.size - 1 : range[1];
                var chunk = range[1] - range[0] + 1;
                res.writeHead(206, {
                  'Content-Type': 'video/mp4',
                  'Content-Length': chunk,
                  'Content-Range': ['bytes ', range[0], '-', range[1], '/', stats.size].join(''),
                  'Accept-Ranges': 'bytes'
                });

                var stream = fs.createReadStream(video, { start: range[0], end: range[1] })
                                .on('open', function() {
                                  stream.pipe(res);
                                });
              });
            }
          }
        } else {
          not_found(res);
        }
      });
    });

    var server = api.listen(8080, function () {
      var host = server.address().address;
      var port = server.address().port;

      console.log('[Api]', 'listening at http://%s:%s', host, port);
    });
  });
};
