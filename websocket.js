/**
* Wrapper for Worlize WebSocketNode to emulate the browser WebSocket object.
*/

var WebSocketClient = require('websocket').client;
var ws = new WebSocketClient();
var socket = '';

ws.on('connectFailed', function(error) {
    console.log('Connect Error: ' + error.toString());
});

ws.on('connect', function(connection) {
    console.log('WebSocket client connected');
    socket = connection;
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

    // the actual transmitting event
    connection.on('send', function(message) {
          connection.sendUTF(message);
    });
    connection.sendUTF("Hello world");
});
//ws.connect('ws://localhost:4567', 'websocket-name');
