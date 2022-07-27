window.Onvida.Lib.ChatClientEnums = (function () {
	const Events = Object.freeze({
		CONNECTIONSTATE_CHANGED: "chatClient_connectionStateChanged",
		ROOM_JOINED: "chatClient_roomJoined",
		ROOM_CLOSED: "chatClient_roomClosed",
		MESSAGE_ADDED: "chatClient_messageAdded",
		TYPING_STARTED: "chatClient_typingStarted",
		TYPING_ENDED: "chatClient_typingEnded",
		USER_JOINED: "chatClient_userJoined",
		USER_LEFT: "chatClient_userLeft",
		USER_UPDATED: "chatClient_userUpdated",
		TOKEN_EXPIRED: "chatClient_tokenExpired",
		MESSAGE_RECEIVED: "chatClient_messageReceived",
	});

	const HubEvents = Object.freeze({
		CONNECTION_ACTIVE: "hub_connectionActive",
		CONNECTION_STARTED: "hub_connectionStarted",
		CONNECTION_RESTARTED: "hub_connectionRestarted",
		CONNECTION_ENDED: "hub_connectionEnded",
	});

	const States = Object.freeze({
		CONNECTING: "connecting",
		CONNECTED: "connected",
		DISCONNECTING: "disconnecting",
		DISCONNECTED: "disconnected",
	});

	return {
		Events: Events,
		HubEvents: HubEvents,
		States: States
	};
})();
