var mysql = require('mysql');

//MySQL Connection
var pool = mysql.createPool({
	connectionLimit : 100, //important
	host:'localhost',
 	user:'root',
 	password:'Admin123#',
 	database:'hpccinfo'
});

module.exports = pool;