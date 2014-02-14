/*var Rfidgeek = require('../rfid.js');
var rfid = new Rfidgeek({
  debug: 'debug',
  tcpsocket: true,
  tagtype: 'ISO15693',
  blocks_to_read: '08' // 8+1 blocks * 4 bytes = 36 bytes
});
rfid.init();

rfid.startscan();
*/
// socket.emit("scanON");
// socket.emit("scanOFF");
// socket.emit("alarmON");

var Rfidgeek = require('../rfid.js');
var rfid = new Rfidgeek({
  debug: 'debug',
  tcpsocket: { port: 4444, host: 'localhost'},
  scaninterval: 500,
  tagtype: 'ISO15693',
  blocks_to_read: '08' // 8+1 blocks * 4 bytes = 36 bytes
});
rfid.init();
/*rfid.startscan(function(err) {
  if (err) {console.log(err); }
})*/

//{"cmd":"SCAN-ON"}