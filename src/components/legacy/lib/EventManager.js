window.Onvida.Lib.EventManager = function (obj, debugPrefix, element) {
	let _eventListening = false,
		_debugPrefix = 'Onvida',
		_eventEmitter = null,
		_origElem = null,
		_eventListeners = {};

	_origElem = element;
	_eventEmitter = (element instanceof HTMLElement || element instanceof HTMLDocument || element instanceof Window) ? element : document.createElement('DIV');
	_eventEmitter.uniqueID = new Date().getTime();
	obj.eventListening = eventListening;
	obj.addEventListener = addEventListener;
	obj.addOneTimeEventListener = addOneTimeEventListener;
	obj.removeEventListener = removeEventListener;
	obj.removeAllEventListeners = removeAllEventListeners;
	obj.disposeEventListening = disposeEventListening;
	obj.dispatchEvent = dispatchEvent;
	if (typeof debugPrefix === 'string') {
		_debugPrefix = debugPrefix;
		obj.debug = debug;
	}

	function eventListening(value) {
		if (typeof value === "boolean") _eventListening = value;
		return _eventListening;
	}

	function addEventListener(eventType, handlerFunction, options) {
		if (_eventEmitter != null) {
			//debug('addEventListener(' + eventType + ') - ' + _eventEmitter.uniqueID);
			_eventEmitter.addEventListener(eventType, handlerFunction, options);
			if (!_eventListeners.hasOwnProperty(eventType)) {
				_eventListeners[eventType] = new Array();
			}
			_eventListeners[eventType].push(handlerFunction);
		}
	}

	function addOneTimeEventListener(eventType, handlerFunction) {
		addEventListener(eventType, handlerFunction, { once: true });
	}

	function removeEventListener(eventType, handlerFunction) {
		if (_eventEmitter != null) {
			if (_eventListeners.hasOwnProperty(eventType)) {
				var index = Onvida.Utils.getArrayIndex(_eventListeners[eventType], handlerFunction);
				if (index != -1) {
					_eventEmitter.removeEventListener(eventType, handlerFunction);
					_eventListeners[eventType].splice(index, 1);
				}
			}
		}
	}

	function removeAllEventListeners(eventType) {
		if (_eventEmitter != null) {
			for (var type in _eventListeners) {
				if (typeof eventType == 'undefined' || type == eventType) {
					for (var i = 0; i < _eventListeners[type].length; i++) {
						_eventEmitter.removeEventListener(type, _eventListeners[type][i]);
					}
					_eventListeners[type] = new Array();
				}
			}
		}
	}

	function disposeEventListening() {
		removeAllEventListeners();
		_eventListening = false;
		if (_eventEmitter != _origElem)
			_eventEmitter = null;
	}

	function dispatchEvent(eventType, data) {
		if (_eventEmitter != null) {
			//debug('dispatchEvent(' + eventType + ', ' + JSON.stringify(data) + ') - ' + _eventEmitter.uniqueID);
			var event = new CustomEvent(eventType, { detail: data });
			_eventEmitter.dispatchEvent(event);
		}
	}

	function debug(message, isError) {
		if (typeof window.Onvida != "undefined" && window.Onvida != null) {
			window.Onvida.Log[isError ? 'error' : 'debug'](_debugPrefix + ": " + message);
		}
	}

	return obj;
};

