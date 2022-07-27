window.Onvida.Lib.ChatClient = (function (vendor) {
	let _vendor = vendor,
	  _service = "Chat",
	  _connectionState = Onvida.Lib.ChatClientEnums.States.DISCONNECTED,
	  _eventListening = false,
	  _eventEmitter = null,
	  _eventListeners = {},
	  _ready = false,
	  self = Onvida.Lib.EventManager(this, _vendor + _service);

	function join(chatID, identity, token, resumed) {
		return new Promise(function (resolve, reject) {
			resolve();
		});
	}

	function reconnect(chatID) {
		return new Promise(function (resolve, reject) {
			resolve();
		});
	}

	function leave() {
		return new Promise(function (resolve, reject) {
			resolve();
		});
	}

	function getUser(identity) {
		return new Promise(function (resolve, reject) {
			resolve();
		});
	}

	function getMessages() {
		return new Promise(function (resolve, reject) {
			resolve();
		});
	}

	function sendMessage(type, text) {
		return new Promise(function (resolve, reject) {
			resolve();
		});
	}

	function typing() {
		return new Promise(function (resolve, reject) {
			resolve();
		});
	}

	function dispose() {
		return new Promise(function (resolve, reject) {
			resolve();
		});
	}

	function ready() {
		return _ready;
	}

	function connected() {
		return _connectionState == Onvida.Lib.ChatClientEnums.States.CONNECTED;
	}

	function reset() { }

	function updateToken(token) { }

	function vendorType() {
		return _vendor;
	}

	function serviceType() {
		return _service;
	}

	function connectionState() {
		return _connectionState;
	}

	return Onvida.Utils.extend(self, {
		join: join,
		reconnect: reconnect,
		leave: leave,
		getUser: getUser,
		getMessages: getMessages,
		sendMessage: sendMessage,
		typing: typing,
		dispose: dispose,
		ready: ready,
		connected: connected,
		reset: reset,
		updateToken: updateToken,
		vendorType: vendorType,
		serviceType: serviceType,
		connectionState: connectionState,
	});
});

