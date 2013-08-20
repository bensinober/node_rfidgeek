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
  this.emit('initialize', readerConfig.initialize['init']);
  readloop(readerConfig.protocols[tagType]);
});

// Event Listeners

// initialize
reader.on('initialize', function(cmd, callback) {
  reader.write(cmd, function(err) {
    if (err){ callback(err)}
    else {
      console.log('initialized reader...')
      // initialized? run initcodes
      this.emit('initcodes', readerConfig.protocols[tagType]['initcodes']);
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
            callback();
            }
          });
        }
      });
    }
  });
});

// tagresult
reader.on('tagresult', function( data ) {
  console.log("got tag: "+data);
});

// data
reader.on('data', function( data ) {
  readData += data.toString();
  // read in data between square brackets to result
  var result = readData.substring(readData.indexOf('[') + 1, readData.indexOf(']'));
  if(!!result) {
    this.emit('tagresult', result);
  }
  else {
    console.log("received: "+data);
  }
});

// tag
reader.on('tag', function( msg ) {
  console.log("tag id: " + msg );
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

/*
  Functions
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
    console.log("ran cmd: "+cmd);
  });
}

// inventory command
var inventory = function(cmd, callback) {
  reader.write(cmd, function(err) {
    if (err) { callback(err)}
    else { console.log("ran inventory!") }
  });
}

// read loop
var readloop = function(protocol, callback) {
  setInterval(function (){ 
    query(protocol['inventory'], function(err) {
      if (err) { callback(err) }
    });
  }, 1000);
}


