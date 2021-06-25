const { query } = require('express');
const express = require('express'),
  socket = require('socket.io'),
  mysql = require('mysql'),
  cookieParser = require('cookie-parser'),
  session = require('express-session');

var app = express();
var roomName = '';
const nameBot = "BotChat";
var server = app.listen(3030, function () {
  console.log("Servidor en marcha, port 3030.");
});

var io = socket(server);

var sessionMiddleware = session({
  secret: "keyUltraSecret",
  resave: true,
  saveUninitialized: true
});

io.use(function (socket, next) {
  sessionMiddleware(socket.request, socket.request.res, next);
});

app.use(sessionMiddleware);
app.use(cookieParser());

const config = {
  "host": "localhost",
  "user": "root",
  "password": "Telematica",
  "base": "chat"
};

var db = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : 'Telematica',
  database : 'chat'
});

db.connect(function (err) {
    if (!!err){
        return err;
    }
  console.log('MySQL conectado: ' + config.host + ", usuario: " + config.user + ", Base de datos: " + config.base);
});

app.use(express.static('./'));

io.on('connection', function (socket) {
  var req = socket.request;

  console.log(req.session);

	if(req.session.userID != null){
		db.query("SELECT * FROM users WHERE id=?", [req.session.userID], function(err, rows, fields){
			console.log('Sesión iniciada con el UserID: ' + req.session.userID + ' Y nombre de usuario: ' + req.session.Username);
			socket.emit("logged_in", {user: req.session.Username, email: req.session.correo});
		});
	}else{
		console.log('No hay sesión iniciada');
	}

	socket.on("login", function(data){
	  const user = data.user,
	  pass = data.pass,
	  roomID = data.roomID,
	  roomName = data.roomName;

	  db.query("SELECT * FROM users WHERE Username=?", [user], function(err, rows, fields){ //de esta forma se agragaran los usuarios a la base de datos
		  if(rows.length == 0){
		  	console.log("El usuario no existe, favor de registrarse!");
		  }else{
		  		console.log(rows);
		  		
		  		const dataUser = rows[0].Username,
			  	dataPass = rows[0].Password,
			  	dataCorreo = rows[0].email;

				if(dataPass == null || dataUser == null){// Condicionamos que si los espacios son null saltara un error
				  	socket.emit("error");
				}
				if(user == dataUser && pass == dataPass){ // y para loggearse se necesita que tanto el user como el pass coincidan
					console.log("Usuario correcto!");
					socket.emit("logged_in", {user: user, email: dataCorreo, room: roomName, roomID: roomID});
					req.session.userID = rows[0].id;
					req.session.Username = dataUser;
					req.session.correo = dataCorreo;
					req.session.roomID = roomID;
					req.session.roomName = roomName;
					req.session.save();
					socket.emit('historial');
					socket.join(req.session.roomName);
					bottxt('entroSala');
				}else{
				  	socket.emit("invalido");
				}
		  }
	  });
	});

	socket.on('historial', function(){
		console.log("Buscando historial de la sala: " + req.session.roomName)

		db.query('SELECT s.nombre_sala, u.Username, m.mensaje FROM mensajes m INNER JOIN salas s ON s.id = m.sala_id INNER JOIN users u ON u.id = m.user_id where m.sala_id = ' + req.session.rooomID + 'ORDER BY m.id ASC', function(err,rows,fields){
			socket.emit('armadoHistoial',rows);
		});
	});
	
	socket.on('addUser', function(data){
		const user = data.user,
		pass = data.pass,
		email = data.email;
		
		if(user != "" && pass != "" && email != ""){ //Declaramos que el usuario debe llenar los espacios para registrarse
			console.log("Registrando el usuario: " + user);
		  	db.query("INSERT INTO users(`Username`, `Password`, `email`) VALUES(?, ?, ?)", [user, pass, email], function(err, result){
			  if(!!err) 
			  return err;

			  console.log(result);

			  console.log('Usuario ' + user + " se dio de alta correctamente!.");
			  socket.emit('UsuarioOK');
			});
		}else{
			socket.emit('vacio');
		}
	});
	
	socket.on('cambiodesala', function(data){
		const idSala = data.idSala,
		nombreSala = data.nombreSala;

		socket.leave(req.session.roomName);

		req.session.roomID = idSala;
		req.session.roomName = nombreSala;

		socket.join(req.session.roomName);
		bottxt('cambioSala');
	})

	socket.on('mjsNuevo', function(data){ // Función para crear el mensaje nuevo.
		
		//const sala = 0; // definimos el id de la sala para posterior función.
		
			db.query("INSERT INTO mensajes(`mensaje`, `user_id`, `sala_id`, `fecha`) VALUES(?, ?, ?, CURDATE())", [data, req.session.userID, req.session.roomID], function(err, result){
			  if(!!err){
			    return err;
              }
			  console.log(result);

			  console.log('Mensaje dado de alta correctamente!.');
			  
			  		socket.broadcast.to(req.session.roomName).emit('mensaje', {
						usuario: req.session.Username,
						mensaje: data
					});
					
					socket.emit('mensaje', {
						usuario: req.session.Username,
						mensaje: data
					});
			});
		
	});

	socket.on('getSalas', function(data){
		db.query('SELECT id, nombre_sala FROM salas', function(err, result, fields){
			if(err) return err;
			socket.emit('Salas', result);
		});
	});
	
	socket.on('salir', function(request, response){
		bottxt('salioUsuario');
		socket.leave(req.session.roomName);
		req.session.destroy();
	});

	function bottxt(data){
		entroSala = 'Bienvenido a la sala' + req.session.roomName;
		cambioSala = 'Cambiaste de sala a ' + req.session.roomName;
		sefue = 'El usuario ' + req.session.Username + ' ha salido de la sala.'

		if(data == "entroSala"){
			socket.emit('mensaje',{
				usuario: nameBot,
				mensaje: entroSala
			});
		}

		if(data == "cambioSala"){
			socket.emit('mensaje',{
				usuario: nameBot,
				mensaje: cmabioSala
			});
		}

		if(data == "salioUsuario"){
			socket.emit('mensaje',{
				usuario: nameBot,
				mensaje: sefue
			});
		}
	}
});

