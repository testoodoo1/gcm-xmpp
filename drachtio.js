//sample application: a SIP proxy 
var drachtio = require('drachtio');
var app = drachtio() ;
/*console.log(app);*/
//connect to a drachtio server 
app.connect({host:'localhost', port: 8022, secret: 'cymru'}) ;

app.invite( function( req, res ) {
  var user = req.msg.uri.match(/sip:(.*?)@(.*?)$/) ;
 
  //search for the user in 3 different locations 
  req.proxy({
    destination: [
      'sip:' + user[1] + '@site1.mycompany.com',
      'sip:' + user[1] + '@site2.mycompany.com',
      'sip:' + user[1] + '@site2.mycompany.com'
    ],
    remainInDialog: true,
    forking: 'simultaneous',
    headers: {
      'Subject': 'Incoming call for ' + user[1] 
    }
  }, function(err, response){
    if( err ) return console.error('Error attempting to proxy request: ', err) ;
    console.log('Final response for proxy: ' + response.finalStatus ) ;
  }) ;
}) ;