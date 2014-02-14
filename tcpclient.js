/*
 * Simple TCP Socket client
 * Handles I/O to external TCP Socket
 * {"cmd": "ALARM-ON"}
 * {"cmd": "ALARM-OFF"}
 * {"cmd": "SCAN-ON"}
 * {"cmd": "SCAN-OFF"}
 * {"cmd": "WRITE", "data", "<bytes>"}
 */

var net  = require('net');

function TCPClient(config) {
  var self = this;
  PORT = config.port || 4444//6767 //4444, //6767,
  HOST = config.host || 'localhost' //10.172.2.202';


  self.client = net.connect({port: PORT, host: HOST}, function(){
  var responseString = '';
  self.client.emit('ready', self.client);    // emit ready to allow rfidgeek to grab self.client
  self.client.on('data', function(data) {
    responseString += data;
    // newline on single line is end of string
    //if (/\n/.test(data)) { 
      try {
        var json = JSON.parse(responseString);
        responseString = '';
        console.log(json);
        switch(json.cmd) {
          case 'ALARM-ON':
            self.client.emit("alarmON");
            break;
          case 'ALARM-OFF':
            self.client.emit("alarmOFF");
            break;
          case 'SCAN-ON':
            self.client.emit("scanON");
            break;
          case 'SCAN-OFF':
            self.client.emit("scanOFF");
            break;
          case 'WRITE':
            self.client.emit("writeDATA", json.id, json.data);
            break;
          default:
            console.log("unknown command: "+JSON.stringify(json));
        } 
      } catch (e) {
        console.log(e);
      }
    //}
  });

  self.client.on('error', function(err) {
    console.log('error:', err.message);
  });

  self.client.on('end', function() {
    console.log('server disconnect');
  });

});
self.client.emit('ready', self.client);
//module.exports = self.client;
}
module.exports = TCPClient;