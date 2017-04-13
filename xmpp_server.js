require( "console-stamp" )( console, {pattern : "yyyy-mm-dd HH:MM:ss.l", colors: {stamp: "green",label: "yellow"}} );  
require('events').EventEmitter.prototype._maxListeners = 100;
var xmpp = require('node-xmpp-server');
var crypto = require('crypto');
var serialize = require('node-serialize');
var base64 = require('base64encodedecode');
var DOMParser = require('xmldom').DOMParser;
var util = require('util');


var colors = require("colors");
function makeColorConsole(fct, color){
  return function(){
    for (var i in arguments)
      if (arguments[i] instanceof Object)
        arguments[i] = sys.inspect(arguments[i]);
    fct(Array.prototype.join.call(arguments," ")[color]);
  };
}
console.warn = makeColorConsole(console.warn, "yellow");
console.error = makeColorConsole(console.error, "red");


var namespace = 'projectk:mobile:data';

var clients = [];
//var domain = 'xmpp.projectk.oodoo.co.in';
//var domain = '192.168.0.100'; //demo
var domain = '192.168.1.17';
//var domain = 'localhost';
var port = 5245;
var c2s = new xmpp.C2SServer({
    port: port,
    domain: domain

});

var mysql      = require('mysql2');
    var connection = mysql.createConnection({
      host     : 'localhost',
      user     : 'root',
      password : '1projectK!',
      database : 'gcm',
    }); 

var util = require('util');

function ackUpdate(message_id, message_status){
            connection.prepare('INSERT INTO AckTable (message_id, message_status) values (?,?) ON DUPLICATE KEY UPDATE message_status = ?', function(err, statement){
                statement.execute([message_id, message_status, message_status], function(err, rows, columns){
                    console.log('ACK UPDATED:'+message_id , message_status);

                });
                statement.close();
            });     
}

function saveAndSend(pcm_parse, client, stanza){
        //console.log(to);
        var to = pcm_parse.data.to.toLowerCase()+'@'+domain;

        var from = pcm_parse.data.from;
        var receiverClient = clients[to];
        //console.log(clients[to]);
        if(receiverClient === undefined){
            console.log('undefined : '+to);
         } else {
            console.log('defined : '+to);
            receiverClient.send(stanza);
            var status = 'SERVER_SENT';
            ackUpdate(pcm_parse.message_id, 'SERVER_SENT');
            
        }
}

function sendNack(message, client, message_id){
    var msg = new xmpp.Stanza('message').c('pcm', xmlns="projectk:mobile:data").t('{ "data": { "error" : "'+message+'"}, "message_id" : "'+message_id+'", "message_type" : "nack" }').up();
    console.log('SENDING NACK: '+message, message_id);
    client.send(msg);
}
function sendAck(message_id, client, message){
    var msg = new xmpp.Stanza('message').c('pcm', xmlns="projectk:mobile:data").t('{ "data": { "ack_type" : "'+message+'"}, "message_id" : "'+message_id+'", "message_type" : "ack" }').up();
    console.log('SENDING ACK: '+message);
    client.send(msg);
}
function sendAckChannel(message_id, client, message){
    var msg = new xmpp.Stanza('message').c('pcm', xmlns="projectk:mobile:data").t('{ "data": { "ack_type" : "'+message+'"}, "message_id" : "'+message_id+'", "message_type" : "channelInfo" }').up();
    console.log('SENDING ACK: '+message);
    client.send(msg);
}
  

