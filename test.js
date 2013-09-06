/*
 * Simple example on using Rfidgeek module events
 */

var Rfidgeek = require('./rfid.js');

// instantiating a simple reader
var rfid = new Rfidgeek();

// instantiating a reader with websocket server
var rfid = new Rfidgeek({ 
  websocket: true
});

rfid.on('tagfound', function(tag) {
  console.log("Tag received in external app: "+tag);
});

rfid.on('rfiddata', function(data) {
  console.log("RFID data received in external app: "+data);
});

rfid.scan();
