// WEBSOCKET CLIENT
var WebSocketClient = require('websocket').client;
wsClient = new WebSocketClient();
wsClient.on('connectFailed', function(error) {
    console.log('Connect Error: ' + error.toString());
});  
wsClient.on('connect', function(connection) {
  console.log('WebSocket client connected');
  module.exports.emit('ready', connection);     // emit ready to allow rfidgeek to grab socket
  connection.on('error', function(error) {
      console.log("Connection Error: " + error.toString());
  });
  connection.on('close', function() {
      console.log('echo-protocol Connection Closed');
  });
  connection.on('message', function(message) {
      if (message.type === 'utf8') {
          console.log("Received: '" + message.utf8Data + "'");
      }
  });

  connection.sendUTF("Hello world");
});

module.exports = wsClient;
