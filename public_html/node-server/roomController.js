var util = require('util');
var events = require('events');
var responseJson = require('./responseJson');
var ObjectID = require('mongodb').ObjectID;
var MINUTE = 1000*60;

function RoomController(app){
    events.EventEmitter.call(this);

    this._getRoom = function(id){
        try{
            var room = app.roomList[id];
            if(!room){
                throw "roomNotDefined";
            }
            else{
                return room;
            }
        }
        catch(e){
            console.log("trying to access room that is not defined");
        }
    }

    function _setRoom(id, room){
        app.roomList[id] = room;
    }

    app.db.collection('rooms').find({'destoryTime': 0}).toArray(function(err, documents){
        if(err){
            //redo the work
        }
        else{
            for(var i in documents){
                var room = documents[i];
                _setRoom(room._id, room)
            }
        }
    });

    this.isAdminOfRoom = function(id, username){
        var room = this._getRoom(id);
        if(room){
            return room.adminOfRoom.indexOf(username) != -1 ? true : false;
        }
    };

    this.joinRoom = function(to, socketID){
        var socket = app.io.socketList[socketID];
        var that = this;

        _retrievePastMessage(to, function(messages){
            _informJoinOfRoom(to, socketID);
            var linkedusers = {
                type: 'reset',
                users: _getRoomLinkedSockets(to)
            };
            if(to === 0){    
                socket.joinLounge(messages, linkedusers);
            }
            else{
                var targetRoom = that._getRoom(to);
                if(targetRoom){
                    var name = targetRoom.name;
                    var isAdminOfRoom = socket.isAdmin()||that.isAdminOfRoom(to, socket.username);
                    socket.joinRoom(to, name, isAdminOfRoom, messages, linkedusers);
                }
            }
        });
    };

    function _retrievePastMessage(id, callback){
        var that = this;
        var duration = 10 * MINUTE;
        app.db.collection('messages').find({room: id, ctime:{$gt: Date.now() - duration}}).toArray(function(err, messages){
            if(err){
                //this is socket-level info
                //throw new DatabaseError();
                //redo the work
            }
            else{
                callback(messages);
            }
        });
    };

    function _informJoinOfRoom(id, socketID){
        var socketJoined = app.io.socketList[socketID];
        var data = {
            type: 'add',
            users:[
                {
                    username: socketJoined.username,
                    avatar: socketJoined.avatar
                }
            ]
        }
        var chatRoom = app.io.sockets.adapter.rooms['/chatRoom/' + id];
        for(var targetSocketID in chatRoom){
            if(chatRoom.hasOwnProperty(targetSocketID)&&targetSocketID !== socketID){
                var targetSocket = app.io.socketList[targetSocketID];
                targetSocket.emit('room linked users data', responseJson.success(data));
            }
        }
    }

    function _getRoomLinkedSockets(id){
        var sockets = [];
        var chatRoom = app.io.sockets.adapter.rooms['/chatRoom/' + id];
        for(var socketID in chatRoom){
            if(chatRoom.hasOwnProperty(socketID)){
                var targetSocket = app.io.socketList[socketID];
                var simpleSocket = {
                    id: targetSocket.id,
                    username: targetSocket.username,
                    permission: targetSocket.permission,
                    avatar: targetSocket.avatar
                };
                sockets.push(simpleSocket);
            }
        }
        return sockets;
    }

    this.retrieveLinkedUser = function(id, socketID){
        var socket = app.io.socketList[socketID];
        var room = this._getRoom(id);
        if(room){
            var data = {
                sockets: _getRoomLinkedSockets(id),
                admins: room.adminOfRoom
            };
            socket.emit('room related users data', responseJson.success(data));
        }
    };

    this.editRoomAdmin = function(id, username, permission){
        var room = this._getRoom(id);
        if(permission === 0){
            var index = room.adminOfRoom.indexOf(username);
            if(index != -1){
                room.adminOfRoom.splice(index, 1);
            }
        }
        else if(permission === 1){
            room.adminOfRoom.push(username);
        }
        //async update database
        app.db.collection('rooms').update({_id:room._id}, room, function(err, result){
            if(err){
                //this is socket-level info
                //throw new DatabaseError();
                //redo the work
            }
        });
    };

    this.bootUser = function(id, username){
        var chatRoom = app.io.sockets.adapter.rooms['/chatRoom/' + id];
        for(var socketID in chatRoom){
            if(chatRoom.hasOwnProperty(socketID)){
                var targetSocket = app.io.socketList[socketID];
                if(targetSocket.username === username){
                    targetSocket.leaveRoom(id);
                    this.joinRoom(0, socketID);
                }
            }
        }
    };

    this.createRoom = function(name, username){
        var that = this;
        var hasActiveRoomWithSameName = false;
        for(var id in app.roomList){
            if(app.roomList.hasOwnProperty(id)){
                if(this._getRoom(id).name === name){
                    hasActiveRoomWithSameName = true;
                }
            }
        }
        if(!hasActiveRoomWithSameName){
            var adminOfRoom = [username];
            var room = {'name': name, 'owner': username, 'createTime': Date.now(), 'destoryTime': 0, 'adminOfRoom': adminOfRoom};
            app.db.collection('rooms').insert(room, {w:1}, function(err, result) {
                if(err){
                    //this is socket-level info
                    //that.emit('excepetion', new ExistingUserError());
                    //redo the work
                }
                else{
                    _setRoom(room._id, room);
                    that.emit('successfullyCreatedRoom', room);
                }
            });
        }
    };

    this.destoryRoom = function(id){
        var that = this;
        app.db.collection('rooms').findAndModify({_id: new ObjectID(id)}, [['_id','asc']], {$set:{destoryTime: Date.now()}}, {}, function(err, room){
            if(err){
                //this is socket-level info
                //throw new DatabaseError();
                //redo the work
            }
            else{
                delete app.roomList[id];
                that.emit('successfullyDeletedRoom', room);
            }
        });
    }

    function _addToRoomList(room){
        var result = {
            type: 'add',
            data: {'1': room}
        }
        app.io.sockets.emit('room data', responseJson.success(result));
    }

    function _deleteFromRoomListAndClearRoom(room){
        var result = {
            type: 'delete',
            data: {'1': room}
        }
        app.io.sockets.emit('room data', responseJson.success(result));

        var chatRoom = app.io.sockets.adapter.rooms['/chatRoom/' + room._id];
        for(var socketID in chatRoom){
            if(chatRoom.hasOwnProperty(socketID)){
                var targetSocket = app.io.socketList[socketID];
                targetSocket.leaveRoom(room._id);
                targetSocket.joinLounge();
            }
        }
    }

    this.on('successfullyCreatedRoom', _addToRoomList);
    this.on('successfullyDeletedRoom', _deleteFromRoomListAndClearRoom);
};

util.inherits(RoomController, events.EventEmitter);
module.exports = function(app){
    return new RoomController(app);
};