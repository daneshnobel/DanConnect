window.Onvida.Lib.OnvidaChatHub = (function () {
	var $j = jQuery.noConflict(),
		enums = Onvida.Lib.ChatClientEnums,
		connectionState = Onvida.Lib.ChatClientEnums.States.DISCONNECTED,
		connectionStarting = false,
		endPoint = null,
		self = Onvida.Lib.EventManager(this, 'OnvidaChatHub');

	init();

	function init() {
		try {
			//$j.connection.hub.logging = true;
			$j.connection.hub.qs = { "sessionID": Onvida.sessionID, "client": Onvida.Utils.getClient() };
			$j.connection.hub.url = Onvida.apiBase + 'signalr';
			self.debug('Hub URL: ' + $j.connection.hub.url);
			endPoint = $j.connection['ChatHub'];
			endPoint.client['receiveMessage'] = receiveMessage;
			if (endPoint)
				start();
		} catch (error) {
			self.debug('init - Error: ' + error.message, true);
		}
	}

	function start(callback) {
		try {
			if (!connected() && !connectionStarting) {
				connectionStarting = true;
				$j.connection.hub.start().done(function () {
					connectionChanged(enums.States.CONNECTED);
					connectionStarting = false;
					self.dispatchEvent(enums.HubEvents.CONNECTION_STARTED);
					self.dispatchEvent(enums.HubEvents.CONNECTION_ACTIVE);
					$j.connection.hub.reconnecting(function () {
						connectionChanged(enums.States.CONNECTING);
					});
					$j.connection.hub.reconnected(function () {
						connectionChanged(enums.States.CONNECTED);
						self.dispatchEvent(enums.HubEvents.CONNECTION_RESTARTED);
						self.dispatchEvent(enums.HubEvents.CONNECTION_ACTIVE);
					});
					$j.connection.hub.disconnected(function () {
						connectionChanged(enums.States.DISCONNECTED);
						self.dispatchEvent(enums.HubEvents.CONNECTION_ENDED);
					});
					if (callback)
						callback();
				});
			}
		} catch (error) {
			self.debug('start - Error: ' + error.message, true);
			if (callback)
				callback(error);
		}
	}

	function stop() {
		try {
			$j.connection.hub.stop();
		} catch (error) {
			self.debug('stop - Error: ' + error.message, true);
		}
	}

	function dispose() {
		self.debug('dispose');
		self.disposeEventListening();
		stop();
	}

	function connected() {
		return connectionState == enums.States.CONNECTED;
	}

	function joinChat (chatID, identity) {
		return promiseWrapper('join', [chatID, identity]);
	}

	function leaveChat (chatID, identity) {
		return promiseWrapper('leave', [chatID, identity]);
	}

	function getChatUser (chatID, identity) {
		return promiseWrapper('getUser', [chatID, identity]);
	}

	function sendChatMessage (chatID, identity, type, text) {
		return promiseWrapper('sendMessage', [chatID, identity, type, text]);
	}

	function receiveMessage(chatID, identity, friendlyName, timeStamp, type, payload) {
		self.debug('receiveMessage: ' + type + ' | ' + payload);
		self.dispatchEvent(enums.Events.MESSAGE_RECEIVED, {
			ChatID: chatID,
			Identity: identity,
			FriendlyName: friendlyName,
			Type: type,
			Text: payload,
			Online: (type == 'UserUpdate') ? (payload != 'disconnected') : null,
			TimeStamp: new Date(timeStamp)
		});
	}

	function connectionChanged(newState) {
		connectionState = newState;
		receiveMessage(null, null, null, new Date().getTime(), 'ConnectionStateChange', newState);
	}

	function callServerMethod(method, args, success, failure) {
		try {
			if (connected()) {
				(endPoint.server[method].apply(self, args)).done(function (response) {
					if (typeof success === 'function')
						success(response);
				}).fail(function (error) {
					self.debug('callServerMethod(' + method + ') - Failure: ' + error, true);
					if (typeof failure === 'function')
						failure();
				});
			} else {
				self.addOneTimeEventListener(enums.HubEvents.CONNECTION_STARTED, function () {
					callServerMethod(method, args, success, failure);
				});
			}
		} catch (error) {
			self.debug('callServerMethod(' + method + ') - Error: ' + error.message, true);
			if (typeof failure === 'function')
				failure();
		}
	}

	function promiseWrapper(method, parameters) {
		return new Promise(function (resolve, reject) {
			callServerMethod(method, parameters, function (response) {
				resolve(response);
			}, function (error) {
				reject(error);
			});
		});
	}

	return Onvida.Utils.extend(self, {
		connected: connected,
		start: start,
		stop: stop,
		dispose: dispose,
		joinChat: joinChat,
		leaveChat: leaveChat,
		getChatUser: getChatUser,
		sendChatMessage: sendChatMessage
	});
});

