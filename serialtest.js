var portName = "/dev/ttyUSB0";
var tagType  = "iso15693"
var sys = require("sys");
var com = require("serialport");
var events = require("events");

// read reader config file
var readerConfig = require('./univelop_500b.json');

// Create new serialport pointer
var reader = new com.SerialPort(portName , { 
  baudRate: 115200,
  dataBits: 8,
  parity: 'none',
  stopBits: 1,
  flowControl: false,
  parser: com.parsers.readline('\r\n')
}, true); // this is the openImmediately flag [default is true]

// data variables
var tagData = ''; // this stores the tag data
var readData = '';  // this stores the buffer

/* Workflow:
  Reader gets 'open' event, runs:
  * initialize
  * initcodes
  * turns on the read tag loop
*/
reader.on('open',function() {
  console.log('Port open');
  reader.emit('initialize', readerConfig.initialize['init']);
  scanLoop(readerConfig.protocols[tagType], function(data) {
    readTag(data, function(err,result) {
      if(!!result) {
        reader.emit('tagfound', result);
      } 
      else {
        return (err);
      }
    });
  });
});

/*
  FUNCTIONS
*/

// Hex string to ASCII
var hex2a = function(hex) {
  var str = '';
  for (var i = 0; i < hex.length; i += 2)
      str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
  return str;
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

// inventory command
var inventory = function(cmd, callback) {
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

// tag loop
var scanLoop = function(protocol, callback) {
  setInterval(function (){ 
    // run inventory check in intervals
    inventory(protocol['inventory'], function(err) {
      if (err) { callback(err) }
      else {
        return tag;
      }
    });
  }, 1000);
}

// read loop
var readTag = function(protocol, callback) {
  setInterval(function (){ 
    query(protocol['inventory'], function(err) {
      if (err) { callback(err) }
    });
  }, 1000);
}




// EVENT LISTENERS

// initialize
reader.on('initialize', function(cmd, callback) {
  reader.write(cmd, function(err) {
    if (err){ callback(err)}
    else {
      console.log('initialized reader...')
      // initialized? run initcodes
      reader.emit('initcodes', readerConfig.protocols[tagType]['initcodes']);
      }
  });
});

// initcodes
reader.on('initcodes', function(cmd, callback) {
  reader.write(cmd['register_write_request'], function(err) {
    if (err){ callback(err)}
    else { 
      reader.write(cmd['agc_enable'], function(err) {
        if (err){ callback(err)}
        else { 
          reader.write(cmd['am_input'], function(err) {
          if (err){ callback(err)}
          else { 
            console.log("finished initializing!");
            }
          });
        }
      });
    }
  });
});

// tagresult
reader.on('tagfound', function( data ) {
  console.log("got tag: "+data);
});


// handling of all data
reader.on('data', function( data ) {
  
  if (/,..]/.test(data) == true) { // we have a tag id! (followed by comma and position)
    console.log("received: "+data);
    var tag=/\[([0-9A-F]+)\,..\]/.exec(data);  // strip away empty tag location ids (eg. ',40) 
    reader.emit('tag', tag);
  }
  else if (/\[.+\]/.test(data) == true) { // then we have received data
    reader.emit('rfiddata', data);
  }
});

// tag
reader.on('tag', function( msg ) {
  console.log("tag id: " + msg );
});

// rfiddata
reader.on('rfiddata', function( msg ) {
  console.log("rfiddata: " + msg );
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

