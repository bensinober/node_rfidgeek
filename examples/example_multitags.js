var Rfidgeek = require('./rfid.js');
var rfid = new Rfidgeek({
  debug: 'debug',
  tcpsocket: true,
  tagtype: 'ISO15693',
  bytes_to_read: 1,
  length_to_read: 26  // 26 blocks (=52 bytes) to grab entire content
});
rfid.init();
rfid.startscan();

// socket.emit("scanON");
// socket.emit("scanOFF");
// socket.emit("alarmON");
