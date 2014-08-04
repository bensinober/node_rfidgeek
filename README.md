# Simple rfidgeek adaptor to Node.js

This adaptor is primarily made for the Univelop 500 RFID reader/writer made by Texas Instruments.

This reader supports the following tags:

* ISO15693
* ISO14443A
* ISO14443B
* TAGIT

## Using

Uses event emitters for passing tag and content, and can be controlled by nodejs,
or externally via TCP Socket or Websocket.

```
var rfid = require('rfidgeek'); 
```

## Configuration

rfid.init() takes optional parameters (defaults in parantheses):


```
tcpsocket:      (false)                  // {port: <port>, host: <host>} | true, defaults to localhost:4444
websocket:      (false)                  // {port: <port>, host: <host>} | true, defaults to localhost:4444
debug:          ('none')                 // show debug information, possible values: 'none', 'error', 'debug'
portname:       ('/dev/ttyUSB0')         // device path to reader
tagtype:        ('ISO15693')             // type rfid ['ISO15693', 'ISO14443A', 'ISO14443B', 'TAGIT']
scaninterval:   (1000)                   // interval between each scan, tested down to 100ms
readerconfig:   ('./univelop_500b.json') // path to json config file for rfid commands
bytes_to_read:  ('08')                   // block length to read from ISO15693
```

### example

```
rfid.init({
  tcpsocket: {
    port: 8888, 
    host: 'localhost'
  },
  tagtype: "ISO14443A"
});


### TCP Socket or Websocket control

```
 * {"cmd": "SCAN-ON"}                   // start scan loop
 * {"cmd": "SCAN-OFF"}                  // stop scan loop
 * {"cmd": "ALARM-ON"}                  // activate alarm on all items within range
 * {"cmd": "ALARM-OFF"}                 // deactivate alarm on all items within range
 * {"cmd": "WRITE", "id", "<data>"}     // write to ISO15693 tag
```

### nodejs control

Start scan loop;
    rfid.startScan(function(err) {console.log(err) });

Stop scan loop
    rfid.stopScan();

Deactivate alarm
    rfid.deactivateAFI(function(err) {console.log(err) });

Activate alarm
    rfid.activateAFI(function(err) {console.log(err) });

Write ISO15693 tag:
    rfid.writeISO15693("<tag id>", "<data>", function(err) { console.log(err) });

### Websocket in browser example

```
var ws = new WebSocket("ws://localhost:4444");
ws.onopen = function(evt) {
  console.log("connected!");
  ws.send(JSON.stringify({cmd:"SCAN-ON"}));
}

ws.onmessage = function(evt) {
  console.log(evt);
};

```

For more info check the `rfid.js` file and the tests

Note, there is work on the reader in Python:

    https://github.com/scriptotek/pyrfidgeek
    
and in Ruby:

    https://github.com/digibib/rfidgeek

License is MIT
