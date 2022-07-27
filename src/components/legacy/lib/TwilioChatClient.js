window.Onvida.Lib.TwilioChatClient = (function () {
	let client = null,
	  channel = null,
	  joinAttempts = 0,
	  joinTimer = null,
	  debugMode = false,
      enums = Onvida.Lib.ChatClientEnums,
	  chatClient = new Onvida.Lib.ChatClient("Twilio"),
	  self = chatClient;

	chatClient.join = function (chatID, identity, token, resumed) {
		self.debug("join");
		return new Promise(function (resolve, reject) {
			function finishJoin() {
				getChannel(chatID, resumed)
				  .then(function (ch) {
				  	channel = ch;
				  	if (channel.status != "joined") {
				  		channel
						  .join()
						  .then(function () {
						  	resolve();
						  })
						  .catch(function (error) {
						  	reject(error);
						  });
				  	} else {
				  		resolve();
				  	}
				  })
				  .catch(function (error) {
				  	reject(error);
				  });
			}

			if (client == null) {
				Twilio.Chat.Client.create(token, {
					logLevel: debugMode ? "info" : "error"
				})
				  .then(function (cl) {
				  	client = cl;
				  	initEventHandlers();
				  	finishJoin();
				  })
				  .catch(function (error) {
				  	reject(error);
				  });
			} else {
				finishJoin();
			}
		});
	};

	chatClient.reconnect = function (chatID) {
		self.debug("reconnect");
		return new Promise(function (resolve, reject) {
			if (client != null) {
				getChannel(chatID)
				  .then(function (ch) {
				  	channel = ch;
				  	if (channel.status == "known" || channel.status == "joined") {
				  		resolve();
				  	} else {
				  		channel
						  .join()
						  .then(function () {
						  	resolve();
						  })
						  .catch(function (error) {
						  	reject(error);
						  });
				  	}
				  })
				  .catch(function (error) {
				  	reject(error);
				  });
			} else {
				reject();
			}
		});
	};

	chatClient.leave = function () {
		self.debug("leave");
		return new Promise(function (resolve, reject) {
			if (self.ready()) {
				if (channel.status == "joined") {
					channel
					  .leave()
					  .then(function () {
					  	channel = null;
					  	resolve();
					  })
					  .catch(function (error) {
					  	channel = null;
					  	reject(error);
					  });
				} else {
					channel = null;
					resolve();
				}
			} else {
				reject((client == null ? "Client" : "Channel") + " not ready");
			}
		});
	};

	chatClient.getUser = function (identity) {
		self.debug("getUser");
		return new Promise(function (resolve, reject) {
			if (self.ready()) {
				client
				  .getUser(identity)
				  .then(function (u) {
				  	resolve(toUser(u));
				  })
				  .catch(function (error) {
				  	reject(error);
				  });
			} else {
				reject();
			}
		});
	};

	chatClient.getMessages = function () {
		self.debug("getMessages");
		return new Promise(function (resolve, reject) {
			if (self.ready()) {
				getMessagePage()
				  .then(messages => {
				  	var converted = new Array();
				  	for (var i = 0; i < messages.length; i++) {
				  		converted.push(toMessage(messages[i]));
				  	}
				  	resolve(converted);
				  })
				  .catch(error => {
				  	reject(error);
				  });
			} else {
				reject();
			}
		});
	};

	chatClient.sendMessage = function (type, text) {
		self.debug("sendMessage");
		return new Promise(function (resolve, reject) {
			if (self.ready()) {
				var message = JSON.stringify({ type: type, text: text });
				channel
				  .sendMessage(message)
				  .then(function (index) {
				  	resolve(index);
				  })
				  .catch(function (error) {
				  	reject(error);
				  });
			} else {
				reject();
			}
		});
	};

	chatClient.typing = function () {
		return new Promise(function (resolve, reject) {
			if (self.ready()) {
				channel
				  .typing()
				  .then(function () {
				  	resolve();
				  })
				  .catch(function (error) {
				  	reject(error);
				  });
			} else {
				reject();
			}
		});
	};

	chatClient.dispose = function () {
		self.debug("dispose");
		return new Promise(function (resolve, reject) {
			function cleanup() {
				client = null;
				self.removeAllEventListeners();
				resolve();
			}
			if (self.ready()) {
				self.leave().then(() => {
					client
					  .shutdown()
					  .then(() => {
					  	cleanup();
					  })
					  .catch(error => {
					  	cleanup();
					  });
				});
			} else {
				cleanup();
			}
		});
	};

	chatClient.ready = function () {
		return client != null && channel != null;
	};

	chatClient.connected = function () {
		return (
		  (client == null
			? enums.States.DISCONNECTED
			: client.connectionState) == enums.States.CONNECTED
		);
	};

	chatClient.reset = function () {
		joinAttempts = 0;
		window.clearTimeout(joinTimer);
	};

	chatClient.updateToken = function (token) {
		if (client != null) client.updateToken(token);
	};

	var getChannel = function (chatID, resumed) {
		return new Promise(function (resolve, reject) {
			function getChannelAttempt() {
				self.debug(
				  "getChannel(" + chatID + ") - Attempt #" + (joinAttempts + 1)
				);
				client.getChannelByUniqueName(chatID).then(
				  function (ch) {
				  	chatClient.debug(
					  "getChannel(" +
					  chatID +
					  ") - Success - Member Status: " +
					  ch.status
					);
				  	resetChannelAttempt();
				  	resolve(ch);
				  },
				  function (error) {
				  	chatClient.debug(
					  "getChannel(" +
					  chatID +
					  ") - Error (" +
					  error.code +
					  "): " +
					  error.message +
					  " - Attempt #" +
					  (joinAttempts + 1) +
					  ", Resumed: " +
					  resumed +
					  ", ConnectionState: " +
					  client.connectionState
					);
				  	if (!resumed && error.message == "Forbidden" && joinAttempts < 3) {
				  		joinAttempts++;
				  		joinTimer = window.setTimeout(function () {
				  			getChannelAttempt();
				  		}, 1000);
				  		if (joinAttempts == 1)
				  			client.on("channelJoined", eChannelJoinedHandler);
				  	} else {
				  		chatClient.debug("getChannel(" + chatID + ") - Failure");
				  		resetChannelAttempt();
				  		reject(error);
				  	}
				  }
				);
			}

			function resetChannelAttempt() {
				joinAttempts = 0;
				window.clearTimeout(joinTimer);
				if (client != null)
					client.removeListener("channelJoined", eChannelJoinedHandler);
			}

			function eChannelJoinedHandler(channel) {
				chatClient.debug(
				  "eChannelJoinedHandler(Correct Channel: " +
				  (channel.uniqueName == chatID) +
				  ")"
				);
				if (channel.uniqueName == chatID && joinAttempts > 0) {
					window.clearTimeout(joinTimer);
					client.removeListener("channelJoined", eChannelJoinedHandler);
					getChannelAttempt();
				}
			}

			resetChannelAttempt();
			getChannelAttempt();
		});
	};

	var getMessagePage = function (page, messages) {
		chatClient.debug(
		  "getMessagePage(" + (Array.isArray(messages) ? messages.length : 0) + ")"
		);
		return new Promise(function (resolve, reject) {
			if (typeof page == "undefined") {
				messages = new Array();
				channel
				  .getMessages(10, 0, "forward")
				  .then(function (newPage) {
				  	resolve(getMessagePage(newPage, messages));
				  })
				  .catch(function (error) {
				  	reject(error);
				  });
			} else {
				page.items.forEach(function (message) {
					messages.push(message);
				});
				if (page.hasNextPage) {
					page
					  .nextPage()
					  .then(function (newPage) {
					  	resolve(getMessagePage(newPage, messages));
					  })
					  .catch(function (error) {
					  	reject(error);
					  });
				} else {
					resolve(messages);
				}
			}
		});
	};

	var initEventHandlers = function () {
		chatClient.debug("initEventHandlers");
		client.on("connectionStateChanged", function (connectionState) {
			chatClient.dispatchEvent(
			  enums.Events.CONNECTIONSTATE_CHANGED,
			  connectionState
			);
		});

		client.on("userUpdated", function (e) {
			var connectionChange = Onvida.Utils.isInArray(e.updateReasons, "online");
			if (connectionChange) {
				chatClient.dispatchEvent(
				  enums.Events.USER_UPDATED,
				  toUser(e.user)
				);
			}
		});

		client.on("channelLeft", function (room) {
			if (channel != null && channel.uniqueName == room.uniqueName) {
				chatClient.debug(
				  "channelLeft(" +
				  room.uniqueName +
				  ") - Current - Status: " +
				  channel.status
				);
				chatClient.dispatchEvent(enums.Events.ROOM_CLOSED);
			} else {
				chatClient.debug(
				  "channelLeft(" + room.uniqueName + ") - Not Current - Ignore"
				);
			}
		});

		client.on("channelRemoved", function (room) {
			chatClient.debug(
			  "channelRemoved(" +
			  room.uniqueName +
			  ") - Current - Status: " +
			  channel.status
			);
			chatClient.dispatchEvent(enums.Events.ROOM_CLOSED);
		});

		client.on("memberJoined", function (user) {
			chatClient.dispatchEvent(
			  enums.Events.USER_JOINED,
			  toUser(user)
			);
		});

		client.on("memberLeft", function (user) {
			chatClient.dispatchEvent(enums.Events.USER_LEFT, toUser(user));
		});

		client.on("messageAdded", function (message) {
			chatClient.dispatchEvent(
			  enums.Events.MESSAGE_ADDED,
			  toMessage(message)
			);
		});

		client.on("typingStarted", function (user) {
			chatClient.dispatchEvent(
			  enums.Events.TYPING_STARTED,
			  toUser(user)
			);
		});

		client.on("typingEnded", function (user) {
			chatClient.dispatchEvent(
			  enums.Events.TYPING_ENDED,
			  toUser(user)
			);
		});

		client.on("tokenAboutToExpire", function () {
			chatClient.dispatchEvent(enums.Events.TOKEN_EXPIRED);
		});

		client.on("tokenExpired", function () {
			chatClient.dispatchEvent(enums.Events.TOKEN_EXPIRED);
		});
	};

	var toUser = function (u) {
		return {
			Identity: u.identity,
			FriendlyName:
			  typeof u.friendlyName == "undefined" ? null : u.friendlyName,
			GroupID: channel == null ? null : channel.friendlyName,
			Online: u.online === true
		};
	};

	var toMessage = function (m) {
		return {
			Identity: m.author,
			Type: JSON.parse(m.body).type,
			Text: JSON.parse(m.body).text,
			TimeStamp: m.timestamp
		};
	};

	return chatClient;
});
