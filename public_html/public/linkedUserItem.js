var LinkedUserItem = function(userdata){
	this.username = userdata.username;
	this.sessionNumber = 0;
	this.socketNumber = 0;
	this.sessions = [];
	this.socketIDs = [];
	module.systemAdmin.linkedUserList[this.username] = this;
};

LinkedUserItem.prototype = {
	render: function(){
		var that = this;
		var linkedUserItemTmpl = module.template.linkedUserItemTmpl;
		that.$el = $(Mustache.to_html(linkedUserItemTmpl, that).replace(/^\s*/mg, ''));
		that.$el.find('.boot').click(function(){that.boot.apply(that)});
		$('#realtime-userlist').append(that.$el);
	},
	addSession: function(session){
		if(this.sessions.indexOf(session) == -1){
			this.sessions.push(session);
			this.sessionNumber++;
		}
	},
	addSocketID: function(socketID){
		if(this.socketIDs.indexOf(socketID) == -1){
			this.socketIDs.push(socketID);
			this.socketNumber++;
		}
	},
	boot: function(){
		var confirmed = confirm("Are you sure to boot this user?");
		var that = this;
		if(confirmed){
			data = {username: that.username};
			socket.emit("systemBootAction", JSON.stringify(data));
			that.$el.remove();
		}
	}
};