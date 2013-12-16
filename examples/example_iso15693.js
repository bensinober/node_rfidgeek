/*
 * Simple example on using Rfidgeek module events for grabbing ISO15693 tags
 *  starts a Websocket server at port 8080 that can be connected for testing
 */

var Rfidgeek = require('../rfid.js');

// instantiating a simple reader
var rfid = new Rfidgeek();

// instantiating a reader with websocket server
var rfid = new Rfidgeek({
  debug: 'debug',
  websocket: true,
  tagtype: 'ISO15693',
  bytes_to_read: 1,
  length_to_read: 26
});

// create event listeners
rfid.on('tagfound', function(tag) {
  console.log("Tag received in external app: "+tag);
});

rfid.on('rfiddata', function(data) {
  console.log("RFID data received in external app: "+data);
});

// init reader
rfid.init();

// start scan loop
rfid.start();
