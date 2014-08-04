/*
 * RFIDGeek Texas Instrument RFID Serial port connector
 * References: 
 *  TI TRF9770A Evaluation Module (EVM) User's Guide, p. 8:
 *    <http://www.ti.com/litv/pdf/slou321a>
 *  PyRFIDGeek (python module):
 *    <https://github.com/scriptotek/pyrfidgeek/blob/master/pyrfidgeek/rfidgeek.py>
 */

var self = module.exports = function rfidGeek(options){

  var util = require('util');
  var EventEmitter = require('events').EventEmitter;
  var crc = require('./lib/crc.js');
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
  var logger = require('./lib/logger');

  /*
   * CONFIGURATION
   */

  // defaults
  var config = {
    websocket: false,
    tcpsocket: false,
    debug: 'none',
    portname: '/dev/ttyUSB0',
    tagtype: 'ISO15693',
    scaninterval: 1000,
    readerconfig: './univelop_500b.json',
    blocks_to_read: '08'
  }

  /*
  * PUBLIC VARIABLES
  */
  var socket = {},
      reader,
      readerConfig,
      tagsInRange = []; // tags in range from inventory
                          // [{ id: <id>, status: <status>, data: { <object> } }]    

  var init = function(options) {
    // merge options with defaults
    var options = options || {};
    util._extend(config, options);

    logger.debugLevel = config.debug ;
    
    /*
     * WEBSOCKET : Communication via websocket
     */

    if(config.websocket) {                    // websocket boolean
      var WebSocket = require("./lib/websocket.js");
      var ws = new WebSocket(this, logger).server;
      ws.on('ready', function(conn) {
        self.socket = conn;
        logger.log('debug', 'Connected to socket');
      });
    }

  /*
   * TCP SOCKET : Communication via net socket
   */

    if(config.tcpsocket) {
      var TCPSocket = require("./lib/tcpsocket.js");
      var tcpsocket = new TCPSocket(this, logger).server;
      tcpsocket.on('ready', function(conn) {
        self.socket = conn;
        logger.log('debug', 'Connected to socket');
      });
    }  

    /* 
     * RFID READER SETUP
     */
    
    readerConfig = require(config.readerconfig),
        start_offset = '00',
        offset = start_offset,
        readerState = 'paused';

     // Create new serialport pointer
    reader = new SerialPort(config.portname, { 
      baudRate: 115200,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      flowControl: false,
      buffersize: 1024
    }, true); // this is the openImmediately flag [default is true]

    
    reader.on('open',function() {
      logger.log('debug', 'Port open');
      
      reader.on('initialize', initialize);
      reader.on('initcodes', initcodes);
      reader.on('checkfortags', checkForTags);
      reader.on('rfiddata', rfidData);
      reader.on('readtagdata', readTagData);
      // unregister tag if removed
      reader.on('tagremoved', function() {
        logger.log('debug', 'Tag removed');
        if (config.websocket) {
          socket.sendUTF("Tag removed");
        }
        //tagData = '';
      });
      
      // INVENTORY DONE, TAGS FOUND AND READ. TIME TO EMIT RESULTS 
      // updateTagsStatus fixes item counts
      // start inventory if ISO15693 tag, else ignore
      // all tags in tagsInRange should be read
      reader.on('tagsfound', function( tags ) {
        if (tags.length > 0) {                         // do nothing unless tags in range
          tags = updateTagsStatus(tags);

          logger.log('debug', "New tag(s) found!");
          if (config.websocket) {
            socket.sendUTF(tags);
          }
          self.emit('tagsInRange', tags);             // emit to calling external app!
          if (socket) {
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
                socket.write(jsonresponse+"\n");
                if (tag.status == "TAGS-OK") {
                  tag.validated = true;
                }
              }
            })
          }
          if (config.tagtype == 'ISO15693') {           // if ISO15693 tag:
         //   stopScan();
            /*self.stopscan();                        //   stop scanning for tags*/
          //  readTags(tags);                           //   start read tags content
          }
        } else {
          logger.log('debug', "no tags in range...");
        }
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


  }

  /*
  *  EVENT FUNCTIONS
  */
  
  // command execution and result callback
  // expects cmd, end of response regex & callback
  var issueCommand = require('./lib/commands.js').issueCommand;
/*
  var issueCommand = function(cmd, endExpr, callback) {
    //console.log("cmd: "+cmd+"\nreg: "+endExpr);
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
        //     reader.removeListener('data', loopCmd);
        //   }
        })();
      }
    });
  }
*/
  var initialize = function(cmd, callback) {
    issueCommand(reader, cmd, /\r\n/, function(err, response) {
      if (err){ callback(err)}
      else {
        logger.log('debug', 'initialized reader...')
        // initialized? emit initcodes
        reader.emit('initcodes', readerConfig.protocols[config.tagtype]['initcodes'], /\r\n/, function(err) {
          logger.log('debug', 'initialized reader');
          callback(null);
        });
      }
    });
  }

  var initcodes = function(cmd, endRegex, callback) {
    issueCommand(reader, cmd['register_write_request'], /\r\n/, function(err, result) {
      if (err){ callback(err); }
      logger.log('debug', result);
      issueCommand(reader, cmd['agc_enable'], /\r\n/, function(err, result) {
        if (err) { callback(err); }
        logger.log('debug', result);
        issueCommand(reader, cmd['am_input'], /\r\n/, function(err, result) {
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

  // INVENTORY COMMAND
  // ISO15693:
  //   single_slot: 010B000304142401000000
  //   multi_slot:  010B000304140401000000
  var inventory = function(cmd, callback) {
    issueCommand(reader, cmd, /\]D/, function(err, response) {
      if (err) { 
        logger.log('error', "Error: "+err);
      } else {
        reader.emit('checkfortags', response, function(err) {
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
        if (!tagsInRange.some(function(some) { return some.id === tag }) ) {
          tagsInRange.push({id: tag});
        }
      });
      //readerState = 'readtags';  // toggle readerstate
      logger.log('debug', 'tags in range: '+tagsInRange);
      reader.emit('readtagdata', tagsInRange, function(err) {
        if(err) { callback(err) };
        callback();
      });
    } else {
      logger.log('debug', 'no tags in range!');
    }
  }
    

  // READ TAG DATA
  var readTagData = function(tags, callback) {
    var offset = '00';
    var i = 0;
    (function loopFn() {
      logger.log('debug', "sending readtagdata event, id: "+tags[i].id );
      var cmd = ['01','14','00','03','04','18','20','23', tags[i].id, offset, blocks_to_read, '00', '00'].join('');
      logger.log('debug', "offset: "+offset+ " id: "+tags[i].id+" tagdata cmd: " + cmd );
      issueCommand(reader, cmd, /\]/, function(err, response) {
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
  var rfidData = function(data, callback) {
    var tagdata = hex2ascii(data);
    logger.log('debug', "rfiddata received: " + tagdata);
    // append rfiddata to tags missing data, hopefully they come in right order
    tagsInRange.some(function(item) { 
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
    if ( tagsInRange.every(function(item) { return (item.data) }) ) {
      logger.log('debug', "all tags read!\n" + tagsInRange );
      reader.emit('tagsfound', tagsInRange);
    }
  }

  /*
  *  PRIVATE FUNCTIONS
  */

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
  
  // populate tags object with status if tag count is OK or missing
  // according to ISO15693 RFID standard DS24
  var updateTagsStatus = function(tags) {
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

  var startScan = function(callback) { 
    // run inventory check in intervals
    scanLoop = setInterval(function() { 
      inventory(readerConfig.protocols[config.tagtype]['inventory'], function(err) {
        if (err) { 
          logger.log('error', "error: "+err); 
          stopScan(function(err) {
            if(err) {
              logger.log('error', 'Error starting scan loop: '+err); 
              callback(err);
            }
          });
        }
      });
    }, config.scaninterval );
    callback(); //success
  }

  var stopScan = function() {
    if(scanLoop) { clearInterval(scanLoop) };
  }

  var deactivateAlarm = function(tag, done) {
    self.stopscan(function(err) {
      if (err) { done(err); }
      
      // 0113000304182027 365D5543000104E0 C20000 -> unlock
      // 0113000304182027 365D5543000104E0 070000 -> lock
      // 010C000304141401C2000000 -> inventory, scan for tags with C2
      // 010C00030414140107000000 -> inventory, scan for tags with 07
      var cmd = ['01','13','00','03','04','18','20','27', tag.id, 'C2', '00', '00'].join(''); 
      issueCommand(reader, cmd, /\]/, function(err, response) {
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

  var activateAlarm = function(tag, done) {
    self.stopscan(function(err) {
      if (err) { done(err); }
      var cmd = ['01','13','00','03','04','18','20','27', tag.id, '07', '00', '00'].join(''); 
      issueCommand(reader, cmd, /\]/, function(err, response) {
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

  var writeTag = function(id, data, done) {
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
        issueCommand(reader, cmd, /\]/, function(err, response) {
          if(err) { done(err) }
          if(/\[z\]/.test(response) || /\[\]/.test(response) ) {
            logger.log('error', 'failed to write to tag: '+id+' - response: '+response);
            issueCommand(reader, cmd, /\]/, function(err, response) { 
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

  /*
   * PUBLIC FUNCTIONS
   */

  return {
    init: init,
    config: config,
    startScan: startScan,
    stopScan: stopScan,
    socket: socket,
    tags: tagsInRange,
    // this function writes data to ISO15693 chip
    writeISO15693: function(tag, data, callback) {
      //var self = this;
      writeTag(tag, String(data), function(err) {
        if(err) {callback(err)};
      });
      callback();
    },

    // this function deactivates AFI - cmd: 18, cmd_code: 27, data: C2
    deactivateAFI: function(callback) {
      //var self = this;
      if(tagsInRange.length > 0) {
        tagsInRange.forEach(function(tag) {
          deactivateAlarm(tag, function(err) {
            if(err) {callback(err)};
          });
        });
        callback();
      }
      callback();
    },

    // this function activates AFI - cmd: 18, cmd_code: 27, data: 07
    activateAFI: function(callback) {
      //var self = this;
      if(tagsInRange.length > 0) {
        tagsInRange.forEach(function(tag) {
          activateAlarm(tag, function(err) {
            if(err) {callback(err)};
          });
        });
        callback();
      }
      callback();
    },

    close: function() {
      self.socket.close();
    }
}
}();

  // for browser compatibility
  //if (typeof module !== 'undefined' && typeof module.exports !== 'undefined')
  //  module.exports = rfidGeek;
  //else
  //  window.rfidGeek = rfidGeek;
//})();