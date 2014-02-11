/*
 * Simple TCP Socket client
 * Handles I/O to external TCP Socket
 * {"cmd": "ALARM-ON"}
 * {"cmd": "ALARM-OFF"}
 * {"cmd": "SCAN-ON"}
 * {"cmd": "SCAN-OFF"}
 * {"cmd": "WRITE", "data", "<bytes>"}
 */

var net  = require('net'),
    PORT = process.argv[2] || 6767 //4444, //6767,
    HOST = process.argv[3] || '10.172.2.202';

var tcpclient = net.connect({port: PORT, host: HOST}, function(){
  var responseString = '';
  module.exports.emit('ready', tcpclient);    // emit ready to allow rfidgeek to grab tcpclient
  tcpclient.on('data', function(data) {
    responseString += data;
    // newline on single line is end of string
    if (/\n/.test(data)) { 
      var json = JSON.parse(responseString);
      responseString = '';
      console.log(json);
      switch(json.cmd) {
        case 'ALARM-ON':
          tcpclient.emit("alarmON");
          break;
        case 'ALARM-OFF':
          tcpclient.emit("alarmOFF");
          break;
        case 'SCAN-ON':
          tcpclient.emit("scanON");
          break;
        case 'SCAN-OFF':
          tcpclient.emit("scanOFF");
          break;
        case 'WRITE':
          tcpclient.emit("writeDATA", json.id, json.data);
          break;
      } 
    }
  });

  tcpclient.on('error', function(err) {
    console.log('error:', err.message);
  });

  tcpclient.on('end', function() {
    console.log('server disconnect');
  });

});
tcpclient.emit('ready', tcpclient);
module.exports = tcpclient;
