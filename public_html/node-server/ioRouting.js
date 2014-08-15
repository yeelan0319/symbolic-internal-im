var validator = require('../public/validator');
var responseJson = require('./responseJson');

var _parseData = function(data){
    try{
        data = JSON.parse(data);
    }
    catch(e){
        console.log("Receive invalid JSON");
    }
    return data;
}

module.exports = function(app){
	app.socketExtension = require('./socketExtension');
	app.ioController = require('./ioController')(app);
    app.roomController = require('./roomController')(app);

	//socket io middlewares
    app.io.use(function(socket, next){
        //TODOS: Should generate socket based session key if the initial request is not via browser
        // var seed = crypto.randomBytes(20);
        // socket.token = socket.request.signedCookies['PHPSESSID'] || crypto.createHash('sha1').update(seed).digest('hex');
        app.middleware.cookieParserFunction(socket.request, {}, function(){
            socket.token = socket.request.signedCookies['PHPSESSID'];
            socket.join('/private/session/' + socket.token);
            next();
        });
    });
    app.io.use(function(socket, next){
        socket.request.originalUrl = "/";
        app.middleware.sessionParserFunction(socket.request, {}, next);
    });
    app.io.use(app.socketExtension);

    //event listening
    app.io.on('connection', function(socket){
        var session = socket.request.session;
        var socketID = socket.id;

        app.ioController.checkLoginStatus(session, socketID);

        //register listeners needed
        socket.on('loginRender', function(){
            socket.isLoggedIn() ? socket.renderLounge() : socket.renderLogin();
        });
        socket.on('registerRender', function(){
            socket.isLoggedIn() ? socket.renderLounge() : socket.renderRegister();
        });
        socket.on('joinRoomAction', function(data){
            data = _parseData(data);
            if(socket.isLoggedIn()){
                var from = data.from;
                var to = data.to;

                if((to===0||app.roomController._getRoom(to))&&(from===0||app.roomController._getRoom(from))){
                    app.roomController.joinRoom(to, socket);
                    app.roomController.leaveRoom(from, socket);
                }
                else{
                   socket.emit('system warning', responseJson.badData()); 
                }
            }
            else{
                //user not logged in
            }
        });
        socket.on('leaveRoomAction', function(data){
            data = _parseData(data);
            if(socket.isLoggedIn()){
                var id = data.id;
                if(id===0 || app.roomController._getRoom(id)){
                    app.roomController.leaveRoom(id, socket);
                }
                else{
                   socket.emit('system warning', responseJson.badData()); 
                }
            }
            else{
                //user not logged in
            }
        });
        socket.on('retrieveUserProfileAction', function(){
            if(socket.isLoggedIn()){
                app.ioController.retrieveUserProfile(socketID);
            }
            else{
                //user not logged in
            }
        });
        socket.on('searchPmAction', function(str){
            if(socket.isLoggedIn()){
                app.ioController.searchPm(str, socketID);
            }
            else{
                //user not logged in
            }
        });
        socket.on('createPmAction', function(data){
            data = _parseData(data);
            if(socket.isLoggedIn()){
                var username = data.username;
                if(!validator.nickName(username)){
                    socket.emit('system warning', responseJson.badData());
                }
                else{
                    app.ioController.createPm(username, socketID);
                }
            }
            else{
                //user not logged in
            }
        });
        socket.on('adminRender', function(id){
            if(id===0){
                if(socket.isAdmin()){
                    socket.renderSystemAdmin();
                }
                else{
                    //user donnot have the provilage for this operation
                }
            }
            else{
                if(app.roomController._getRoom(id)){
                    if(socket.isAdmin() || app.roomController.isAdminOfRoom(id, socket.username)){
                        app.roomController.renderRoomAdmin(id, socketID);
                    }
                    else{
                        //user donnot have the privilage for this operation
                    }
                }
                else{
                    socket.emit('system warning', responseJson.badData());
                }
            }
        });
        socket.on('retrieveLinkedUserAction', function(){
            if(socket.isAdmin()){
                app.ioController.retrieveLinkedUser(socketID);
            }
            else{
                //user donnot have the privilage
            }
        });
        socket.on('retrieveUserDataAction', function(){
            if(socket.isAdmin()){
                app.ioController.retrieveUserList(socketID);
            }
            else{
                //user donnot have the privilage
            }
        });
        socket.on('retrieveChatLogAction', function(constraints){
            constraints = _parseData(constraints);
            if(socket.isAdmin()){
                app.ioController.retrieveChatLog(constraints, socketID);
            }
            else{
                //user donnot have the privilage
            }
        });
        socket.on('logoutAction', function(){
            if(socket.isLoggedIn()){
                app.ioController.logoutUser(session);
            }
            else{
                //user is not logged
            }
        });
        socket.on('editPermissionAction', function(data){
            data = _parseData(data);
            if(socket.isAdmin()){
                var username = data.username;
                var permission = data.permission;
                if(!validator.nickName(username)||!validator.permission(permission)||socket.username === username){
                    socket.emit('system warning', responseJson.badData());
                }
                else{
                    app.ioController.editUserPermission(username, permission);
                }
            }
            else{
                //user donnot have the privilage
            }
        });
        socket.on('deleteUserAction', function(data){
            data = _parseData(data);
            if(socket.isAdmin()){
                var username = data.username;
                if(!validator.nickName(username) || socket.username===username){
                    socket.emit('system warning', responseJson.badData());
                }
                else{
                    app.ioController.deleteUser(username);
                }
            }
            else{
                //user donnot have the privilage
            }
        });
        socket.on('systemBootAction', function(data){
            data = _parseData(data);
            if(socket.isAdmin()){
                var username = data.username;
                if(!validator.nickName(username) || socket.username===username){
                    socket.emit('system warning', responseJson.badData());
                }
                else{
                    app.ioController.bootUser(username);
                }
            }
            else{
                //user donnot have the privilage
            }
        });
        socket.on('sendPmAction', function(data){
            data = _parseData(data);
            if(socket.isLoggedIn()){
                var toUsername = data.toUsername;
                var msg = data.msg;
                if(!validator.nickName(toUsername)){
                    socket.emit('system warning', responseJson.badData());
                }
                else{
                    app.ioController.sendPm(toUsername, msg, socketID);
                }    
            }
            else{
                //user not logged in
            }
        });
        socket.on('readPmAction', function(data){
            data = _parseData(data);
            if(socket.isLoggedIn()){
                var fromUsername = data.fromUsername;
                var toUsername = socket.username;
                if(!validator.nickName(fromUsername) || !validator.nickName(toUsername)){
                    socket.emit('system warning', responseJson.badData());
                }
                else{
                    app.ioController.readPm(fromUsername, toUsername);
                }
            }
            else{
                //user not logged in
            }
        });
        socket.on('editUserAction', function(data){
            data = _parseData(data);
            if(socket.isLoggedIn()){
                var username = socket.username;
                
                var firstNameFlag = typeof data.firstName === 'undefined'? true : validator.personName(data.firstName);
                var lastNameFlag = typeof data.lastName === 'undefined'? true : validator.personName(data.lastName);
                var phoneNumberFlag = typeof data.phoneNumber === 'undefined'? true : validator.phoneNumber(data.phoneNumber);
                var birthdayFlag = typeof data.birthday === 'undefined'? true : validator.date(data.birthday);
                var jobDescriptionFlag = typeof data.jobDescription === 'undefined'? true : validator.textMaxLength(data.jobDescription);
                if(!firstNameFlag||!lastNameFlag||!phoneNumberFlag||!birthdayFlag||!jobDescriptionFlag){
                    socket.emit('system warning', responseJson.badData());
                }
                else{
                    app.ioController.editUserInfo(username, data);
                }
            }
            else{
                //user not logged in
            }
        });
        socket.on('editRoomAdminAction', function(data){
            data = _parseData(data);
            var id = data.id;
            if(app.roomController._getRoom(id)){
                if(socket.isAdmin()|| app.roomController.isAdminOfRoom(id, socket.username)){
                    var username = data.username;
                    var permission = data.permission;
                    if(!validator.nickName(username) || !validator.permission(permission) || socket.username===username){
                        socket.emit('system warning', responseJson.badData());
                    }
                    else{
                        app.roomController.editRoomAdmin(id, username, permission);
                    }
                }
                else{
                    //user donnot have the privilage
                }
            }
            else{
                socket.emit('system warning', responseJson.badData());
            }
        });
        socket.on('roomBootAction', function(data){
            data = _parseData(data);
            var id = data.id;
            if(app.roomController._getRoom(id)){
                if(socket.isAdmin()|| app.roomController.isAdminOfRoom(id, socket.username)){
                    var username = data.username;
                    if(!validator.nickName(username) || socket.username===username){
                        socket.emit('system warning', responseJson.badData());
                    }
                    else{
                        app.roomController.bootUser(id, username);
                    }
                }
            }
            else{
               socket.emit('system warning', responseJson.badData()); 
            }
        });
        socket.on('chatAction', function(data){
            data = _parseData(data);
            var id = data.id;
            if(id===0||app.roomController._getRoom(id)){
                if(socket.isLoggedIn() && socket.isInRoom(id)){
                    var msg = data.msg;
                    app.ioController.sendChatMessage(socket.username, id, msg);
                }
                else{
                    //user not logged in
                }
            }
            else{
                socket.emit('system warning', responseJson.badData());
            }   
        });
        socket.on('createRoomAction', function(data){
            data = _parseData(data);
            if(socket.isLoggedIn()){
                var name = data.name;
                if(!validator.looseNickName(name)){
                    socket.emit('system warning', responseJson.badData());
                }
                else{
                    app.roomController.createRoom(name, socket.username);
                }
            }
            else{
                //user not logged in
            }
        });
        socket.on('destoryRoomAction', function(data){
            data = _parseData(data);
            var id = data.id;
            if(app.roomController._getRoom(id)){
                if(socket.isAdmin()|| app.roomController.isAdminOfRoom(id, socket.username)){
                    app.roomController.destoryRoom(id);
                }
                else{
                    //user donnot have the privilage
                }
            }
            else{
                socket.emit('system warning', responseJson.badData());
            }
        });
        socket.on('disconnect', function(){
            if(socket.isLoggedIn()){
                app.roomController.passiveLeaveRoom(socket);
            }
            else{
                //user not logged in
            }
        });
    });
}