
module.exports = function Stats(app) {
  var config = app.config;

  var startTime;
  app.pubsub.on('socket:newFile', function() {
    startTime = (new Date()).getTime();
  });

  app.pubsub.on('socket:EOF', function() {
    console.log('[Stats]', 'file took', (new Date()).getTime() - startTime, 'ms');
  });
};
