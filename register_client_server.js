require( "console-stamp" )( console, {pattern : "yyyy-mm-dd HH:MM:ss.l", colors: {stamp: "green",label: "yellow"}} );

var http = require('http'); // Import Node.js core module
var qs = require('querystring');

var util = require('util');


var port = 8081;
var server = http.createServer(function (req, res) {  
	if(req.method == 'POST'){
		var body = ''; 
        req.on('data', function (data) {
            body += data; 
        });            
        req.on('end', function () {
            var post = qs.parse(body);
            var device_id = post['dev_id'];
            console.log('Device ID :'+device_id);
			if(device_id != undefined ){

				var mysql      = require('mysql2');
					var connection = mysql.createConnection({
					  host     : 'localhost',
					  user     : 'root',
					  password : '1projectK!',
					  database : 'gcm',
					});	
				result = ''


				connection.query('CREATE TABLE IF NOT EXISTS DeviceTable (id int PRIMARY KEY AUTO_INCREMENT NOT NULL, device_id VARCHAR(50), user_id VARCHAR(15), status VARCHAR(15), created_at timestamp, updated_at timestamp)');
				try{
					connection.prepare('SELECT * from DeviceTable where device_id = ?',function(err, statement){
						statement.execute([device_id], function(err, rows, columns) {
						if(rows.length == 0){
							connection.query('select * from DeviceTable order by id desc limit 1', function(err, rows){
								if(rows.length > 0 ){
									var user_id = 'PJTKU'+((rows[0].id)+1);
								}else{
									var user_id = 'PJTKU1';
							}
								
								connection.prepare('INSERT INTO DeviceTable (device_id, user_id) values (?,?)', function(err, statement){
									statement.execute([device_id, user_id], function(err, rows){
									res.setHeader('Content-Type', 'application/json');
									res.writeHead(200, {'Content-Type': 'text/plain'});
									console.log('New: '+user_id);
									res.end('{"Users" :{"DevId": "'+device_id+'","UserId" : "'+user_id+'","Status" : "success","Message" :"Registered Successfully"}}');

									});


								});
							});
							}else{

									res.writeHead(200, {'Content-Type': 'text/plain'});
									console.log('Exist: '+rows[0].user_id);
									res.end('{"Users" : {"DevId": "'+rows[0].device_id+'","UserId" : "'+rows[0].user_id+'","Status" : "success","Message" :"Registered Successfully"}}');

							}

						});

					statement.close();
					});
				}catch(err){
					console.log(err);
				}
			}else{
				res.end('Device Id is not an integer or undefined');
			}
        });
	}else{
		res.end('Method is not POST');
	}
});

function isInt(value) {
  return !isNaN(value) && 
         parseInt(Number(value)) == value && 
         !isNaN(parseInt(value, 10));
}



server.listen(port);
console.info('Node.js web server at '+port+'  is running..');
