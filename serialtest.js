var rfidGeek = (function() {
  
  var com = require("serialport");
  //var ws = require("./websocket.js").client;
  var wsServer = require("./wsserver.js").wsServer;
  var wsClient = require("./wsclient.js").wsClient;
  wsClient.connect('ws://localhost:4568');
  
  // VARIABLES
  var portName = "/dev/ttyUSB0";
  var tagType  = "iso15693"
  var length_to_read = 5;  // total length to read - 1 
  var bytes_per_read = 1;  // no bytes per read - 1
  var scanloop = null;     // scan loop handle
    
  // read reader config file
  var readerConfig = require('./univelop_500b.json');
  
  // data variables
  var tagData = '';   // this stores the tag data
  var readData = '';  // this stores the read buffer
  var start_offset = 1;
  var offset = start_offset;
          
  // Create new serialport pointer
  var reader = new com.SerialPort(portName , { 
    baudRate: 115200,
    dataBits: 8,
    parity: 'none',
    stopBits: 1,
    flowControl: false,
    buffersize: 1024
  }, true); // this is the openImmediately flag [default is true]
  
 
  /* Workflow:
    Reader gets 'open' event, runs:
    * emit initialize event
    * turns on the scan loop
    * gets tag data, quits scan loop
  */
  
  // EVENT LISTENERS
  
  reader.on('open',function() {
    console.log('Port open');
    
    reader.on('initialize', initialize);
    reader.on('initcodes', initcodes);
    reader.on('scanloop', startScanLoop);
    reader.on('readtag', readTag);
    reader.on('rfiddata', rfidData);
    reader.on('readtagdata', readTagData);
    
    // unregister tag if removed
    reader.on('tagremoved', function() {
      console.log("Tag removed");
      //ws.send("Tag removed");
      tagData = '';
    });
    
    // register new tag and start readloop
    reader.on('tagfound', function( tag ) {
      if (tag != tagData) {                     // do nothing unless new tag is found
        console.log("New tag found!");
        //ws.send("Tag found"+tag);
        tagData = tag;                          // register new tag
        stopScanLoop();                         // stop scanning for tags
        readTag(tag);
      } else {
        console.log("same tag still...");
      }
    });
  
    reader.on('rfidresult', function(data) {
      console.log("Jippi! got rfid: "+data);
      socket.sendUTF(data);
    });
    
    reader.on('data', gotData);
    
    reader.emit('initialize', readerConfig.initialize['init']);
    reader.emit('scanloop');
  });
  
  // error
  reader.on('error', function( msg ) {
    console.log("error: " + msg );
  });
  
  // close
  reader.on('close', function ( err ) {
    console.log('port closed');
  });
  
  // FUNCTIONS
  
  // initialize reader and emit initcodes event
  var initialize = function(cmd, callback) {
    reader.write(cmd, function(err) {
      if (err){ callback(err)}
      else {
        console.log('initialized reader...')
        // initialized? emit initcodes
        reader.emit('initcodes', readerConfig.protocols[tagType]['initcodes']);
      }
    });
  }
  
  // run initcodes (before each tag loop)
  var initcodes = function(cmd, callback) {
    reader.write(cmd['register_write_request'], function(err) {
      if (err){ callback(err)}
      else { 
        reader.write(cmd['agc_enable'], function(err) {
          if (err){ callback(err)}
          else { 
            reader.write(cmd['am_input'], function(err) {
            if (err){ callback(err)}
            else { 
              console.log("ran initcodes!");
              }
            });
          }
        });
      }
    });
  }
  
  // Hex string to ASCII
  var hex2a = function(hex) {
    var str = '';
    for (var i = 0; i < hex.length; i += 2)
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    return str;
  }
  
  var dec2hex = function(d) {
    return ("0"+(Number(d).toString(16))).slice(-2).toUpperCase()
  }
  
  // TAG LOOP FUNCTIONS - do inventory check
  var startScanLoop = function() {
    scanloop = setInterval(function() { 
      scanTagLoop(readerConfig.protocols[tagType]);
    }, 1000 );
  }
  
  var stopScanLoop = function() {
    clearInterval(scanloop);
  }
  
  var scanTagLoop = function (protocol, callback){ 
    // run inventory check in intervals
    inventory(protocol['inventory'], function(err) {
      if (err) { console.log(err) }
    });
  }
  
  // inventory command
  var inventory = function(cmd, callback) {
    console.log("inventory cmd: "+cmd);
    reader.write(cmd, function(err) {
      if (err) { 
        console.log("err: "+err);
        callback(err)
      }
      else { 
        console.log("ran inventory!") 
      }
    });
  }
  // END TAG LOOP FUNCTIONS
  
  // initialize read tag loop
  var readTag = function( tag, callback ) {
    reader.emit('initcodes', readerConfig.protocols[tagType]['initcodes']);
    //console.log("found tag id: " + tag );
    readData = '';  // reset data
    offset = start_offset;
    console.log("sending readtagdata event, offset: "+offset );
    reader.emit('readtagdata', offset);
  }
  
  // read data loop
  var readTagData = function( offset, callback ) {
    if(offset != length_to_read) {
      cmd = ['01','0C','00','03','04','18','00','23', dec2hex(offset), dec2hex(bytes_per_read), '00', '00'].join('');
      console.log("offset: "+offset+ " tagdata cmd: " + cmd );
      reader.write(cmd, function(err) {
        if(err) { throw new Error (err) }
        offset += bytes_per_read ;
        // delay next read to next event loop for stability
        process.nextTick(function() {
          readTagData(offset);
        });
      });
    }
  }
  
  // query command
  var query = function(cmd, callback) {
    reader.write(cmd, function(err) {
      if (err){ callback(err) }
      else {
        console.log("ran cmd: "+cmd+"...waiting for data");
      }
    });
  }
  
  // function rfidData, on rfiddata event
  var rfidData = function( data, callback) {
    var str = hex2a(data);
    console.log("rfiddata received: " + str );
    // HERE! do a check on string content!
    readData += str;
    // rfid data consumed
    if (readData.length >= 8 || str == 'W_OK') {
      console.log("got full tag: "+readData);
      reader.removeListener('readtag', readTag);    
      reader.emit('rfidresult', readData.substr(1) );   // remove first character from string
      // start new scanloop
      startScanLoop();
    } else {
      // continue reading
      offset += bytes_per_read;
      reader.emit('readtagdata', offset);
    }
  }
  
  // data event
  var gotData = function( data ) {
    console.log("received: "+data);
    data = String(data)
    if(!!data) {
      // NO TAG
      if (/,40]/.test(data)) {
        console.log('no tag ...');
        if (tagData) {                              // if tagData exist then tag is considered removed
          reader.emit('tagremoved')
        }
      } 
      // TAG
      else if (/,..]/.test(data)) {                 // we have an inventory response! (comma and position)
        var tag=data.match(/\[([0-9A-F]+)\,..\]/);  // check for actual tag - strip away empty tag location ids (eg. ',40) 
        if (tag && tag[1]) {   
          console.log('tag! '+tag[1]);
          reader.emit('tagfound', tag[1]);
        }
      }
      
      // RFID DATA
      else if (/\[.+\]/.test(data)) {                   // we have response data! (within brackets, no comma)
        var rfiddata = data.match(/\[00(.+)\]/);        // strip initial 00 response
        console.log("response data! "+rfiddata);
        if (rfiddata) {
          reader.emit('rfiddata', rfiddata[1]);
        }
      }
    }
  }
  
  // for browser compatibility
  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined')
    module.exports = rfidGeek;
  else
    window.rfidGeek = rfidGeek;
})();
