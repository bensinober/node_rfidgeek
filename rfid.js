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
var crc = require('./crc.js');
// Mock serialport if in test mode
if (process.env.NODE_ENV=='test') {
  var MockedSerialPort = require('./node_modules/serialport/test_mocks/linux-hardware.js');
  var SerialPort = MockedSerialPort.SerialPort;
  var hardware = MockedSerialPort.hardware;
  hardware.createPort('/dev/ttyUSB0');
} else {
  var serialport = require('serialport');
  var SerialPort = serialport.SerialPort;
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

  /*
   * VARIABLES AND CONSTANTS
   */
  
  // read reader config file
  var readerConfig = require(self.readerconfig);
  
  // data variables
  //var tagData = '';      // this stores the tag data
  var readData = '';     // this stores the read buffer
  var start_offset = '00';
  var offset = start_offset;
  
  // INSTANCE DATA VARIABLES
  self.readerState = 'paused'
  self.selectedTag = '';
  self.tagsInRange = [];  // tags in range from inventory
                          // [{ id: <id>, data: { <object> } }]
 
   // Create new serialport pointer
  var reader = new SerialPort(self.portname , { 
    baudRate: 115200,
    dataBits: 8,
    parity: 'none',
    stopBits: 1,
    flowControl: false,
    buffersize: 1024
  }, true); // this is the openImmediately flag [default is true]
  
  // expose reader functions
  self.reader = reader;

  /*****************
   * EVENT LISTENERS
   ******************/

  /* 
   * RFID READER
   */
  
  reader.on('open',function() {
    logger.log('debug', 'Port open');
    
    reader.on('initialize', initialize);
    reader.on('initcodes', initcodes);
    reader.on('scanloop', self.scanTagLoop);
    reader.on('checkForTags', checkForTags);
    reader.on('rfiddata', rfidData);
    reader.on('readtagdata', readTagData);
    // unregister tag if removed
    reader.on('tagremoved', function() {
      logger.log('debug', 'Tag removed');
      if (self.websocket) {
        socket.sendUTF("Tag removed");
      }
      //tagData = '';
    });
    
    // INVENTORY DONE, TAGS FOUND AND READ. TIME TO EMIT RESULTS 
    // consolidateTags fixes item counts
    // start inventory if ISO15693 tag, else ignore
    // all tags in self.tagsInRange should be read
    reader.on('tagsfound', function( tags ) {
      if (tags.length > 0) {                         // do nothing unless tags in range
        tags = consolidateTags(tags);

        logger.log('debug', "New tag(s) found!");
        if (self.websocket) {
          socket.sendUTF(tags);
        }
        self.emit('tagsInRange', tags);             // emit to calling external app!
        if (self.socket) {
          tags.forEach(function(tag) {
            if(!tag.validated) {
              var response = { 
                cmd: "READ",
                status: tag.status,
                id: tag.id,
                data: tag.data
              };
              var jsonresponse = JSON.stringify(response);
              logger.log('debug', "response to socket: "+jsonresponse);
              self.socket.write(jsonresponse+"\n");
              if (tag.status == "TAGS-OK") {
                tag.validated = true;
              }
            }
          })
        }
        if (self.tagtype == 'ISO15693') {           // if ISO15693 tag:
       //   stopScan();
          /*self.stopscan();                        //   stop scanning for tags*/
        //  readTags(tags);                           //   start read tags content
        }
      } else {
        logger.log('debug', "no tags in range...");
      }
      // HERE! cannot reactivate scan loop
      /*self.startscan(function(err) {
        logger.log('debug', "Reactivated scan loop!");
        //console.log("Reactivated scan loop!");
      });*/
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
    
    // EMIT INITIALIZE    
    reader.emit('initialize', readerConfig.initialize['init'], function(err, result) {
      if (err) { logger.log('error', 'error initializing: '+err); }
    });
  });
  
  // error
  reader.on('error', function( msg ) {
    logger.log('error', "error opening reader: "+msg );
  });
  
  // close
  reader.on('close', function ( err ) {
    logger.log('debug', 'port closed');
  });

  /*
   * WEBSOCKET : only for testing?
   */

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
 * TCP SOCKET : Communication with hub
 */

  if(self.tcpsocket) {
    //var tcpclient = require("./tcpclient.js");
    var TCPClient = require("./tcpclient.js");
    var tcpclient = new TCPClient(self.tcpsocket).client;
    tcpclient.on('ready', function(conn) {
      var socket = conn;
      self.socket = socket;  // expose socket
      logger.log('debug', 'Connected to socket');
        // enable all alarms within range
      conn.on('alarmON', function(){
        logger.log('debug', 'Activating alarms');
        self.activateAFI(function(err, result) {
          if(err) {
            logger.log('debug', result);
            socket.write('{"cmd": "ALARM-ON", "status": "FAILED"}\n');
          } else {
            socket.write('{"cmd": "ALARM-ON", "status": "OK"}\n');
          }
        });
      });
      // disable all alarms within range
      socket.on('alarmOFF', function(){
        logger.log('debug', 'Deactivating alarms');
        self.deactivateAFI(function(err, result) {
          if(err) {
            logger.log('error', err);
            socket.write('{"cmd": "ALARM-OFF", "status": "FAILED"}\n');
          } else {
            logger.log('debug', result);
            socket.write('{"cmd": "ALARM-OFF", "status": "OK"}\n');
          }
        });
      })
      // enable scanning
      socket.on('scanON', function(){
        logger.log('debug', 'Starting scanning for tags');
        self.startscan(function(err) {
          if(err) {
            logger.log('error', err);
            socket.write('{"cmd": "SCAN-ON", "status": "FAILED"}\n');
          } else {
            socket.write('{"cmd": "SCAN-ON", "status": "OK"}\n');
          }          
        });
      });
      // disable scan
      socket.on('scanOFF', function(){
        logger.log('debug', 'Stopping scanning for tags');
        self.stopscan(function(err) {
          if(err) {
            logger.log('error', err);
            socket.write('{"cmd": "SCAN-OFF", "status": "FAILED"}\n');
          } else {
            socket.write('{"cmd": "SCAN-OFF", "status": "OK"}\n');
            self.tagsInRange = [];
          }          
        });        
      });
      // write to RFID
      socket.on('writeDATA', function(id, data){
        // return:
        // {"cmd": "WRITE", "status": "OK|FAILED"}
        logger.log('debug', 'Writing to tag: '+id+', data: '+data);
        self.writeISO15693(id, data, function(err) {
          if(err) {
            logger.log('error', err);
            socket.write('{"cmd": "WRITE", "status": "FAILED"}\n');
          } else {
            socket.write('{"cmd": "WRITE", "status": "OK"}\n');
          }          
        });
      });  
    });
  }  
  
  // PRIVATE FUNCTIONS
  // command execution and result callback
  // expects cmd, end of response regex & callback
  var issueCommand = function(cmd, endExpr, callback) {
    reader.write(cmd, function(err) {
      if(err){ callback(err); }
      else {
        var response = '';
        (function loopCmd() {
          if (!endExpr.test(response)) {
            reader.once('data', function(data) {
              response += String(data);
              //setTimeout(function() { loopCmd(); }, 10);
              process.nextTick(function() { loopCmd(); });
            });
          } else {
            callback(null, response);
          } 
        //     reader.removeListener('data', readLoop);
        //   }
        })();

      }
    });
  }

  var initialize = function(cmd, callback) {
    issueCommand(cmd, /\r\n/, function(err, response) {
      if (err){ callback(err)}
      else {
        logger.log('debug', 'initialized reader...')
        // initialized? emit initcodes
        reader.emit('initcodes', readerConfig.protocols[self.tagtype]['initcodes'], /\r\n/, function(err) {
          logger.log('debug', 'initialized reader');
          callback(null);
        });
      }
    });
  }

  var initcodes = function(cmd, endRegex, callback) {
    issueCommand(cmd['register_write_request'], /\r\n/, function(err, result) {
      if (err){ callback(err); }
      logger.log('debug', result);
      issueCommand(cmd['agc_enable'], /\r\n/, function(err, result) {
        if (err) { callback(err); }
        logger.log('debug', result);
        issueCommand(cmd['am_input'], /\r\n/, function(err, result) {
          if (err){ callback(err); }
          else {
            logger.log('debug', result); 
            logger.log('debug', "ran initcodes!");
            callback(null);
          }
        });
      });
    });
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

  // calculate CRC for writing tags, input Array of bytes
  var calculateCRC = function(bytes) {
    var part1 = bytes.slice(0,19),
        part2 = bytes.slice(21,32),
        part3 = ['00','00'];
    
    var hexdata = hex2ascii(part1.concat(part2,part3).join(''));
    var c = crc.crc16CCITT(hexdata).toString(16).match(/.{1,2}/g).reverse();
    return part1.concat(c,part2)
  }
  
  var consolidateTags = function(tags) {

    // step 1: iterate tags into barcode object with count and totals
    var barcodes = {};
    tags.forEach(function(tag) { 
      if( barcodes.propertyIsEnumerable(tag.data.barcode) ) {
        barcodes[tag.data.barcode].count ++
      } else {
        barcodes[tag.data.barcode] = { count: 1, nitems: tag.data.nitems }
      }
    });

    // step 2: loop barcodes and append ok == true on tags that 
    //         have the correct number
    idx = null;
    for (idx in barcodes) {
      if (barcodes[idx].count == barcodes[idx].nitems) {
        tags.forEach(function(a) { 
          if(a.data.barcode == idx) { a.status = "TAGS-OK" };
        });
      } else { 
        tags.forEach(function(a) { 
          if(a.data.barcode == idx) { a.status = "TAGS-MISSING" };
        });
      }
    }
    return tags;
  }
  // TAG LOOP FUNCTIONS - do inventory check
  //var scanLoop = setInterval(function() { scanTagLoop(readerConfig.protocols[self.tagtype]) }, 1000 );
    
  self.scanTagLoop = function (){ 
    // run inventory check in intervals
    inventory(readerConfig.protocols[self.tagtype]['inventory'], function(err) {
      if (err) { 
        logger.log('error', "error: "+err); 
        logger.log('error', 'resetting scan loop!')
        self.stopscan(function(err) {
          if(err) {logger.log('error', 'SYNTAX TERROR'); }
          self.startscan(function(err) {
            if(err) {logger.log('error', 'SYNTAX TERROR2'); }
          });
        });
      }
    });
  }
  
  var stopScan = function() {
    clearInterval(scanLoop);
  }
  
  // INVENTORY COMMAND
  // ISO15693:
  //   single_slot: 010B000304142401000000
  //   multi_slot:  010B000304140401000000
  var inventory = function(cmd, callback) {
    issueCommand(cmd, /\]D/, function(err, response) {
      if (err) { 
        logger.log('error', "Error: "+err);
      } else {
        reader.emit('checkForTags', response, function(err) {
          if(err) { callback(err); }
          callback(null);
        });
      }
    });
  }
  
  // END TAG LOOP FUNCTIONS
  var checkForTags = function(inventory, callback) {
    var tagregex      = /\[([0-9A-F]{16})\,[0-9A-F]{2}/g;  // tag id's are      [ID,POS]
    var conflictregex = /\[([0-9A-F]{16})\,z/g;            // conflict id's are [ID,z]   - ignored for now
    var tags = []
    var match;

    while(match = tagregex.exec(inventory) ) {
      tags.push(match[1]);
    }
    
    if(tags.length > 0) {
      //self.stopscan(function(err) {
      //  if (err) { logger.log('error', 'error stopping scanning: '+err); }
      //});
      tags.forEach(function(tag) {
        // append only tags that isn't already in array
        if (!self.tagsInRange.some(function(some) { return some.id === tag }) ) {
          self.tagsInRange.push({id: tag});
        }
      });
      //self.readerState = 'readtags';  // toggle readerstate
      logger.log('debug', 'tags in range: '+self.tagsInRange);
      reader.emit('readtagdata', self.tagsInRange, function(err) {
        callback(err);
      });
    } else {
      logger.log('debug', 'no tags in range!');
    }
  }
    

  // READ TAG DATA
  var readTagData = function( tags, callback ) {
    var offset = '00';
    var i = 0;
    (function loopFn() {
      logger.log('debug', "sending readtagdata event, id: "+tags[i].id );
      var cmd = ['01','14','00','03','04','18','20','23', tags[i].id, offset, self.blocks_to_read, '00', '00'].join('');
      logger.log('debug', "offset: "+offset+ " id: "+tags[i].id+" tagdata cmd: " + cmd );
      issueCommand(cmd, /\]/, function(err, response) {
        if(err) { callback(err) }
        if(/\[z\]/.test(response) || /\[\]/.test(response) ) {
          callback("conflict in tags!");
        }
        logger.log('debug', "tagread response: "+response); 
        var rfiddata = response.match(/\[00(.+)\]/);     // strip initial 00 response
        if (rfiddata) {
          logger.log('debug', "response data! "+rfiddata[1]);
          reader.emit('rfiddata', rfiddata[1]);
        } else {
          callback("some unknown error");
        }
      });
      i++;
      if (i<tags.length) { setTimeout(loopFn, 100); }
    })();
    callback(null);
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
      if (!item.data) { 
        var tagContent = {
          nitems: tagdata.substring(1,2).charCodeAt(0),
          itemno: tagdata.substring(2,3).charCodeAt(0),
          barcode: tagdata.substring(5,19),
          md5sum: tagdata.substring(19,21),
          country: tagdata.substring(21,23),
          library: tagdata.substring(23,31)
        }
          return item.data = tagContent; 
      }
    });
    if ( self.tagsInRange.every(function(item) { return (item.data) }) ) {
      logger.log('debug', "all tags read!\n" + self.tagsInRange );
      reader.emit('tagsfound', self.tagsInRange);
    }
  }

  self.deactivateAlarm = function(tag, done) {
    self.stopscan(function(err) {
      if (err) { done(err); }
      
      // 0113000304182027 365D5543000104E0 C20000 -> unlock
      // 0113000304182027 365D5543000104E0 070000 -> lock
      // 010C000304141401C2000000 -> inventory, scan for tags with C2
      // 010C00030414140107000000 -> inventory, scan for tags with 07
      var cmd = ['01','13','00','03','04','18','20','27', tag.id, 'C2', '00', '00'].join(''); 
      issueCommand(cmd, /\]/, function(err, response) {
        if (err) { done(err); }
        if (/\[00\]/.test(response)) {
          logger.log('debug', 'deactivated alarm OK: '+tag.id+' response: '+response);
          done();
        } else {
          logger.log('error', 'failed to deactivate alarm: '+tag.id+' - response: '+response);
          done("failure");
        }
      });
    });
  }

  self.activateAlarm = function(tag, done) {
    self.stopscan(function(err) {
      if (err) { done(err); }
      var cmd = ['01','13','00','03','04','18','20','27', tag.id, '07', '00', '00'].join(''); 
      issueCommand(cmd, /\]/, function(err, response) {
        if (err) { done(err); }
        if (/\[00\]/.test(response)) {
          logger.log('debug', 'activated alarm OK: '+tag.id+' response: '+response);
          done();
        } else {
          logger.log('error', 'failed to activate alarm: '+tag.id+' - response: '+response);
          done("failure");
        }
      });
    });
  }

  self.writeTag = function(id, data, done) {
    // TODO: Some more error handling
    // tag written as chunks in block increments of 1 (=4bytes)
    // 0117000304182021 67F4C712500104E0 00 11010131 0000 ['11', '01', '01', '31']
    self.stopscan(function(err) {
      if (err) { done(err); }
      if (/[^0-9A-F]/.test(data)) {
        logger.log.error("error", "Sent invalid bytes: "+data);
        done("Invalid bytes sent!");
      }
      var offset = 0;
      var bytes  = String(data).match(/.{1,2}/g);
      if (bytes.length < 32) { 
        logger.log("error", "invalid length: "+bytes.length+" must be above 32!");
        done("invalid length");
      }

      // calculate CRC and replace
      var updatedCRC = calculateCRC(bytes);

      var chunks = bytes.length / 4;

      (function loopWrite() {
        var str = updatedCRC.slice(offset*4,offset*4+4).join('');
        logger.log('debug', "writing to tag: "+str+" offset: "+offset+" id: "+id );
        var cmd = ['01','17','00','03','04','18','20','21', id, dec2hex(offset), str, '00', '00'].join(''); 
        issueCommand(cmd, /\]/, function(err, response) {
          if(err) { done(err) }
          if(/\[z\]/.test(response) || /\[\]/.test(response) ) {
            logger.log('error', 'failed to write to tag: '+id+' - response: '+response);
            issueCommand(cmd, /\]/, function(err, response) { 
              if(err) { done(err) }
              if(/\[z\]/.test(response) || /\[\]/.test(response) ) {
                logger.log('error', 'retry failed to write to tag: '+id+' - response: '+response);
                done("error writing...giving up!");
              }
            });
          }
          logger.log('debug', 'written data OK: '+str+' response: '+response);
        });
        offset++;
        if (offset<chunks) { 
          setTimeout(function() { loopWrite() }, 300); 
        } else {
          done();
        }
      })();

    });
  }

