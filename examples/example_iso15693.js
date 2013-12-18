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

var Rfidgeek = require('../rfid.js');

// instantiating a reader with websocket server
var rfid = new Rfidgeek({
  debug: 'error',
  websocket: false,
  tagtype: 'ISO15693',
  bytes_to_read: 1,
  length_to_read: 26  // 26 blocks (=52 bytes) to grab entire content
});

// create event listeners
rfid.on('tagfound', function(tag) {
  console.log("Tag received in external app: "+tag);
});

rfid.on('rfiddata', function(data) {
   json = {
      itemno: data.substring(1,2).charCodeAt(0),
      totalitems: data.substring(2,3).charCodeAt(0),
      barcode: data.substring(5,19),
      md5sum: data.substring(19,21),
      country: data.substring(21,23),
      library: data.substring(23,31)
    }
  console.log(json);
});

// init reader
rfid.init();

// start scan loop
rfid.start();
