/*
 * RFIDGeek Texas Instrument RFID Serial port connector
 * References: 
 *  TI TRF9770A Evaluation Module (EVM) User's Guide, p. 8:
 *    <http://www.ti.com/litv/pdf/slou321a>
 *  PyRFIDGeek (python module):
 *    <https://github.com/scriptotek/pyrfidgeek/blob/master/pyrfidgeek/rfidgeek.py>
 */

var sys = require('sys');
var events = require('events');
// Mock serialport if in test mode
if (process.env.NODE_ENV=='test') {
  var MockedSerialPort = require('./node_modules/serialport/test_mocks/linux-hardware.js');
  var SerialPort = MockedSerialPort.SerialPort;
  var hardware = MockedSerialPort.hardware;
  hardware.createPort('/dev/ttyUSB0');
} else {
  var SerialPort = require('serialport').SerialPort;
}

/*
 * Constructor
 */
 
function Rfidgeek(options) {
  // default options
  options = options || {};
  this.websocket      = options.websocket ;
  this.tcpsocket      = options.tcpsocket ;
  this.portname       = options.portname  || '/dev/ttyUSB0' ;
  this.tagtype        = options.tagtype   || 'ISO15693' ;
  this.scaninterval   = options.scaninterval   || 1000 ;
  this.readerconfig   = options.readerconfig   || './univelop_500b.json' ;
  this.blocks_to_read = options.blocks_to_read || '08' ;

  logger = require('./logger');
  logger.debugLevel = options.debug || 'none' ;

  if(false === (this instanceof Rfidgeek)) {
      return new Rfidgeek(options);
  }
  
  events.EventEmitter.call(this);
}

// Make Rfidgeek inherit EventEmitter - ability to create custom events on the fly 
sys.inherits(Rfidgeek, events.EventEmitter);

/*
 * Exported main init function
 */
 
