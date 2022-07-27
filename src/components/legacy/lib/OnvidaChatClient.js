window.Onvida.Lib.OnvidaChatClient = (function() {
	let ctx = null,
	  typingTimer = null,
	  isTyping = false,
	  typingWait = 3000,
	  lastTyper = null,
	  joinAttempts = 0,
	  joinTimer = null,
	  debugMode = false,
	  chatHub = new Onvida.Lib.OnvidaChatHub(),
	  enums = Onvida.Lib.ChatClientEnums,
	  chatClient = new Onvida.Lib.ChatClient("Onvida"),
	  self = chatClient;

	chatClient.join = function(chatID, identity, token, resumed) {
		self.debug("join");
		return new Promise(function (resolve, reject) {
			chatHub
				.joinChat(chatID, identity)
				.then(() => {
					ctx = {
				  		chatID: chatID,
				  		identity: identity,
					};
					initEventHandlers();
					resolve();
				})
				.catch((error) => {
					self.debug("chatHub.join - error: " + error, true);
					reject(error);
				});
		});
	};

	chatClient.leave = function() {
		self.debug("leave");
		return new Promise(function(resolve, reject) {
			if (self.ready()) {
				chatHub
					.leaveChat(ctx.chatID, ctx.identity)
					.then(() => {
						resolve();
					})
					.catch((error) => {
						self.debug("chatHub.leave - error: " + error, true);
						reject(error);
					});
			} else {
				self.debug("chatHub.leave - not ready");
				resolve();
			}
		});
	};

	chatClient.getUser = function(identity) {
		self.debug("getUser");
		return new Promise(function(resolve, reject) {
			if (self.ready()) {
				chatHub
				  .getChatUser(ctx.chatID, identity)
				  .then((user) => {
				  	resolve(user);
				  })
				  .catch((error) => {
				  	self.debug("chatHub.getUser - error: " + error, true);
				  	reject(error);
				  });
			} else {
				self.debug("chatHub.getUser - not ready");
				reject();
			}
		});
	};

	chatClient.getMessages = function() {
		self.debug("getMessages");
		return new Promise(function(resolve, reject) {
			if (self.ready()) {
				Onvida.sendRequest(
				  "Chat/GetThreadMessages",
				  {
				  	chatID: ctx.chatID,
				  },
				  function(response) {
				  	var messages = new Array();
				  	for (var i = 0; i < response.length; i++) {
				  		var m = response[i];
				  		var msg = {
				  			FriendlyName: m.UserFriendlyName,
				  			Identity: m.VendorAuthorID,
				  			Type: m.ThreadMessageType.Name,
				  			Text: m.Message,
				  			TimeStamp: Onvida.Utils.convertServerDate(m.Created),
				  		};
				  		messages.push(msg);
				  	}
				  	resolve(messages);
				  },
				  function(error, message) {
				  	self.debug("chatService.getMessages - error: " + message, true);
				  	reject(message);
				  }
				);
			} else {
				self.debug("chatService.getMessages - not ready");
				reject();
			}
		});
	};

	chatClient.sendMessage = function(type, text) {
		self.debug("sendMessage(" + type + ", " + text + ")");
		return new Promise(function(resolve, reject) {
			if (self.ready()) {
				chatHub
				  .sendChatMessage(ctx.chatID, ctx.identity, type, text)
				  .then(() => {
				  	resolve();
				  })
				  .catch((error) => {
				  	self.debug("chatHub.sendMessage - error: " + error, true);
				  	reject(error);
				  });
			} else {
				self.debug("chatHub.sendMessage - not ready");
				reject();
			}
		});
	};

	chatClient.typing = function() {
		stopTyping();
		return new Promise(function(resolve, reject) {
			if (!isTyping) {
				isTyping = true;
				self
				  .sendMessage("TypingStart")
				  .then(() => {
				  	resolve();
				  })
				  .catch((error) => {
				  	isTyping = false;
				  	reject(error);
				  });
			} else {
				resolve();
			}
		});
	};

	chatClient.dispose = function () {
		self.debug("dispose");
		return new Promise(function (resolve, reject) {
			function cleanup() {
				self.reset();
				ctx = null;
				self.removeAllEventListeners();
				if (chatHub != null) {
					chatHub.dispose();
				}
				chatHub = null;
				resolve();
			}
			if (self.ready()) {
				self.leave().then(() => {
					cleanup();
				}).catch(error => {
					cleanup();
				});
			} else {
				cleanup();
			}
		});
	};

	chatClient.ready = function() {
		return ctx != null;
	};

	chatClient.connected = function() {
		return (
		  (ctx == null
			? enums.States.DISCONNECTED
			: self.connectionState()) == enums.States.CONNECTED
		);
	};

	chatClient.reset = function() {
		window.clearTimeout(typingTimer);
		isTyping = false;
		lastTyper = null;
	};

	var stopTyping = function() {
		window.clearTimeout(typingTimer);
		typingTimer = window.setTimeout(function() {
			chatClient.sendMessage("TypingEnd");
			isTyping = false;
		}, typingWait);
	};

	var initEventHandlers = function () {
		if (chatHub && !chatHub.eventListening()) {
			chatHub.eventListening(true);
			chatHub.addEventListener(
			  enums.Events.MESSAGE_RECEIVED,
			  eChatHubMessageReceivedHandler
			);
		}
	};

	var eChatHubMessageReceivedHandler = function(e) {
		var message = e.detail;
		switch (message.Type) {
			case "Join":
				chatClient.dispatchEvent(enums.Events.USER_JOINED, message);
				break;
			case "Leave":
				chatClient.dispatchEvent(enums.Events.USER_LEFT, message);
				break;
			case "UserUpdate":
				chatClient.dispatchEvent(enums.Events.USER_UPDATED, message);
				break;
			case "TypingStart":
				lastTyper = message.Identity;
				chatClient.dispatchEvent(
				  enums.Events.TYPING_STARTED,
				  message
				);
				break;
			case "TypingEnd":
				chatClient.dispatchEvent(enums.Events.TYPING_ENDED, message);
				break;
			case "End":
				if (message.Text != null)
					chatClient.dispatchEvent(enums.Events.MESSAGE_ADDED, message);
				if (ctx != null && ctx.chatID == message.ChatID)
					chatClient.dispatchEvent(enums.Events.ROOM_CLOSED);
				break;
			case "ConnectionStateChange":
				chatClient.dispatchEvent(
				  enums.Events.CONNECTIONSTATE_CHANGED,
				  message
				);
				break;
			case "Text":
			default:
				if (message.Identity == lastTyper)
					chatClient.dispatchEvent(enums.Events.TYPING_ENDED, message);
				chatClient.dispatchEvent(enums.Events.MESSAGE_ADDED, message);
				break;
		}
	};

	return chatClient;
});
