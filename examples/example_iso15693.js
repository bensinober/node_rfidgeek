/*
 * Simple example on using Rfidgeek module events for grabbing ISO15693 tags
 *  starts a Websocket server at port 8080 that can be connected for testing
 *  the example reads a book tag with the following interesting bytes:
 *  01 : always 11
 *  02 : item in collection
 *  03 : total items in collection
 *  04-05 : always 3130
 *  06-19 : barcode
 *  20-21 : md5sum
 *  22-23 : country code
 *  24-30 : library code
 */

var rfid = require('rfidgeek');

// initialize with tcpsocket options
rfid.init({
  debug: 'error',
  tcpsocket: { port: 6767, host: 'localhost'},
  scaninterval: 1000,
  tagtype: 'ISO15693',
  blocks_to_read: '08' // 8+1 blocks * 4 bytes = 36 bytes
});

// This adds a TCPSOCKET listener that can now be accessed on localhost:6767
//
// Connect via telnet and start reader scanning with
// {"cmd":"SCAN-ON"}
//
// You should now receive a verification
// {"cmd":"SCAN-ON", "status": "OK"}
//
// And you should now receive JSON data of the ISO15693 tags within range

// CREATING EVENT LISTENERS
// 
rfid.on('tagfound', function(tag) {
  console.log("Tag received in external app: "+tag);
});
