h1. Simple rfidgeek adaptor to Node.js
(See test.js for example on use)

Uses event emitters for passing iso15693 tag and content, which can be captured by
instantiating an Rfidgeek object thus:

var Rfidgeek = require('rfidgeek'); 
var rfid = new Rfidgeek();

Alternatively, the controller can be passed to an included websocket server, which 
in turn broadcasts to any websocket client connected at port 8080. 

var Rfidgeek = require('rfidgeek'); 
var rfid = new Rfidgeek({
  websocket: true
});

For more options check the rfid.js file
