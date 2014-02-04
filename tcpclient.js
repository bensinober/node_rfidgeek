/*
 * Simple TCP Socket server
 * Connects to hub and handles I/O
 */

var net  = require('net'),
    PORT = process.argv[2] || 4444,
    HOST = process.argv[3] || '127.0.0.1';

var tcpclient = net.connect({port: PORT, host: HOST}, function(){
  var responseString = '';
  module.exports.emit('ready', tcpclient);    // emit ready to allow rfidgeek to grab tcpclient
  tcpclient.on('data', function(data) {
    if (data == "\n") {
      console.log(responseString);
      var json = JSON.parse(responseString);
    } else {
      responseString += data;
    }
  });

  tcpclient.on('error', function(err) {
    console.log('error:', err.message);
  });

  tcpclient.on('end', function() {
    console.log('server connect');
  });

});

var parseCommand = function(cmd) {

}
module.exports = tcpclient;