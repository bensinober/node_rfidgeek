var portName = "/dev/ttyUSB0";
var tagType  = "14443A"
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
  this.emit('initcodes', readerConfig.protocols[tagType]['initcodes']);
  readloop(readerConfig.protocols['14443A']);
});

// Event Listeners

// initialize
reader.on('initialize', function(cmd, callback) {
  reader.write(cmd, function(err, results) {
    if (err){ console.log("err: "+err)}
    else {console.log('initialized reader...');}
  });
});

// initcodes
reader.on('initcodes', function(cmd, callback) {
  reader.write(cmd['register_write_request'], function(err,results) {
    if (err){ console.log("err: "+err)}
    else { 
      reader.write(cmd['agc_enable'], function(err,results) {
        if (err){ console.log("err: "+err)}
        else { 
          reader.write(cmd['am_input'], function(err,results) {
          if (err){ console.log("err: "+err)}
          else { 
            console.log("finished initializing!");
            return results;
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

var query = function(cmd, callback) {
  reader.write(cmd, function(err,callback) {
    if (err){ console.log("err: "+err)}
    console.log("ran cmd!");
  });
}

// inventory lookup
var inventory = function(cmd, callback) {
  reader.write(cmd, function(err,result) {
    if (err){ console.log("err: "+err)}
    else { console.log("ran inventory!") }
  });
}

var readloop = function(protocol) {
  setInterval(function (){ 
    inventory(protocol['inventory'], function(err, result) {
      if (err) { return err; }
      else return result;
    });
  }, 1000);
}


