var sys = require("sys");
var com = require("serialport");
var events = require("events");

// read reader config file
var readerConfig = require('./univelop_500b.json');

// reader variables
var portName = "/dev/ttyUSB0";
var tagType  = "iso15693"
var length_to_read = 5;  // total length to read - 1 
var bytes_per_read = 0;  // no bytes per read - 1

// data variables
var tagData = ''; // this stores the tag data
var readData = '';  // this stores the read buffer
var start_offset = 1;
        
// Create new serialport pointer
var reader = new com.SerialPort(portName , { 
  baudRate: 115200,
  dataBits: 8,
  parity: 'none',
  stopBits: 1,
  flowControl: false,
  parser: com.parsers.readline('\r\n')
}, true); // this is the openImmediately flag [default is true]

/* Workflow:
  Reader gets 'open' event, runs:
  * emit initialize event
  * turns on the scan loop
*/
reader.on('open',function() {
  console.log('Port open');
  reader.emit('initialize', readerConfig.initialize['init']);
  scanLoop(readerConfig.protocols[tagType], function(err) {
    if (err) {console.log("err: "+err};
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

var dec2hex = function(d) {
  return ("0"+(Number(d).toString(16))).slice(-2).toUpperCase()
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
    });
  }, 1000);
}

// read loop
var readTag = function(tag, callback) {
  query(protocol['inventory'], function(err) {
    if (err) { callback(err) }
  });
}


// EVENT LISTENERS

// initialize reader and emit initcodes event
reader.on('initialize', function(cmd, callback) {
  reader.write(cmd, function(err) {
    if (err){ callback(err)}
    else {
      console.log('initialized reader...')
      // initialized? emit initcodes
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

// on data event, if
// fire 'tag' event if comma in result
// fire rfiddata if data in square brackets
reader.on('data', function( data ) {
  console.log("received: "+data);
  if (/,..]/.test(data) == true) { // we have a tag id! (followed by comma and position)
    var tag=/\[([0-9A-F]+)\,..\]/.exec(data);  // strip away empty tag location ids (eg. ',40) 
    reader.emit('tag', tag);
  }
  else if (/\[.+\]/.test(data) == true) { // then we have received data
    reader.emit('rfiddata', data);
  }
});

// tag
reader.on('tag', function( tag ) {
  console.log("tag id: " + tag );
  tagData = '';  // reset data
  var offset = start_offset;
  reader.emit('tagdata', offset);
});

// rfiddata received
reader.on('rfiddata', function( data ) {
  console.log("rfiddata received: " + data );
  tagData += data;
  if (tagData.length == 16 || data == 'W_OK') {
    console.log("got full tag: "+tagData);
  } else {
    offset += bytes_per_read + 1
    reader.emit('tagdata', offset);
  }
});

// tagdata
// from rfidgeek:
// def issue_command(protocol, cmd, cmd_length, options={})
// read = issue_command(protocol, "18", "0C", :command_code => "23", :offset => "%02X" % offset, :bytes_per_read => "%02X" % bytes_per_read)
// @command = "01" + cmd_length.to_s + "000304" + cmd.to_s + options[:flags] + options[:command_code] + options[:offset] + options[:bytes_per_read] + "0000"

reader.on('tagdata', function( offset ) {
  cmd = ['01','0C','00','03','04','18','00','23', dec2hex(offset), dec2hex(bytes_per_read), '00', '00'].join('');
  console.log("tagdata cmd: " + cmd );
  reader.write(cmd);
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

