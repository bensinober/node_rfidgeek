var sys = require("sys");
var com = require("serialport");
//var events = require("events");

// read reader config file
var readerConfig = require('./univelop_500b.json');

// reader variables
var portName = "/dev/ttyUSB0";
var tagType  = "iso15693"
var length_to_read = 5;  // total length to read - 1 
var bytes_per_read = 1;  // no bytes per read - 1

// data variables
var tagData = ''; // this stores the tag data
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
  //parser: com.parsers.readline('\r\n')
}, true); // this is the openImmediately flag [default is true]

/* Workflow:
  Reader gets 'open' event, runs:
  * emit initialize event
  * turns on the scan loop
*/
reader.on('open',function() {
  console.log('Port open');
  reader.emit('initialize', readerConfig.initialize['init']);
  reader.emit('scanloop', readerConfig.protocols[tagType]);
});

/*
  FUNCTIONS
*/

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
var scanLoop = setInterval(function() { scanTagLoop(readerConfig.protocols[tagType]) }, 1000 );
  
var scanTagLoop = function (protocol, callback){ 
  // run inventory check in intervals
  inventory(protocol['inventory'], function(err) {
    if (err) { console.log(err) }
  });
}

var stopScan = function() {
  clearInterval(scanLoop);
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

// readtagdata
// from rfidgeek:
// def issue_command(protocol, cmd, cmd_length, options={})
// read = issue_command(protocol, "18", "0C", :command_code => "23", :offset => "%02X" % offset, :bytes_per_read => "%02X" % bytes_per_read)
// @command = "01" + cmd_length.to_s + "000304" + cmd.to_s + options[:flags] + options[:command_code] + options[:offset] + options[:bytes_per_read] + "0000"

// read data loop
var readTagData = function( offset, callback ) {
  if(offset != length_to_read) {
    cmd = ['01','0C','00','03','04','18','00','23', dec2hex(offset), dec2hex(bytes_per_read), '00', '00'].join('');
    console.log("offset: "+offset+ " tagdata cmd: " + cmd );
    reader.write(cmd, function(err) {
      if(err) { throw new Error (err) }
      offset += bytes_per_read +1;
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

var rfidData = function( data, callback) {
  var str = hex2a(data);
  console.log("rfiddata received: " + str );
  // HERE! do a check on string content!
  readData += str;
  if (readData.length == 16 || str == 'W_OK') {
    console.log("got full tag: "+readData);
    reader.removeListener('readtag', readTag);    
    reader.emit('rfidresult', readTag);
    reader.emit('scanloop', scanLoop);
  } else {
    offset += bytes_per_read;
    reader.emit('readtagdata', offset);
  }
}
// EVENT LISTENERS

reader.on('initialize', initialize);
reader.on('initcodes', initcodes);
reader.on('scanloop', scanTagLoop);
reader.on('readtag', readTag);
reader.on('rfiddata', rfidData);
reader.on('readtagdata', readTagData);

// on data event, do two checks:
// fire 'tag' event if comma in result
// fire rfiddata if data in square brackets
reader.on('data', function( data ) {
  console.log("received: "+data);
  data = String(data)
  if(!!data) {
    // TAG
    switch (data) {
    case (/,40]/.test(data):  
      if (tagData) {                              // no or empty tag found
        reader.emit('tagremoved')
      }
    case (/,..]/.test(data):                      // we have an inventory response! (comma and position)
      var tag=data.match(/\[([0-9A-F]+)\,..\]/);  // check for actual tag - strip away empty tag location ids (eg. ',40) 
      console.log(tag);
      if (tag && tag[1]) {   
        reader.emit('tagfound', tag[1]);
      }
    }
    // RFID DATA
    case (/\[.+\]/.test(data):                    // we have response data! (within brackets, no comma)
      var rfiddata = data.match(/\[00(.+)\]/);
      console.log("response data! "+rfiddata);
      if (rfiddata) {
        reader.emit('rfiddata', rfiddata[1]);
      }
    }
  }
});

// unregister tag if removed
reader.on('tagremoved', function() {
  console.log("Tag removed");
  tagData = '';
});

// register new tag and start readloop
reader.on('tagfound', function( tag ) {
  if (tag != tagData) {                     // do nothing unless new tag is found
    console.log("New tag found!");
    tagData = tag;                          // register new tag
    stopScan();                             // stop scanning for tags
    //reader.removeAllListeners('scanloop');    
    reader.emit('readtag', tag);         // start reading tag
  }
});
  
// error
reader.on('error', function( msg ) {
  console.log("error: " + msg );
});

// close
reader.on('close', function ( err ) {
  console.log('port closed');
});

// End Event Listeners