//       // ANY OTHER PROXIMITY TAG
//       // if (/\[.+\]/.test(data)) {
//       //   var tag = data.match(/\[(.+)\]/);            // tag is anything between brackets
//       //   if (tag && tag[1]) {
//       //     id = reverseTag(tag[1]);
//       //     logger.log('debug', "tag ID: "+id);
//       //     reader.emit('tagfound', id);
//       //   }

}

/*
 * PUBLIC FUNCTIONS
 */

// this function starts scanning for inventory (tags)
Rfidgeek.prototype.startscan = function(callback) {
  var self = this;
  self.readerState = 'inventory';
  self.scanLoop = setInterval(function() { self.scanTagLoop() }, self.scaninterval );
  callback();
}

Rfidgeek.prototype.stopscan = function(callback) {
  var self = this;
  clearInterval(self.scanLoop);
  if (self.readerState == 'inventory') {
    self.readerState = 'paused';
  }
  callback();
}

// this function writes data to ISO15693 chip
Rfidgeek.prototype.writeISO15693 = function(tag, data, callback) {
  var self = this;
  self.writeTag(tag, String(data), function(err) {
    if(err) {callback(err)};
  });
  callback();
}

// this function deactivates AFI - cmd: 18, cmd_code: 27, data: C2
Rfidgeek.prototype.deactivateAFI = function(callback) {
  var self = this;
  if(self.tagsInRange.length > 0) {
    self.tagsInRange.forEach(function(tag) {
      self.deactivateAlarm(tag, function(err) {
        if(err) {callback(err)};
      });
    });
    callback();
  }
}

// this function activates AFI - cmd: 18, cmd_code: 27, data: 07
Rfidgeek.prototype.activateAFI = function(callback) {
  var self = this;
  if(self.tagsInRange.length > 0) {
    self.tagsInRange.forEach(function(tag) {
      self.activateAlarm(tag, function(err) {
        if(err) {callback(err)};
      });
    });
    callback();
  }
}


module.exports = Rfidgeek  
  // for browser compatibility
  //if (typeof module !== 'undefined' && typeof module.exports !== 'undefined')
  //  module.exports = rfidGeek;
  //else
  //  window.rfidGeek = rfidGeek;
//})();
