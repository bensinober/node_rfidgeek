var expect = require('expect.js');
var rfid = require('../rfid');

describe('Tags',function() {
  beforeEach(function() {
    rfid.tags = [];
  });

  it('populate single tag object with status TAGS-OK if tag is present', function() {
    var tags = [ { data: { barcode: "XXXXXXXX", nitems: 1, itemno: 1 }} ];
    var item = rfid._updateTagsStatus(tags);
    expect(item[0].status).to.be("TAGS-OK");
  });

  it('populate multiple tag object with status TAGS-OK if all tags ARE present', function() {
    var tags = [ 
      { data: { barcode: "XXXXXXXX", nitems: 2, itemno: 1 }},
      { data: { barcode: "XXXXXXXX", nitems: 2, itemno: 2 }} 
    ];
    var item = rfid._updateTagsStatus(tags);
    expect(item.length).to.be(2);
    expect(item[0].status).to.be("TAGS-OK");
    expect(item[1].status).to.be("TAGS-OK");
  });

  it('populate tag object with status TAGS-MISSING if not all tags are present', function() {
    var tags = [ 
      { data: { barcode: "XXXXXXXX", nitems: 2, itemno: 1 }}
    ];
    var item = rfid._updateTagsStatus(tags);
    expect(item[0].status).to.be("TAGS-MISSING");
  });

  it('populate tag object with status TAGS-MISSING if a tag has wrong barcode', function() {
    var tags = [ 
      { data: { barcode: "XXXXXXXX", nitems: 2, itemno: 1 }},
      { data: { barcode: "YYYYYYYY", nitems: 2, itemno: 2 }} 
    ];
    var item = rfid._updateTagsStatus(tags);
    expect(item[0].status).to.be("TAGS-MISSING");
  });

});