// On Connect event. When a client connects.
c2s.on("connect", function(client) {

        c2s.on('register', function(opts, cb) {
            console.log('REGISTER')
            cb(false)
        })

    client.on("authenticate", function(opts, cb) {
        console.log('AUTHENTICATING : ' +opts.username);
        //console.log("AUTH: " + opts.jid + " -> " +opts.password); 
        connection.prepare('SELECT * from DeviceTable where user_id = ?',function(err, statement){
            statement.execute([opts.username], function(err, rows, columns) {
                    if(rows.length > 0){

                        device_id = rows[0].device_id;
                        var client_user = opts.jid;
                        var password = crypto.createHash('md5').update(device_id+opts.username).digest("hex");
                            if (opts.password === password) {
                                console.log('AUTH : Success ==> '+opts.username);
                                cb(null, opts)
                                //console.log('client push:'+opts.jid);
                                clients[opts.jid] = client;
                            }else{
                                console.error('AUTH : Fail ==> Invalid Password');
                                //console.log('AUTH:', opts.username, password, opts.password, 'AUTH FAIL')
                                cb(false)
                            }
                    }else{
                        console.error('AUTH : Fail ==> Invalid Username : '+ opts.username );
                        //sendNack('INVALID USER_NAME OR PASSWORD',client, "");
                        cb(false)
                    }
            });
            statement.close();
        });
    });



    client.on("online", function() {
        



    console.log('SERVER:', client.jid.user, 'ONLINE');
        connection.query('UPDATE DeviceTable SET status = ? WHERE user_id = ?', ['ONLINE', client.jid.user], function(err, res){
            if(err) throw err;
            console.log('Client Status Updated');
        });
/*        connection.prepare('select message_id FROM AckTable where message_status = "SERVER_SENT" and message_id in (select message_id from MessageTable where to_user = ?)',function(err, statement){
            statement.execute([client.jid.user], function(err, rows, columns) {
                if(rows.length > 0){
                    for(var i=0; i < rows.length; i++){
                        var message_id_now = rows[i].message_id;
                        console.log(message_id_now);
                        connection.execute('select * from MessageTable where message_id = ?',[message_id_now],function(err, row){
                                console.log('------------------------------------');
                                var message = new xmpp.Stanza('message').c('pcm', xmlns="projectk:mobile:data").t('{"data": {"to":"pjtku5","from":"'+row[0].from_user+'","action":"chat","message":"'+row[0].message+'"}, "message_id":"'+row[0].message_id+'","message_type" : "data"}').up();
                                client.send(message);
                                console.log(message.toString());
                        });
                    }
                }
            });
        });*/

    });



    client.on("stanza", function(stanza) {
        //console.log('stanza RECEIVED: ' +stanza.toString() );

    if(!stanza.is("message")){
        console.log('INVALID_STANZA_TYPE');
        //sendNack('INVALID_STANZA_TYPE', client, "");
    }else if(stanza.getChildText("pcm")){
        //parsing pcm contents
       var pcm_parse = ''
       try{
            var pcm_attrs = stanza.getChildText("pcm");
            var pcm_parse = JSON.parse(pcm_attrs);
        }catch(err){
            console.error(err);
        }
        //getting namespace of pcm
       var ns = '';
        try{
        var parser = new DOMParser();
        xmlDoc = parser.parseFromString(stanza.children.toString(),"text/xml");
        var ns = xmlDoc.getElementsByTagName("pcm")[0].namespaceURI
        }catch(err){
            console.error(err);
        } 

        if(!pcm_parse.message_id){
            sendNack('INVALID_MESSAGE_ID', client, "");
        }else if(ns != namespace){
            sendNack('INVALID_NAMESPACE', client, pcm_parse.message_id);
        }else if(pcm_parse.message_type){
            switch(pcm_parse.message_type){
                case 'data':
                    var to_split = '';
                    try{
                    var to_split = pcm_parse.data.to.split('@');
                    var to_split = to_split[0];
                    }catch(err){
                        console.error(err);
                    }
                    connection.prepare('SELECT user_id FROM DeviceTable WHERE user_id IN (?, ?)',function(err, statement){
                        statement.execute([client.jid.user, to_split], function(err, rows, columns) {
                        try{
                            if(rows.length > 1){
                            var rows_2 = rows[1].user_id;
                            }
                            var rows_1 = rows[0].user_id;
                        }catch(err){
                            console.error(err);
                        }
                            if(!pcm_parse.data.to || (rows_1 === undefined || rows_2 === undefined)){
                                sendNack('INVALID_TO_USER', client, pcm_parse.message_id);
                            }else if(!pcm_parse.data.from || (rows_1 === undefined || rows_2 === undefined)){
                                sendNack('INVALID_FROM_USER', client, pcm_parse.message_id);
                            }else{
                                var action = pcm_parse.data.action.toLowerCase();
                                if(action == 'chat' ){
                                            if(!pcm_parse.data.message){
                                                sendNack('INVALID_MESSAGE', client, pcm_parse.message_id);
                                            }else{
                                                connection.query('CREATE TABLE IF NOT EXISTS MessageTable (id int PRIMARY KEY AUTO_INCREMENT NOT NULL, message_id VARCHAR(50), to_user VARCHAR(100), from_user VARCHAR(100), message VARCHAR(256))');


                                                            connection.prepare('INSERT INTO MessageTable (message_id, to_user, from_user, message) VALUES (?,?,?,?)', function(err, statement){
                                                                statement.execute([pcm_parse.message_id, pcm_parse.data.to, pcm_parse.data.from, pcm_parse.data.message], function(err, rows, columns){

                                                                    console.log('stanza attrs to: '+pcm_parse.data.to);
                                                                    sendAck(pcm_parse.message_id, client, 'SERVER_RECEIVED');
                                                                    saveAndSend(pcm_parse, client, stanza);

                                                                });
                                                                statement.close();
                                                            });                                                    



                                        
                                            }
                                }else if(action == 'ad_display'){

                                        if(!pcm_parse.data.ad_data){
                                            sendNack('INVALID_AD_DISPLAY', client, pcm_parse.message_id);
                                        }else{
/*                                            connection.query('CREATE TABLE IF NOT EXISTS AdTable (id int PRIMARY KEY AUTO_INCREMENT NOT NULL, message_id VARCHAR(50), to_user VARCHAR(100), from_user VARCHAR(100), ad_data VARCHAR(256))');
                                            connection.prepare('INSERT INTO AdTable (message_id, to_user, from_user, ad_data) values (?,?,?,?)', function(err, statement){
                                                statement.execute([pcm_parse.message_id, pcm_parse.data.to, pcm_parse.data.from, pcm_parse.data.ad_data], function(err, rows, columns){
                                                    saveAndSend(pcm_parse, client, stanza);
                                                    

                                                });
                                                statement.close();
                                            });*/

                                            saveAndSend(pcm_parse, client, stanza);
                                            
                                        }

                                }else if(action == 'notify'){
                                    console.log('into log');
                                    if(!pcm_parse.data.notify_data){
                                        sendNack('INVALID_NOTIFY_DATA', client, pcm_parse.message_id);
                                    }else{
                                       saveAndSend(pcm_parse, client, stanza);
                                    }
                                }else{
                                    sendNack('INVALID_ACTION', client, pcm_parse.message_id);
                                }
                }
            });
            statement.close();
        });
                break;
                case 'ack':
                    if(!pcm_parse.data.ack_type){
                        sendNack('INVALID_ACK_TYPE', client, pcm_parse.message_id);
                    }else{
                            connection.query('CREATE TABLE IF NOT EXISTS AckTable (message_id VARCHAR(50) NOT NULL PRIMARY KEY , message_status VARCHAR(50))');
                            connection.prepare('SELECT * from AckTable where message_id = ?',function(err, statement){
                                statement.execute([pcm_parse.message_id], function(err, rows, columns) {
                                    if(rows.length > 0 ){
                                        console.log('into ack check');
                                        connection.prepare('SELECT from_user from MessageTable where message_id = ?',function(err, statement){
                                            statement.execute([pcm_parse.message_id], function(err, rows, columns) { 
                                                if(rows.length > 0){
                                                    from_user = rows[0].from_user;
                                                

                                                if(from_user != undefined && from_user != ' ' && from_user != null){
                                                if(pcm_parse.ack_type == 'CLIENT_RECEIVED' && rows[0].message_status == 'SERVER_SENT'){
                                                    ackUpdate(pcm_parse.message_id, pcm_parse.ack_type);
                                                    sendAck(pcm_parse.message_id, clients[from_user], 'MESSAGE_DELIEVERED');
                                                }else if(pcm_parse.ack_type == 'CLIENT_READ' && rows[0].message_status == 'CLIENT_RECEIVED'){
                                                    ackUpdate(pcm_parse.message_id, pcm_parse.ack_type);                                                    
                                                    sendAck(pcm_parse.message_id, clients[from_user], 'MESSAGE_READ');
                                                }else{
                                                    sendNack('INVALID_ACK_TYPE', client, pcm_parse.message_id);
                                                }
                                            }
                                        }
                                                
                                                });
                                                statement.close();
                                            });                                          
                                        
                                    }else{ 

                                        connection.prepare('INSERT INTO AckTable (message_id, message_status) values (?,?) ON DUPLICATE KEY UPDATE message_status = ?', function(err, statement){
                                            statement.execute([pcm_parse.message_id, pcm_parse.data.ack_type, pcm_parse.data.ack_type], function(err, rows, columns){
                                                console.log('ACK RECEIVED :'+pcm_parse.message_id, pcm_parse.data.ack_type);

                                            });
                                            statement.close();
                                        });                                

                                 }
                                });
                                statement.close();
                            });
                    }
                break;
                case 'nack':
                    if(!pcm_parse.data.error){
                        sendNack('INVALID_ERROR', client, pcm_parse.message_id);
                    }else{
                            connection.query('CREATE TABLE IF NOT EXISTS NackTable (message_id VARCHAR(50) NOT NULL PRIMARY KEY , error VARCHAR(256))');
                            connection.prepare('INSERT INTO NackTable (message_id, error) values (?,?) ON DUPLICATE KEY UPDATE error = ?', function(err, statement){
                                statement.execute([pcm_parse.message_id, pcm_parse.data.error, pcm_parse.data.error], function(err, rows, columns){
                                    console.log('NACK RECEIVED :'+pcm_parse.message_id);

                                });
                                statement.close();
                            });                                

                    }                            
                break;
                case 'channelInfo':
                    if(!pcm_parse.data.user_id){
                        sendNack('INVALID_USER_ID', client, pcm_parse.message_id);
                    }else if(!pcm_parse.data.channel_number){
                        sendNack('INVALID_CHANNEL_NUMBER', client, pcm_parse.message_id);
                    }else if(!pcm_parse.data.current_timestamp){
                        sendNack('INVALID_CURRENT_TIMESTAMP', client, pcm_parse.message_id);
                    }else{
                        connection.query('CREATE TABLE IF NOT EXISTS CurrentChannel (user_id VARCHAR(20) NOT NULL PRIMARY KEY, channel_id VARCHAR(50), updated_at TIMESTAMP )');
                        connection.prepare('INSERT INTO CurrentChannel (user_id, channel_id, updated_at) values (?,?,?) ON DUPLICATE KEY UPDATE channel_id = ?, updated_at = ?', function(err, statement){
                            statement.execute([pcm_parse.data.user_id, pcm_parse.data.channel_number, pcm_parse.data.current_timestamp, pcm_parse.data.channel_number, pcm_parse.data.current_timestamp ], function(err, rows, columns){
                                console.log('channel Info received');
                                sendAckChannel(pcm_parse.message_id, client, 'CHANNEL_INFO_RECEIVED');
                            });
                            statement.close();
                        }); 

                        connection.query('CREATE TABLE IF NOT EXISTS ChannelHistory (id int PRIMARY KEY AUTO_INCREMENT NOT NULL, user_id VARCHAR(20), channel_id VARCHAR(50), updated_at TIMESTAMP)');
                        connection.prepare('INSERT INTO ChannelHistory (user_id, channel_id, updated_at) values (?,?,?)', function(err, statement){
                            statement.execute([pcm_parse.data.user_id, pcm_parse.data.channel_number, pcm_parse.data.current_timestamp], function(err, rows, columns){


                            });
                            statement.close();
                        });                        
                    }
                break;
                default:
                    sendNack('INVALID_MESSAGE_TYPE', client, pcm_parse.message_id);                  

            }
        }
        else{
            sendNack('INVALID_MESSAGE_TYPE',client, pcm_parse.message_id);
        }



    }else{
        sendNack('INVALID_PCM', client, "")
    }

    });

    client.on('disconnect', function () {
    console.log('SERVER:', client.jid.user, 'DISCONNECT')
        connection.query('UPDATE DeviceTable SET status = ? WHERE user_id = ?', ['OFFLINE', client.jid.user], function(err, res){
            if(err) throw err;
        });    
    })
});

var getClient = function (pcm_parse) {
   
    var clientLength = clients.length;
    console.log(clientLength);
    var client;
    var clientId;
    var to = pcm_parse.data.to;

    for(var i = 0; i < clientLength; i++){
        client = clients[i];
        console.log('here check:'+client.jid.user, client.jid.domain)
        console.log(to);
        clientId = client.jid.user+"@"+ client.jid.domain
        console.log(to.indexOf(clientId));
        if(to.indexOf(clientId) == 0){
           return client;
        }
    }
}