Rfidgeek.prototype.init = function() {
  var self = this;

  if(self.websocket) {                    // websocket boolean
    var wss = require("./wsserver.js");   // websocket server - pushes to connected clients
    var ws = require("./wsclient.js");    // websocket client - sends rfid result to server
    ws.connect('ws://localhost:8080/ws');
  
    // grab websocket handle when ready
    ws.on('ready', function(conn) {
      socket = conn;
    });
  }

/*
 * TCP Socket communication
 */

  if(self.tcpsocket) {
    var tcpclient = require("./tcpclient.js");
    tcpclient.on('ready', function(conn) {
      socket = conn;
      console.log("connected to socket");
        // enable all alarms within range
      socket.on('alarmON', function(){
        // return:
        // {"cmd": "ALARM-ON", "status": "OK|FAILED"}
        console.log("activating alarm");
        socket.write('{"cmd": "ALARM-ON", "status": "OK"}\n');
      });
      // disable all alarms within range
      socket.on('alarmOFF', function(){
        // return:
        // {"cmd": "ALARM-OFF", "status": "OK|FAILED"}  
        console.log("deactivating alarm"); 
        socket.write('{"cmd": "ALARM-FF", "status": "OK"}\n'); 
      })
      // enable scan
      socket.on('scanON', function(){
        self.startscan();
        // return:
        // {"cmd": "SCAN-ON", "status": "TAGS-OK", "barcode": "0123"}
        // {"cmd": "SCAN-ON", "status": "TAGS-MISSING", "barcode": "0123"}
        socket.write('{"cmd": "SCAN-ON", "status": "TAGS-OK", "barcode": "102931"}\n');
        console.log("starting scan");  
      });
      // disable scan
      socket.on('scanOFF', function(){
        self.stopscan();
        // return:
        // {"cmd": "SCAN-OFF", "status": "OK|FAILED"}
        socket.write('{"cmd": "SCAN-OFF", "status": "OK"}\n');
        console.log("stopping scan");
      });
      // write to RFID
      socket.on('writeDATA', function(){
        // return:
        // {"cmd": "WRITE", "status": "OK|FAILED"}
        socket.write('{"cmd": "WRITE", "status": "OK"}\n'); 
      });  
    });
  }  
  
  // read reader config file
  var readerConfig = require(self.readerconfig);
  
  // data variables
  var tagData = '';      // this stores the tag data
  var tagBuffer = '';
  var readData = '';     // this stores the read buffer
  var start_offset = '00';
  var offset = start_offset;
  
  // OBJECT CONSTANTS
  // 3 bytes: flag, cmd and cmd_code
  // command is composed of :
  // '01' + length + '00','03','04', +flags+cmd+cmd_code
  var FLAGS = {
    inventory_single: ['24','14','01'],
    inventory_multi:  ['04','14','01'],
    read_tag:         ['20','18','23'],
    write_block:      ['20','18','21'],
    unlock_afi:       ['02','18','27'],
    lock_afi:         ['00','18','27']
  }

  // public data variables
  self.readerState = 'paused'
  self.selectedTag = '';
  self.tagsInRange = [];  // tags in range from inventory
                          // [{ id: <id>, data: <string> }]
  
  // Create new serialport pointer
  reader = new SerialPort(self.portname , { 
    baudRate: 115200,
    dataBits: 8,
    parity: 'none',
    stopBits: 1,
    flowControl: false,
    buffersize: 1024
  }, true); // this is the openImmediately flag [default is true]
  
  // expose reader functions
  self.reader = reader;

  /* Workflow:
    Reader receives cmd:
    * emit initialize event
    * SCAN-ON: turns on the scan loop
    * SCAN-OFF: turns off the scan loop
    * ALARM-ON: activates AFI alarm
    * ALARM-OFF: deactivates AFI alarm
    * WRITE: writes n bytes to chip
    * gets tag data, quits scan loop, activates read tag loop
    * read tag loop completed, reactivated scan loop

  */
  
  // EVENT LISTENERS
  
  reader.on('open',function() {
    logger.log('debug', 'Port open');
    
    reader.on('initialize', initialize);
    reader.on('initcodes', initcodes);
    reader.on('scanloop', self.scanTagLoop);
    reader.on('readtags', readTags);
    reader.on('rfiddata', rfidData);
    reader.on('readtagdata', readTagData);
    // unregister tag if removed
    reader.on('tagremoved', function() {
      logger.log('debug', 'Tag removed');
      if (self.websocket) {
        socket.sendUTF("Tag removed");
      }
      tagData = '';
    });
    
    // inventory done, tags found
    // start readloop if ISO15693 tag, else ignore
    // all tags in self.tagsInRange should be read
    reader.on('tagsfound', function( tags ) {
      if (tags.length > 0) {                     // do nothing unless new tag is found
        logger.log('debug', "New tag(s) found!");
        if (self.websocket) {
          socket.sendUTF(tags);
        }
        self.emit('tagsInRange', tags);             // emit to calling external app!
        // tagData = tags;                          // register new tag
        if (self.tagtype == 'ISO15693') {           // if ISO15693 tag:
       //   stopScan();
          /*self.stopscan();                        //   stop scanning for tags*/
        //  readTags(tags);                           //   start read tags content
        }
      } else {
        logger.log('debug', "no tags in range...");
      }
    });

    // send resulting tag to external app
    // TODO: maybe kill this?  
    reader.on('rfidresult', function(data) {
      logger.log('debug', "Full tag received: "+data);
      if (self.websocket) {
        socket.sendUTF(data);       // send to websockets, skip first byte
      }
      self.emit('rfiddata', data);  // emit to external app
    });
    
    reader.on('data', gotData);
    
    reader.emit('initialize', readerConfig.initialize['init']);
  });
  
  // error
  reader.on('error', function( msg ) {
    logger.log('error', msg );
  });
  
  // close
  reader.on('close', function ( err ) {
    logger.log('debug', 'port closed');
  });
  
  // PRIVATE FUNCTIONS
  
  // initialize reader and emit initcodes event
  var initialize = function(cmd, callback) {
    reader.write(cmd, function(err) {
      if (err){ callback(err)}
      else {
        logger.log('debug', 'initialized reader...')
        // initialized? emit initcodes
        reader.emit('initcodes', readerConfig.protocols[self.tagtype]['initcodes']);
      }
    });
  }
  
  // run initcodes (with delay to ensure right execution)
  var initcodes = function(cmd, callback) {
    setTimeout(function () {
      reader.write(cmd['register_write_request'], function(err) {
        if (err){ callback(err); }
        setTimeout(function () {
          reader.write(cmd['agc_enable'], function(err) {
            if (err){ callback(err); }
            setTimeout(function () {
              reader.write(cmd['am_input'], function(err) {
                if (err){ callback(err); }
                else { logger.log('debug', "ran initcodes!"); }
              });
            }, 10);
          });
        }, 10);
      });
    }, 10);
  }
  
  // this function reverses a hex string to return tag ID
  var reverseTag = function(hex) {
    var str = [];
    for (var i = 0; i < hex.length; i += 2) {
      str.push(hex.substr(i, 2));
    }
    return str.reverse().join('');
  }

  // this function turns a hex string to ASCII
  var hex2ascii = function(hex) {
    var str = '';
    for (var i = 0; i < hex.length; i += 2) {
      str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return str;
  }
  
  // this function turns a decimal number to hex
  var dec2hex = function(d) {
    return ("0"+(Number(d).toString(16))).slice(-2).toUpperCase()
  }
  
  // TAG LOOP FUNCTIONS - do inventory check
  //var scanLoop = setInterval(function() { scanTagLoop(readerConfig.protocols[self.tagtype]) }, 1000 );
    
  self.scanTagLoop = function (){ 
    // run inventory check in intervals
    inventory(readerConfig.protocols[self.tagtype]['inventory'], function(err) {
      if (err) { logger.log('error', err) }
    });
  }
  
  var stopScan = function() {
    clearInterval(scanLoop);
  }
  
  // inventory command
  // ISO15693:
  //   single_slot: 010B000304142401000000
  //   multi_slot:  010B000304140401000000
  var inventory = function(cmd, callback) {
    reader.write(cmd, function(err) {
      if (err) { 
        logger.log('error', err);
        callback(err)
      }
      else { 
        logger.log('debug', 'ran inventory!') 
      }
    });
  }
  // END TAG LOOP FUNCTIONS
  
  // READ TAG DATA
  var readTags = function( tags, callback ) {
    
    // need to make an anonymous function loop with a 100ms for reader to be able to read all tags
    var i = 0;
    (function loopFn() {
      logger.log('debug', "sending readtagdata event, id: "+tags[i].id );
      reader.emit('readtagdata', tags[i].id );
      i++;
      if (i<tags.length) { setTimeout(loopFn, 100); }
    })();
    //reader.removeListener('readtags', readTags);    
    //reader.emit('rfidresult', tags);
    // start new scanloop
    //scanLoop = setInterval(function() { self.scanTagLoop(readerConfig.protocols[self.tagtype]) }, self.scaninterval );
  }
  
  // loop to read data from ISO15693 
  var readTagData = function( id, callback ) {
    var offset = '00';
    // cmd = ['01','0C','00','03','04','18','00','23', dec2hex(offset), dec2hex(self.bytes_per_read), '00', '00'].join('');
    cmd = ['01','14','00','03','04','18','20','23', id, offset, self.blocks_to_read, '00', '00'].join('');
    logger.log('debug', "offset: "+offset+ " id: "+id+" tagdata cmd: " + cmd );
    process.nextTick(function() {
      reader.write(cmd, function(err) {
        if(err) { throw new Error (err) }
      });
    });
  }

  /*
   * 'rfiddata' EVENT - fires when tag data is read
   *                  - hopefully tags come in right order as there is no async way to ensure
   *                  - maybe handle data according to self.readerState?
   */  
  var rfidData = function( data, callback) {
    var tagdata = hex2ascii(data);
    logger.log('debug', "rfiddata received: " + tagdata );
    // append rfiddata to tags missing data, hopefully they come in right order
    self.tagsInRange.some(function(item) { 
      if (!item.data) { return item.data = tagdata; } 
      else { 
        logger.log('debug', "all tags read!\n" + self.tagsInRange );
      }
    });
    //reader.removeListener('readtags', readTags);    
    //reader.emit('rfidresult', str);
    // start new scanloop
    //scanLoop = setInterval(function() { self.scanTagLoop(readerConfig.protocols[self.tagtype]) }, self.scaninterval );
  }
  
  /*
   * 'data' EVENT - fires on any data received from serialport, 
   *              - thus needs to handle data according to self.readerState
   */
  var gotData = function( data ) {
    data = String(data)
    logger.log('debug', 'received: '+data);
    // Inventory state
    if (self.readerState == 'inventory') {

      // ']D' => end of inventory
      if (/\]D/.test(data)) {  
        tagBuffer += data;                                               // make sure last position is also counted    
        if (/\,[0-9A-F]{2}\]\r\n/.test(tagBuffer)) {                     // we have tags in range!
          //var str = tagBuffer.replace(/\r\n/g, "");
          var tags=tagBuffer.match(/\[[0-9A-F]{16}\,[0-9A-F]{2}/g);      // tag id's are      [ID,POS]
          var conflicingtags=tagBuffer.match(/\[[0-9A-F]{16}\,z/g);      // conflict id's are [ID,z]   - ignored for now
          tags.forEach(function(tag) {
            var id = tag.substr(1,16);
            // append only tags that isn't already in array
            if (!self.tagsInRange.some(function(some) { return some.id === id }) ) {
              self.tagsInRange.push({id: id});
            }
          });
          self.readerState = 'readtags';  // toggle readerstate
          tagBuffer = '';                 // empty tag buffer
          logger.log('debug', 'tags in range: '+self.tagsInRange);
          reader.emit('tagsfound', self.tagsInRange);
          // TODO: error here
          reader.emit('readtags', self.tagsInRange);
          self.stopscan();
        } else {
          console.log(data)
          logger.log('debug', 'no tags in range!');
        }                            

      } else {
        tagBuffer += data;      
      }
    }

    // Read state
    // reads anything between [] as data from tag
    // needs to read one tag at a time
    if (self.readerState == 'readtags') {
      if(self.tagsInRange.length > 0) {
        var rfiddata = data.match(/\[00(.+)\]/);     // strip initial 00 response
        if (rfiddata) {
          logger.log('debug', "response data! "+rfiddata[1]);
          reader.emit('rfiddata', rfiddata[1]);
        }
      }
      //   self.tagsInRange.forEach(function(tag) {
      //     logger.log('debug', 'reading tag: '+tag);
      //   });
      //   self.tagsInRange = [];
      //   self.readerState = 'inventory';                     // finished reading tags, return to inventory
      else {
        logger.log('debug', 'error reading tag!');
      }
    }

    // if(!!data) {
      // ISO15693 needs special treatment
      // if(self.tagtype == 'ISO15693') {
        // ISO15693 NO TAG
      //   if (/\[,40\]/.test(data)) {
      //     logger.log('debug', 'no tags ...');
      //     if (tagData) {                              // if tagData exist then tag is considered removed
      //       reader.emit('tagremoved')
      //     }
      //   } 
      //   // ISO15693 TAG
      //   else if (/,..]/.test(data)) {                 // we have an inventory response! (comma and position)
      //     var tag=data.match(/\[([0-9A-F]+)\,..\]/);  // check for actual tag - strip away empty tag location ids (eg. ',40) 
      //     if (tag && tag[1]) {
      //       id = reverseTag(tag[1]);
      //       logger.log("debug", "tag ID: "+id );
      //       reader.emit('tagfound', id);
      //     }
      //   }
        
      //   // ISO15693 RFID DATA
      //   else if (/\[.+\]/.test(data)) {                // we have response data! (within brackets, no comma)
      //     var rfiddata = data.match(/\[00(.+)\]/);     // strip initial 00 response
      //     if (rfiddata) {
      //       logger.log('debug', "response data! "+rfiddata[1]);
      //       reader.emit('rfiddata', rfiddata[1]);
      //     }
      //   } 
      // // ANY OTHER PROXIMITY TAG
      // } 
      // else if (/\[.+\]/.test(data)) {
      //   var tag = data.match(/\[(.+)\]/);            // tag is anything between brackets
      //   if (tag && tag[1]) {
      //     id = reverseTag(tag[1]);
      //     logger.log('debug', "tag ID: "+id);
      //     reader.emit('tagfound', id);
      //   }
    //   } 
    // }
  }
}

/*
 * PUBLIC FUNCTIONS
 */

// this function starts scanning for inventory (tags)
Rfidgeek.prototype.startscan = function() {
  var self = this;
  self.readerState = 'inventory';
  self.scanLoop = setInterval(function() { self.scanTagLoop() }, self.scaninterval );
}

Rfidgeek.prototype.stopscan = function() {
  var self = this;
  clearInterval(self.scanLoop);
  if (self.readerState == 'inventory') {
    self.readerState = 'paused';
  }
}

// this function writes data to ISO15693 chip
Rfidgeek.prototype.writeISO15693 = function(tag, data) {
  var self = this;
}

// this function deactivates AFI - cmd: 18, cmd_code: 27, data: c2
Rfidgeek.prototype.deactivateAFI = function(tag) {
  var self = this;
}

// this function deactivates AFI - cmd: 18, cmd_code: 27, data: 07
Rfidgeek.prototype.activateAFI = function(tag) {
  var self = this;
}



module.exports = Rfidgeek  
  // for browser compatibility
  //if (typeof module !== 'undefined' && typeof module.exports !== 'undefined')
  //  module.exports = rfidGeek;
  //else
  //  window.rfidGeek = rfidGeek;
//})();
