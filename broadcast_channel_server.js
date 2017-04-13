require( "console-stamp" )( console, {pattern : "yyyy-mm-dd HH:MM:ss.l", colors: {stamp: "green",label: "yellow"}} ); 
var http = require('http'); // Import Node.js core module
var crypto = require('crypto');
var request = require('request');
var Client = require('node-xmpp-client');
var xmpp = require('node-xmpp-server');
var qs = require('querystring');
var port = 8001;
var server = http.createServer(function (req, res) {  
	if(req.method == 'POST'){
        var body = '';
        req.on('data', function (data) {
          body += data;
        });
        req.on('end', function(){
            var post = qs.parse(body)
            var message = post['type'];
            console.log("Type : " +message)

            if(message === undefined){
                res.end('message not defined');
            }else if(message == 'ad_broadcast' ){
                var ad_content = post['ad_data'];
                console.log('AD Content : ' +ad_content);
                    try{
                    ad_broadcast(ad_content);
                    res.end('message received');
                    }catch(err){
                        console.log(err);
                        res.end('Incorrect Message Format.');
                    }                
            }else if(message == 'get_live_channel_data'){
                    var live_channel_data = get_live_channel(message, function(id){
                    res.end(id);                        
                    });
            }else if(message == 'get_user_channel_history'){
                    var user_history = [];
                    user_history['message'] = post['message'];
                    user_history['user_id'] = post['user_id'];
                    user_history['start_time'] = post['start_time'];
                    user_history['end_time'] = post['end_time'];

                    var user_channel_history = get_user_channel_history(user_history, function(id){
                    res.end(id);                        
                    });
            }else{


            }
        })
    }else{
        res.end('mehtod is not POST');
    }

});//web server initiated and listen to the incoming data

server.listen(port); //listen for any incoming requests at port 7000
console.log('Channel Broadcast Server starts at port : ' +port);

function get_user_channel_history(user_history, cb){
    var mysql      = require('mysql2');
    var connection = mysql.createConnection({
        host     : 'localhost',
        user     : 'root',
        password : '1projectK!',
        database : 'gcm',
    }); 

    connection.query('CREATE TABLE IF NOT EXISTS CurrentChannel (user_id VARCHAR(20) NOT NULL PRIMARY KEY, channel_id VARCHAR(50), updated_at TIMESTAMP )');    
    connection.query('CREATE TABLE IF NOT EXISTS ChannelHistory (id int PRIMARY KEY AUTO_INCREMENT NOT NULL, user_id VARCHAR(20), channel_id VARCHAR(50), updated_at TIMESTAMP)');
    connection.execute('select user_id, channel_id, updated_at from ChannelHistory WHERE user_id = ? and (updated_at between ? and ?)',[user_history['user_id'], user_history['start_time'], user_history['end_time']], function (err, rows){
        if(err) throw err;
        console.log(JSON.stringify(rows));
        cb(JSON.stringify(rows));
    });
};

function get_live_channel(message, cb){
    var mysql      = require('mysql2');
    var connection = mysql.createConnection({
      host     : 'localhost',
      user     : 'root',
      password : '1projectK!',
      database : 'gcm',
    }); 

    connection.query('CREATE TABLE IF NOT EXISTS CurrentChannel (user_id VARCHAR(20) NOT NULL PRIMARY KEY, channel_id VARCHAR(50), updated_at TIMESTAMP )');    
    connection.query('CREATE TABLE IF NOT EXISTS ChannelHistory (id int PRIMARY KEY AUTO_INCREMENT NOT NULL, user_id VARCHAR(20), channel_id VARCHAR(50), updated_at TIMESTAMP)');
    connection.execute('select user_id, channel_id, updated_at from CurrentChannel', function (err, rows){
        if(err) throw err;
        console.log('rows :'+JSON.stringify(rows));
        cb(JSON.stringify(rows));        
     });
};

function ad_broadcast(message, cb){
    var mysql      = require('mysql2');
        var connection = mysql.createConnection({
          host     : 'localhost',
          user     : 'root',
          password : '1projectK!',
          database : 'gcm',
        }); 

    var dev_id = '877';
    //hostname = 'xmpp.projectk.oodoo.co.in';
    //hostname = '192.168.0.100'; // demo
    hostname = '192.168.1.17';
    username = 'pjtku3';//received from server by dev_id
    to_hash = dev_id+username;
    password = crypto.createHash('md5').update(to_hash).digest("hex"); //encrypt of dev_id and username


    var client1 = new Client({
        jid: username+'@'+hostname,
        password: password,
        port:5245,
        host:hostname,
        preferredSaslMechanism: 'PLAIN'
    })
        


    client1.on('online', function () {
        var parse = JSON.parse(message);
        var channel_name = 'test channel';
        var channel_id = parse.channel_id;

        connection.query('CREATE TABLE IF NOT EXISTS AdTable (id int PRIMARY KEY AUTO_INCREMENT NOT NULL, ad_id VARCHAR(50), image VARCHAR(512), url VARCHAR(512), channel_id VARCHAR(256))');
            connection.prepare('INSERT INTO AdTable (ad_id, image, url, channel_id) values (?,?,?,?)', function(err, statement){
            statement.execute([parse.ad_id, parse.image, parse.url, parse.channel_id], function(err, rows, columns){
                    if(err) throw err;
                    console.log('AD INSERTED :'+parse.ad_id);
            });
            statement.close();
        });  

        connection.query('CREATE TABLE IF NOT EXISTS UserAdTable (id int PRIMARY KEY AUTO_INCREMENT NOT NULL, ad_id VARCHAR(50), user_ad_id VARCHAR(50),user_id VARCHAR(30), message_id VARCHAR(50), status VARCHAR(50))');
        var data_json = '{"AdDetails": { "Image": "'+parse.image+'", "Url": "'+parse.url+'", "Name": "'+parse.name+'", "UserAdID": "TEST123", "AdID": "'+parse.ad_id+'", "Channel": "'+channel_name+'", "Time": "15000" }}';
        var ad_data = JSON.stringify(data_json);
        connection.execute('SELECT user_id from DeviceTable', function(err, rows){
            if(rows.length > 0){
                for(var j=0; j < rows.length; j++){
                    if(rows[j].user_id != dev_id){
                        var user_ad_id = crypto.randomBytes(20).toString('hex');
                        var message_id = crypto.randomBytes(30).toString('hex');      
                        var data_json = '{"AdDetails": { "Image": "'+parse.image+'", "Url": "'+parse.url+'", "Name": "'+parse.name+'", "UserAdID": "'+user_ad_id+'", "AdID": "'+parse.ad_id+'", "Channel": "'+channel_name+'", "Time": "15000" }}';
                        var ad_data = JSON.stringify(data_json);
                        var message = new xmpp.Stanza('message').c('pcm', xmlns="projectk:mobile:data").t('{"data": {"to":"'+rows[j].user_id+'","from":"pjtku3","action":"ad_display", "ad_data":'+ad_data+'}, "message_id":"'+message_id+'","message_type" : "data"}').up();
                        client1.send(message);
                        connection.query('INSERT INTO UserAdTable SET ?', {ad_id : parse.ad_id , user_ad_id : user_ad_id, user_id : rows[j].user_id, message_id : message_id, status : 'SERVER RECEIVED'}, function(err, res){
                            if(err) throw err;
                        });
                    }
                }
            }
        });

    })
    client1.on('stanza', function (stanza) {
        console.log('STANZA AD: ' +stanza.toString());
    })
    client1.on('error', function (error) {
        console.log('client1', error)
    })

}

