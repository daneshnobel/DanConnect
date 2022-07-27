/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */

if (typeof window.Onvida != 'undefined' && window.Onvida != null && !window.Onvida.hasOwnProperty('Chat')) {
    Onvida.Log.debug('Onvida.Chat Module Loaded');
    window.Onvida.Chat = (function () {
        /* Private Variables */
    	var
            videoChatClientReady = false,
            videoChatMedia = null,
            videoChatRoom = null,
            videoChatInProgress = false,
            videoChatAudioDeviceFound = false,
            videoChatVideoDeviceFound = false,

            textChatClient = null,
            textChatInProgress = false,
            userOnline = null,

            //UI
            togglingVideo = false,
            togglingAudio = false,
            togglingSelfView = false,
            togglingChat = false,
            videoEnabled = false,
            audioEnabled = false,
            selfViewEnabled = false,
            chatViewEnabled = true,

            statusTimer = null,
            statusWait = 5000,
            statusEnabled = false,

            statusAutoHideTimer = null,
            statusAutoHideWait = 3000,

            queuePositionTimer = null,
            queuePositionWait = 10000,
            queuePositionLast = null,

            inactivityTimer = null,
            inactivityTimeout = 30,
            inactivityTimerEnabled = false,
            typingTimer = null,
            typingWait = 3000,

            inactivityCounter = null,
            inactivityCountdownMax = 30,
            inactivityCountdownTimer = null,
            inactivityCountdownWait = 1000,

            closeTimer = null,
            closeWait = 5 * 60 * 1000,

            disconnectTimer = null,
            disconnectWait = 30 * 1000,

            availabilityTimer = null,
            availabilityWait = 30 * 1000,

            participants = [],

            chatType = null,
            chatStarting = false,
            chatEnding = false,
            chatOpen = false,
            chatCollapsed = false,
            chatMuted = false,
            chatPopped = false,
            chatAnswered = false,
            chatInQueue = false,
            chatOnHold = false,
            chatDisconnected = false,
            chatStatusFailures = 0,
            pendingData = null,

            currPanel = null,
            lastPanel = null,
            endPanelHidden = true,
            endPanel = null,
            messageRendering = false,
			messageRetrieving = false,
            messageQueue = null,
			messageQueueNew = null,

            moduleResizable = true,
            moduleDraggable = true,
			enums = Onvida.Lib.ChatClientEnums;

            agentName = null;

        /* Chat Flow Methods */
        var startChat = function (user, requeue) {
            if (!chatStarting && !videoChatInProgress && !textChatInProgress && !chatEnding) {
                Onvida.Log.debug('Chat Private - startChat()');
                setChatType(Onvida.Chat.videoChatEnabled() ? 'Video' : 'Text');
                Onvida.Chat.reset();
                chatStarting = true;
                chatAnswered = false;
                chatInQueue = false;
                chatDisconnected = false;
                videoChatInProgress = false;
                textChatInProgress = false;
                participants = [];
                queueChat(user, requeue, function (response) {
                    showPanel('Chat');
                    vcToggleChatView(chatViewEnabled);
                    if (Onvida.Chat.textChatEnabled()) {
                        startTextChat(Onvida.Chat.config.ChatID, Onvida.Chat.config.Token);
                    }
                    if (Onvida.Chat.videoChatEnabled()) {
                        vcToggleVideo(videoEnabled, false, true);
                        vcToggleAudio(audioEnabled, false, true);
                        vcToggleSelfView(true);
                        vcShowPanel('Waiting');
                        showElem(Onvida.Chat.ui.uiVideochat, true);
                        checkOrientationChange(Onvida.Chat.ui.moduleRoot);
                    }
                    getChatStatus(Onvida.Chat.config.ChatID);
                });
            }
        }

        var setChatType = function (type, autoStart) {
            Onvida.Log.debug('Chat Private - setChatType(' + type + ')');
            chatType = type;
            switch (type) {
                case 'Video':
                    videoEnabled = true;
                    audioEnabled = true;
                    chatViewEnabled = false;
                    break;
                case 'Audio':
                    videoEnabled = false;
                    audioEnabled = true;
                    chatViewEnabled = false;
                    break;
                case 'Text':
                    videoEnabled = false;
                    audioEnabled = false;
                    chatViewEnabled = true;
                    break;
            }
            toggleClass(Onvida.Chat.ui.moduleRoot, 'feature-video', videoEnabled || audioEnabled);
            toggleClass(Onvida.Chat.ui.moduleRoot, 'feature-audio', audioEnabled);
            toggleClass(Onvida.Chat.ui.moduleRoot, 'feature-text', chatViewEnabled);
            if (autoStart)
                startChat(pendingData.user, pendingData.requeue);
        }

        var continueChat = function (source) {
            startInactivityTimer();
            if (chatAnswered) {
                systemMessage('Continue', source);
                showPanel('Chat');
            } else {
                showPanel(lastPanel);
            }
            clearStatus();
        }

        var endChat = function (agentEndedChat, inactivityTimeout, userDisconnected, agentDisconnected, unavailableCallback) {
            if (Onvida.Chat.isQueued() || Onvida.Chat.isInProgress()) {
                if (!chatEnding) {
                    Onvida.Log.debug('Chat Private - endChat(' + agentEndedChat + ', ' + inactivityTimeout + ', ' + userDisconnected + ', ' + agentDisconnected + ')');
                    chatEnding = true;
                    window.clearTimeout(statusTimer);
                    window.clearTimeout(queuePositionTimer);
                    stopDisconnectTimer();
                    stopInactivityTimer();
                    stopInactivityCountdown();
                    stopAvailabilityTimer();
                    if (typeof unavailableCallback != 'function') {
                        showElem(Onvida.Chat.ui.btnCloseCompleteResume, agentEndedChat);
                        showPanel((inactivityTimeout || userDisconnected || agentDisconnected) ? 'InactivityComplete' : 'CloseComplete', (inactivityTimeout || userDisconnected) ? { reason: inactivityTimeout ? 'inactivity' : 'network issues' } : null);
                        showElem(Onvida.Chat.ui.holderTranscript, true);
                        tcShowControls(false);
                        showElem(Onvida.Chat.ui.uiVideochat, false);
                        vcToggleChatView(true);
                        checkOrientationChange(Onvida.Chat.ui.moduleRoot);
                    }

                    function endChatCallback(response) {
                        tcDisconnect();
                        vcDisconnect();
                        chatEnding = false;
                        chatStarting = false;
                        chatInQueue = false;
                        chatOnHold = false;
                        videoChatInProgress = false;
                        textChatInProgress = false;
                        chatAnswered = false;
                        chatStatusFailures = 0;
                        chatType = null;
                        pendingData = null;
                        participants = [];
                        if (typeof unavailableCallback === 'function') {
                            unavailableCallback();
                        } else {
                            if (!agentEndedChat && !inactivityTimeout && !userDisconnected && !agentDisconnected)
                                closeChat();
                            startCloseTimer();
                        }
                    }

                    if (userDisconnected) {
                        Onvida.sendRequest('Chat/LeaveChat', {
                            chatUserID: Onvida.Chat.config.ChatID
                        });
                        endChatCallback();
                    } else {
                        Onvida.sendRequest('Chat/LeaveChat', {
                            chatUserID: Onvida.Chat.config.ChatID
                        }, endChatCallback);
                    }
                }
            }
        }

        var closeChat = function () {
            stopCloseTimer();
            if (Onvida.Chat.config.ChatID != null) {
                Onvida.Log.debug('Chat Private - closeChat()');
                Onvida.sendRequest('Chat/CloseChat', {
                    chatID: Onvida.Chat.config.ChatID
                }, function (response) {
                    Onvida.Chat.config.ChatID = null;
                });
            }
        }

        var queueChat = function (user, requeue, callback) {
            var userData = (typeof user == 'undefined' || user == null) ? null : JSON.stringify(user);
            requeue = requeue === true;
            Onvida.Log.debug('Chat Private - queueChat(' + userData + ', ' + requeue + ')');
            Onvida.sendRequest('Chat/InboundChat', {
                userData: userData,
                requeueChatID: (requeue) ? Onvida.Chat.config.ChatID : null,
                requestType: Onvida.requestType,
                requestTypeColor: Onvida.requestTypeColor,
                deviceType: 'Browser'
            }, function (response) {
                if (!chatEnding) {
                    Onvida.Chat.config.ChatID = response.ChatID;
                    Onvida.Chat.config.UserIdentity = response.UserIdentity;
                    Onvida.Chat.config.Token = response.Token;
                    chatInQueue = true;
                    startAvailabilityTimer();
                    updateQueuePosition(true);
                    getInactivitySettings(function () {
                        callback(response);
                    });
                }
            }, function (errorCode, message) {
                if (typeof message === 'string') {
                    var messageParts = message.split('|');
                    if (messageParts.length >= 2) {
                        var errorType = messageParts.shift();
                        var errorMessage = messageParts.shift();
                        var errorInfo = messageParts.length == 0 ? null : messageParts.shift();
                        declineChat(errorType, errorMessage, errorInfo);
                    }
                }
            });
        };

        var declineChat = function (errorType, errorMessage, errorInfo) {
            Onvida.Log.warn('Chat Private - declineChat: ' + errorType + ' - ' + errorMessage + ((errorInfo == null) ? '' : (' (Info: ' + errorInfo + ')')));
            stopAvailabilityTimer();
            if (chatInQueue) {
                endChat(true, false, false, false, function () {
                    declineChat(errorType, errorMessage, errorInfo);
                });
            } else {
                chatInQueue = false;
                chatAnswered = false;
                chatType = null;
                pendingData = null;
                clearStatus();
                if (errorMessage != '' && errorMessage != 'null') {
                    replaceTags(Onvida.Chat.ui.txtUnavailable, errorMessage);
                } else {
                    replaceTags(Onvida.Chat.ui.txtUnavailable, Onvida.Chat.ui.txtUnavailable.template);
                }
                showPanel('Unavailable');
            }
        }

        var getChatStatus = function (callback) {
            window.clearTimeout(statusTimer);
            if (Onvida.Chat.isQueued() || Onvida.Chat.isInProgress()) {
                Onvida.sendRequest('Interaction/GetChatUpdate', {}, function (response) {
                    if (Onvida.Chat.isQueued() || Onvida.Chat.isInProgress()) {
                        participants = response.Callers;
                        if (!(response.ParentCallStatus == 'failed' && chatAnswered)) {
                            chatStatusFailures = 0;
                        }
                        if (response.ParentCallStatus != null && chatInQueue && !chatAnswered) {
                            chatConnected();
                        }
                        if (response.ParentCallStatus == 'completed') {
                            endChat(true);
                        } else if (response.ParentCallStatus == 'failed' && chatAnswered) {
                            chatStatusFailures++;
                            if (chatStatusFailures == 2) {
                                systemMessage('End', 'disconnect');
                                endChat(true);
                            }
                        } else if (response.OutgoingCallStatus == 'failed') {
                            endChat(false, false, true);
                        }
                        if (typeof callback === 'function')
                            callback(response);
                        statusTimer = window.setTimeout(getChatStatus, statusWait);
                    }
                }, function (errorCode, message) {
                    chatStatusFailures++;
                    if (chatStatusFailures == 5) {
                    	tcMessageHandler({
                    		Type: 'End',
                    		Text: 'disconnect',
                    		TimeStamp: new Date()
                    	}, true);
                        endChat(false, false, true);
                    }
                    statusTimer = window.setTimeout(getChatStatus, statusWait);
                });
            }
        }

        var chatConnected = function () {
            if (chatInQueue && !chatAnswered) {
                Onvida.Log.debug('Chat Private - chatConnected()');
                chatInQueue = false;
                stopAvailabilityTimer();
                getClientAccessToken(function (response) {
                    clearStatus();
                    playChatSound('answer');
                    if (Onvida.Chat.videoChatEnabled())
                        startVideoChat(Onvida.Chat.config.ChatID, response.Token);
                    chatAnswered = true;
                    chatStarting = false;
                });
            }
        }

        var getClientAccessToken = function (callback) {
            Onvida.Log.debug('Chat Private - getClientAccessToken()');
            Onvida.sendRequest('Chat/GetClientAccessToken', {
                chatUserID: Onvida.Chat.config.ChatID,
                chatID: Onvida.Chat.config.ChatID
            }, function (response) {
                if (!chatEnding) {
                    Onvida.Chat.config.Token = response.Token;
                    if (typeof callback === 'function')
                        callback(response);
                }
            });
        };

        var getIdentifyForm = function (callback) {
            if (Onvida.Chat.formLoaded || Onvida.Chat.config.FormType != Onvida.FormTypes.CUSTOM) {
                Onvida.Chat.formLoaded = true;
                prefillForm();
                if (typeof callback === 'function')
                    callback();
            } else {
                Onvida.Loader.loadAsset('Chat/GetIdentifyForm', Onvida.Loader.FileTypes.HTML, Onvida.getRoot().querySelector('.' + Onvida.uiPrefix + '-holder-identify-form'), 'replace', function () {
                    Onvida.Chat.formLoaded = true;
                    prefillForm();
                    showPanel('Identify', true);
                    window.setTimeout(function () {
                        var scrollHeight = Onvida.Chat.ui.panelIdentify.scrollHeight;
                        var clientHeight = Onvida.Chat.ui.panelIdentify.clientHeight;
                        var module = Onvida.getRoot().querySelector('.' + Onvida.uiPrefix + '-module-chat');
                        var origHeight = module.clientHeight;
                        var newHeight = module.clientHeight + (scrollHeight - clientHeight);
                        if (scrollHeight > clientHeight) {
                            module.style.height = newHeight + 'px';
                            module.style.minHeight = newHeight + 'px';
                        } else {
                            Onvida.getRoot().querySelector('.' + Onvida.uiPrefix + '-holder-identify').classList.add('onv-center-center');
                        }
                        hidePanels();
                        if (typeof callback === 'function')
                            callback();
                    }, 1);
                });
            }
        }

        var prefillForm = function () {
            var form = Onvida.Chat.ui.formIdentify;
            var fields = form.querySelectorAll('INPUT, TEXTAREA, SELECT');
            var userProps = ['onvidaID', 'crmUserID', 'firstName', 'lastName', 'email', 'phone'];
            for (var i = 0; i < fields.length; i++) {
                var field = fields[i];
                if (field.placeholder != '' && field.placeholder != null) {
                    field.title = field.placeholder;
                }
                for (var j = 0; j < field.classList.length; j++) {
                    var className = field.classList.item(j);
                    if (className.indexOf(Onvida.uiPrefix + '-input-') == 0) {
                        var propName = className.split('-');
                        propName = propName[propName.length - 1].toLowerCase();
                        if (Onvida.hasOwnProperty('user') && Onvida.user != null) {
                            for (var k = 0; k < userProps.length; k++) {
                                if (userProps[k].toLowerCase() == propName && Onvida.user.hasOwnProperty(userProps[k]) && Onvida.user[userProps[k]] != null) {
                                    field.value = Onvida.user[userProps[k]];
                                }
                            }
                        }
                        if (propName == 'requesttype' && Onvida.requestType != null) {
                            field.value = Onvida.requestType;
                            if (field.value != Onvida.requestType && field.type == 'select-one') {
                                var selIndex = -1;
                                for (var m = 0; m < field.options.length; m++) {
                                    if (field.options[m].value.indexOf('|') != -1) {
                                        if (field.options[m].value.split('|')[0] == Onvida.requestType) {
                                            selIndex = m;
                                            break;
                                        }
                                    }
                                }
                                if (selIndex != -1) {
                                    field.selectedIndex = selIndex;
                                }
                            }
                        }
                    }
                }
            }
        };

        var validRegForm = function () {
            var form = Onvida.Chat.ui.formIdentify;
            var fields = form.querySelectorAll('INPUT, TEXTAREA, SELECT');
            var errors = false;
            var userObj = { customData: {} };
            var userProps = ['onvidaID', 'crmUserID', 'firstName', 'lastName', 'email', 'phone'];
            for (var i = 0; i < fields.length; i++) {
                if (fields[i].nodeName == 'INPUT' || fields[i].nodeName == 'TEXTAREA') {
                    var newValue = Onvida.Utils.stripHTML(fields[i].value);
                    if (newValue != fields[i].value) {
                        fields[i].setCustomValidity('HTML tags are not allowed.');
                        return false;
                    } else {
                        fields[i].setCustomValidity('');
                    }
                }
                if (!fields[i].validity.valid) {
                    return false;
                }
                for (var j = 0; j < fields[i].classList.length; j++) {
                    var className = fields[i].classList.item(j);
                    if (className.indexOf(Onvida.uiPrefix + '-input-') == 0) {
                        var foundProp = false;
                        var propName = className.split('-');
                        propName = propName[propName.length - 1].toLowerCase();
                        for (var k = 0; k < userProps.length; k++) {
                            if (userProps[k].toLowerCase() == propName) {
                                userObj[userProps[k]] = fields[i].value;
                                foundProp = true;
                            }
                        }
                        if (!foundProp && propName == 'requesttype') {
                            var reqString = fields[i].value.toString().trim();
                            if (reqString != '') {
                                if (reqString.indexOf('|') == -1)
                                    Onvida.requestType = reqString;
                                else {
                                    var reqParts = reqString.split('|');
                                    Onvida.requestType = reqParts[0];
                                    Onvida.requestTypeColor = reqParts[1];
                                }
                            }
                            foundProp = true;
                        }
                        if (!foundProp)
                            userObj.customData[propName] = fields[i].value;
                    }
                }
            }
            Onvida.user = Onvida.Utils.extend(Onvida.user, userObj);
            return true;
        };

        var updateQueuePosition = function (initial) {
            window.clearTimeout(queuePositionTimer);
            if (initial === true)
                queuePositionLast = null;
            if (chatInQueue && !chatAnswered) {
                getQueuePosition(function (position) {
                    if (chatInQueue && !chatAnswered && position != '0th') {
                        if (queuePositionLast != null) {
                            var last = parseInt(queuePositionLast.replace(/\D/g, ''));
                            var curr = parseInt(position.replace(/\D/g, ''));
                            if (last < curr)
                                position = queuePositionLast;
                        }
                        queuePositionLast = position;
                        updateStatus('queued', { position: position });
                        queuePositionTimer = window.setTimeout(updateQueuePosition, queuePositionWait);
                    }
                });
            }
        };

        var getQueuePosition = function (callback) {
            Onvida.Log.debug('Chat Private - getQueuePosition()');
            Onvida.sendRequest('Chat/GetQueuePosition', {
                chatID: Onvida.Chat.config.ChatID
            }, function (response) {
                if (typeof callback === 'function')
                    callback(response.QueuePosition);
            });
        };

        var systemMessage = function (type, detail) {
            Onvida.Log.debug('Chat Private - systemMessage(' + type + ', ' + detail + ')');
            Onvida.sendRequest('Chat/HandleClientEvent', {
                chatID: Onvida.Chat.config.ChatID,
                type: type,
                detail: detail
            });
        }

        var getInactivitySettings = function (callback) {
            Onvida.Log.debug('Chat Private - getInactivitySettings()');
            Onvida.sendRequest('Chat/GetInactivitySettings', {}, function (response) {
                inactivityTimeout = response.InactivityTimeout;
                inactivityCountdownMax = response.InactivityCountdown;
                if (typeof callback === 'function')
                    callback(response);
            });
        }

        var startInactivityTimer = function () {
            stopInactivityTimer();
            Onvida.Log.debug('Chat Private - startInactivityTimer()');
            if (inactivityTimeout > 0) {
                inactivityTimerEnabled = true;
                inactivityTimer = window.setTimeout(function () {
                    if (Onvida.Chat.isInProgress())
                        systemMessage('Closing', 'inactivity');
                }, inactivityTimeout * 1000);
            }
        }

        var stopInactivityTimer = function (pauseOnly) {
            Onvida.Log.debug('Chat Private - stopInactivityTimer(pauseOnly = ' + (pauseOnly === true) + ')');
            window.clearTimeout(inactivityTimer);
            if (!pauseOnly) {
                inactivityTimerEnabled = false;
                window.clearTimeout(typingTimer);
            }
        }

        var startInactivityCountdown = function () {
            Onvida.Log.debug('Chat Private - startInactivityCountdown(' + inactivityCountdownMax + 's)');
            inactivityCounter = inactivityCountdownMax;
            updateInactivityCountdown();
        }

        var stopInactivityCountdown = function () {
            Onvida.Log.debug('Chat Private - stopInactivityCountdown()');
            window.clearTimeout(inactivityCountdownTimer);
            inactivityCounter = null;
        }

        var updateInactivityCountdown = function () {
            window.clearTimeout(inactivityCountdownTimer);
            Onvida.Chat.ui.txtInactivityCount.innerText = inactivityCounter;
            inactivityCounter--;
            if (inactivityCounter >= 0) {
                inactivityCountdownTimer = window.setTimeout(updateInactivityCountdown, inactivityCountdownWait);
            } else {
                systemMessage('End', 'inactivity');
                endChat(false, true);
            }
        }

        var startDisconnectTimer = function () {
            stopDisconnectTimer();
            Onvida.Log.debug('Chat Private - startDisconnectTimer()');
            chatDisconnected = true;
            disconnectTimer = window.setTimeout(function () {
                if (Onvida.Chat.isQueued() || Onvida.Chat.isInProgress()) {
                	var isDisconnected = (textChatClient.connectionState() == enums.States.CONNECTING) || (textChatClient.connectionState() == enums.States.DISCONNECTED);
                    if (isDisconnected) {
                        endChat(false, false, true);
                    }
                }
            }, disconnectWait);
        }

        var stopDisconnectTimer = function () {
            Onvida.Log.debug('Chat Private - stopDisconnectTimer()');
            window.clearTimeout(disconnectTimer);
            chatDisconnected = false;
        }

        var startCloseTimer = function () {
            Onvida.Log.debug('Chat Private - startCloseTimer()');
            window.clearTimeout(closeTimer);
            closeTimer = window.setTimeout(function () { Onvida.close('Chat'); }, closeWait);
        }

        var stopCloseTimer = function () {
            Onvida.Log.debug('Chat Private - stopCloseTimer()');
            window.clearTimeout(closeTimer);
        }

        var startAvailabilityTimer = function () {
            window.clearTimeout(availabilityTimer);
            availabilityTimer = window.setTimeout(function () {
                Onvida.Chat.isAvailable(function (response) {
                    if (response.Available || response.ErrorType == 'AfterHours' || response.ErrorType == 'ApplicationError')
                        startAvailabilityTimer();
                    else
                        declineChat(response.ErrorType, response.ErrorMessage, response.ErrorInfo);
                });
            }, availabilityWait);
        }

        var stopAvailabilityTimer = function () {
            window.clearTimeout(availabilityTimer);
        }

        var updateStatus = function (stateName, params, autoHide) {
            if (statusEnabled) {
                Onvida.Log.debug('Chat Private - updateStatus(' + stateName + ', ' + JSON.stringify(params) + ', ' + autoHide + ')');
                window.clearTimeout(statusAutoHideTimer);
                var pic = showElem('pic-status-' + stateName, true, 'pic');
                var txt = showElem('txt-status-' + stateName, true, 'txt');
                replaceTags(txt, params);
                showElem(Onvida.Chat.ui.holderStatus, true);
                switch (stateName) {
                    case 'hold':
                        chatOnHold = true;
                        playChatSound('hold');
                        break;
                    case 'active':
                        if (chatOnHold) {
                            chatOnHold = false;
                            playChatSound('resume');
                        }
                        break;
                    case 'joined':
                        playChatSound('join');
                        break;
                    case 'left':
                        playChatSound('leave');
                        break;
                    case 'close-confirm':
                    case 'inactivity':
                    case 'error':
                        playChatSound('alert');
                        break;
                    case 'close-complete':
                    case 'inactivity-complete':
                        playChatSound('end');
                        break;
                }
                if (autoHide) {
                    statusAutoHideTimer = window.setTimeout(clearStatus, statusAutoHideWait);
                }
            }
        }

        var updateStatusWithParticipant = function (stateName, user, autoHide) {
            if (textChatClient.ready()) {
                var params = {};
                var prepUserAndUpdate = function (user) {
                    for (var i in user) {
                        params[i] = user[params[i]];
                    }
                    params.name = (user.FriendlyName == 'User' && user.Identity != Onvida.Chat.config.UserIdentity) ? 'Agent' : Onvida.Utils.getFirstNameLastInitial(user.FriendlyName);
                    updateStatus(stateName, params, autoHide);
                    if ((stateName == 'left' || stateName == 'joined') && Onvida.Chat.isInProgress()) {
                        systemMessage((stateName == 'left') ? 'Leave' : 'Join', params.name + '|' + user.Identity);
                    }
                };
                if (user.hasOwnProperty('FriendlyName') && user.FriendlyName != null) {
                    prepUserAndUpdate(user);
                } else {
                    textChatClient.getUser(user.Identity)
                        .then(user => {
                            prepUserAndUpdate(user);
                        }).catch(function (error) {
                            Onvida.Log.error('OnvidaChat.updateStatusWithParticipant(' + error.code + '): ' + error.message, document.currentScript);
                            prepUserAndUpdate(user);
                        });
                }
            }
        }

        var clearStatus = function () {
            Onvida.Log.debug('Chat Private - clearStatus()');
            updateStatus((textChatInProgress && chatAnswered) ? 'active' : 'inactive', { 'name': agentName });
        }

        var playChatSound = function (soundName) {
            if (!chatMuted) {
                Onvida.Utils.audioPlay('chat-' + soundName);
            }
        }

        /* Video Chat Methods */
        var startVideoChat = function (chatID, token) {
            Onvida.Log.debug('Chat Private - startVideoChat()');
            Onvida.Chat.resetVideoChat();
            Twilio.Video.connect(token, { name: chatID, audio: audioEnabled, video: videoEnabled }).then(function (room) {
                videoChatInProgress = true;
                videoChatRoom = room;
                videoChatMedia = room.localParticipant;
                videoChatAudioDeviceFound = audioEnabled;
                videoChatVideoDeviceFound = videoEnabled;

                vcInitRoomEvents();
                if (audioEnabled || videoEnabled)
                    vcAttachParticipantTracks(videoChatMedia, Onvida.Chat.ui.mediaLocal);
                vcToggleVideo(videoEnabled, true);
                vcToggleAudio(audioEnabled, true);

                showElem(Onvida.Chat.ui.mediaLocal, true);
                showElem(Onvida.Chat.ui.mediaRemote, true);
                vcShowPanel('Media');
            }, function (error) {
                Onvida.Log.warn('Twilio.Video.connect - ' + error.name + ': ' + error.message);
                audioEnabled = false;
                videoEnabled = false;
                videoChatAudioDeviceFound = false;
                videoChatVideoDeviceFound = false;
                startVideoChat(chatID, token);
            });
        }

        var vcShowPanel = function (panelName, show) {
            var mediaPanel = Onvida.Chat.ui.panelVideoMedia;
            var holdPanel = Onvida.Chat.ui.panelVideoHold;
            var waitingPanel = Onvida.Chat.ui.panelVideoWaiting;
            show = show !== false;
            switch (panelName) {
                case 'Media':
                    clearStatus();
                    showElem(mediaPanel, show, 'panel');
                    disableElem(Onvida.Chat.ui.btnVideoSelfViewToggle, false);
                    break;
                case 'Hold':
                    if (show) {
                        updateStatus('hold');
                        showElem(mediaPanel, show);
                    }
                    showElem(holdPanel, show);
                    break;
                case 'Waiting':
                    showElem(waitingPanel, show, 'panel');
                    disableElem(Onvida.Chat.ui.btnVideoSelfViewToggle, true);
                    break;
            }
        }

        var vcInitRoomEvents = function () {
        	videoChatRoom.participants.forEach(vcParticipantConnected);
        	videoChatRoom.on('participantConnected', vcParticipantConnected);

            // When a Participant enables a Track (video play/audio unmute)
            videoChatRoom.on('trackEnabled', function (publication, participant) {
				if (publication.isSubscribed)
					vcEnableTrack(publication.track, participant, true);
            });

            // When a Participant disables a Track (video pause/audio mute)
            videoChatRoom.on('trackDisabled', function (publication, participant) {
            	if (publication.isSubscribed)
            		vcEnableTrack(publication.track, participant, false);
            });

            // When a Participant leaves the Room, detach its Tracks.
            videoChatRoom.on('participantDisconnected', function (participant) {
                Onvida.Log.debug('Video Chat Client - participantDisconnected: ' + participant.identity);
                vcDetachParticipantTracks(participant);
            });

            // Once the LocalParticipant leaves the room, detach the Tracks
            // of all Participants, including that of the LocalParticipant.
            videoChatRoom.on('disconnected', function () {
                Onvida.Log.debug('Video Chat Client - disconnected');
                Onvida.Chat.resetVideoChat();
            });
        };

        var vcParticipantConnected = function (participant) {
        	var userIdentity = getUserIdentity(participant);
        	Onvida.Log.debug('Video Chat Client - participantConnected: ' + userIdentity);

        	participant.tracks.forEach(publication => {
        		Onvida.Log.debug('Video Chat Client - existingtrackPublished: ' + userIdentity);
        		vcTrackPublished(publication, participant);
        	});

        	participant.on('trackPublished', publication => {
        		Onvida.Log.debug('Video Chat Client - trackPublished: ' + userIdentity);
        		vcTrackPublished(publication, participant);
        	});

        	participant.on('trackUnpublished', publication => {
        		Onvida.Log.debug('Video Chat Client - trackUnpublished: ' + userIdentity);
        		if (publication.track)
        			vcDetachTracks([publication.track]);
        	});
        }

        var vcTrackPublished = function (publication, participant) {
        	var userIdentity = getUserIdentity(participant);
        	Onvida.Log.debug('Video Chat Client - trackPublished: ' + userIdentity);
        	var agent = Onvida.Utils.getObjectFromArray(participants, userIdentity, 'CallID');

        	if (publication.isSubscribed) {
        		if (Onvida.Chat.ui.uiVideochat.querySelector('#' + userIdentity) != null) {
        			vcAttachTracks([publication.track], Onvida.Chat.ui.uiVideochat.querySelector('#' + userIdentity), participant);
        		} else {
        			Onvida.Chat.ui.mediaRemote.id = userIdentity;
        			vcAttachTracks([publication.track], Onvida.Chat.ui.mediaRemote, participant);
        		}
        	}

        	// When a Participant adds a Track, attach it to the DOM.
        	publication.on('subscribed', track => {
        		Onvida.Log.debug('Video Chat Client - trackSubscribed: ' + participant.identity);
        		if (Onvida.Chat.ui.uiVideochat.querySelector('#' + userIdentity) != null) {
        			vcAttachTracks([track], Onvida.Chat.ui.uiVideochat.querySelector('#' + userIdentity), participant);
        		} else {
        			Onvida.Chat.ui.mediaRemote.id = userIdentity;
        			vcAttachTracks([track], Onvida.Chat.ui.mediaRemote, participant);
        		}
        	});

        	// When a Participant removes a Track, detach it from the DOM.
        	publication.on('unsubscribed', track => {
        		Onvida.Log.debug('Video Chat Client - trackUnsubscribed: ' + userIdentity);
        		vcDetachTracks([track]);
        	});
        }

        var vcToggleSelfView = function (state) {
            if (!togglingSelfView) {
                togglingSelfView = true;
                var newState;
                if (typeof state === 'boolean') {
                    newState = state;
                    if (newState == selfViewEnabled) {
                        togglingSelfView = false;
                        return;
                    }
                } else
                    newState = !selfViewEnabled;

                Onvida.Log.debug('Chat Private - vcToggleSelfView(' + selfViewEnabled + ' => ' + newState + ')');
                var media = (videoChatInProgress) ? Onvida.Chat.ui.mediaLocal : Onvida.Chat.ui.mediaWaiting;
                showElem(media, newState);
                toggleClass(Onvida.Chat.ui.btnVideoSelfViewToggle, 'btn-toggled', newState);
                Onvida.Chat.ui.btnVideoSelfViewToggle.setAttribute('title', newState ? 'Hide Self View' : 'Show Self View');
                Onvida.Chat.ui.btnVideoSelfViewToggle.firstChild.innerHTML = Onvida.Chat.ui.btnVideoSelfViewToggle.getAttribute('title');
                selfViewEnabled = newState;
                togglingSelfView = false;
            }
        }

        var vcToggleAudio = function (state, skipTracks, forced) {
            Onvida.Log.debug('Chat Private - vcToggleAudio(' + audioEnabled + ' => ' + state + ', ' + skipTracks + ')');
            if (!togglingAudio) {
                togglingAudio = true;
                var newState;
                var hasAudioTracks = false;

                function toggleUI(newState) {
                    toggleClass(Onvida.Chat.ui.btnVideoAudioToggle, 'btn-toggled', !newState);
                    Onvida.Chat.ui.btnVideoAudioToggle.setAttribute('title', newState ? 'Mute Microphone' : 'Unmute Microphone');
                    Onvida.Chat.ui.btnVideoAudioToggle.firstChild.innerHTML = Onvida.Chat.ui.btnVideoAudioToggle.getAttribute('title');
                    audioEnabled = newState;
                    if (!videoChatInProgress) {
                        vcUpdateWaitingTracks();
                    }
                    togglingAudio = false;
                }

                if (typeof state === 'boolean') {
                    newState = state;
                    if (newState == audioEnabled && !skipTracks && !forced) {
                        togglingAudio = false;
                        return;
                    }
                } else
                    newState = !audioEnabled;

                if (!skipTracks) {
                    var audioMediaTracks = (videoChatInProgress) ? videoChatMedia.audioTracks : vcGetWaitingTracks();
                    audioMediaTracks.forEach(function (track) {
                    	if (track.hasOwnProperty('track'))
                    		track = track.track;
                    	if (track.kind == 'audio') {
                    		if (newState) {
                    			track.enable();
                    		} else {
                    			track.disable();
                    		}
                    		hasAudioTracks = true;
                    	}
                    });

                    if (!hasAudioTracks && newState) {
                        var audioElem = (videoChatInProgress) ? Onvida.Chat.ui.mediaLocal : Onvida.Chat.ui.mediaWaiting;
                        Twilio.Video.createLocalAudioTrack().then(function (track) {
                            if (videoChatInProgress)
                                videoChatMedia.publishTrack(track);
                            audioElem.appendChild(track.attach());
                            videoChatAudioDeviceFound = true;
                            toggleUI(newState);
                        }, function (error) {
                            Onvida.Log.warn('Twilio.Video.createLocalAudioTrack - ' + error.name + ': ' + error.message);
                            videoChatAudioDeviceFound = audioEnabled = newState = togglingAudio = false;
                        });
                    }
                }

                if (skipTracks || hasAudioTracks || !newState)
                    toggleUI(newState);
            }
        };

        var vcToggleVideo = function (state, skipTracks, forced) {
            Onvida.Log.debug('Chat Private - vcToggleVideo(' + videoEnabled + ' => ' + state + ', ' + skipTracks + ')');
            if (!togglingVideo) {
                togglingVideo = true;
                var newState;
                var hasVideoTracks = false;

                function toggleUI(newState) {
                    toggleClass(Onvida.Chat.ui.btnVideoVideoToggle, 'btn-toggled', !newState);
                    Onvida.Chat.ui.btnVideoVideoToggle.setAttribute('title', newState ? 'Disable Video' : 'Enable Video');
                    Onvida.Chat.ui.btnVideoVideoToggle.firstChild.innerHTML = Onvida.Chat.ui.btnVideoVideoToggle.getAttribute('title');
                    videoEnabled = newState;
                    if (videoChatInProgress) {
                        showElem(Onvida.Chat.ui.mediaLocal, videoEnabled && selfViewEnabled);
                    } else {
                        vcUpdateWaitingTracks();
                    }
                    togglingVideo = false;
                    disableElem(Onvida.Chat.ui.btnVideoSelfViewToggle, !videoChatInProgress || (videoChatInProgress && !videoEnabled));
                }

                if (typeof state === 'boolean') {
                    newState = state;
                    if (newState == videoEnabled && !skipTracks && !forced) {
                        togglingVideo = false;
                        return;
                    }
                } else
                    newState = !videoEnabled;

                if (!skipTracks) {
                    var videoMediaTracks = (videoChatInProgress) ? videoChatMedia.videoTracks : vcGetWaitingTracks();
                    videoMediaTracks.forEach(function (track) {
                    	if (track.hasOwnProperty('track'))
                    		track = track.track;
                    	if (track.kind == 'video') {
                    		if (newState) {
                    			track.enable();
                    		} else {
                    			track.disable();
                    		}
                    		hasVideoTracks = true;
                    	}
                    });

                    if (!hasVideoTracks && newState) {
                        var videoElem = (videoChatInProgress) ? Onvida.Chat.ui.mediaLocal : Onvida.Chat.ui.mediaWaiting;
                        Twilio.Video.createLocalVideoTrack().then(function (track) {
                            if (videoChatInProgress)
                                videoChatMedia.publishTrack(track);
                            videoElem.appendChild(track.attach());
                            videoChatVideoDeviceFound = true;
                            toggleUI(newState);
                        }, function (error) {
                            Onvida.Log.warn('Twilio.Video.createLocalVideoTrack - ' + error.name + ': ' + error.message);
                            videoChatVideoDeviceFound = videoEnabled = newState = togglingVideo = false;
                        });
                    }
                }

                if (skipTracks || hasVideoTracks || !newState)
                    toggleUI(newState);
            }
        };

        var vcToggleChatView = function (state) {
            if (!togglingChat) {
                togglingChat = true;
                var newState;
                if (typeof state === 'boolean') {
                    newState = state;
                } else
                    newState = !chatViewEnabled;
                Onvida.Log.debug('Chat Private - vcToggleChatView(' + chatViewEnabled + ' => ' + newState + ')');
                showElem(Onvida.Chat.ui.uiTextchat, newState);
                toggleClass(Onvida.Chat.ui.btnVideoChatToggle, 'btn-toggled', newState);
                Onvida.Chat.ui.btnVideoChatToggle.setAttribute('title', newState ? 'Hide Text Chat' : 'Show Text Chat');
                Onvida.Chat.ui.btnVideoChatToggle.firstChild.innerHTML = Onvida.Chat.ui.btnVideoChatToggle.getAttribute('title');
                chatViewEnabled = newState;
                if (chatViewEnabled)
                    vcNewChatMessageAlert(false);
                toggleClass(Onvida.Chat.ui.moduleRoot, 'feature-text', chatViewEnabled);
                togglingChat = false;
            }
        };

        vcNewChatMessageAlert = function (enable) {
            toggleClass(Onvida.Chat.ui.btnVideoChatToggle, 'flashing', enable && !chatViewEnabled);
            if (enable && !chatViewEnabled)
                Onvida.Chat.ui.holderVideoButtons.style.opacity = 1;
            else
                Onvida.Chat.ui.holderVideoButtons.removeAttribute('style');
        }

        var vcGetWaitingTracks = function () {
            var videoElem = Onvida.Chat.ui.mediaWaiting.querySelector('video');
            var audioElem = Onvida.Chat.ui.mediaWaiting.querySelector('audio');
            var videoElemTracks = (videoElem == null) ? [] : videoElem.srcObject.getTracks().map(track => track.kind === 'audio'
                ? new Twilio.Video.LocalAudioTrack(track) : new Twilio.Video.LocalVideoTrack(track));
            var audioElemTracks = (audioElem == null) ? [] : audioElem.srcObject.getTracks().map(track => track.kind === 'audio'
                ? new Twilio.Video.LocalAudioTrack(track) : new Twilio.Video.LocalVideoTrack(track));
            return videoElemTracks.concat(audioElemTracks);
        }

        var vcUpdateWaitingTracks = function () {
            var trackWrapper = Onvida.Chat.ui.mediaWaiting;
            toggleClass(trackWrapper, 'paused', !videoEnabled);
            toggleClass(trackWrapper, 'muted', !audioEnabled);
            var title = (hasClass(trackWrapper, 'paused') && hasClass(trackWrapper, 'muted')) ? 'Video/Audio' : (hasClass(trackWrapper, 'paused')) ? 'Video' : (hasClass(trackWrapper, 'muted')) ? 'Audio' : '';
            title += (title == '') ? 'Video/Audio Enabled' : ' Disabled';
            trackWrapper.title = title;
        };

        var vcEnableTrack = function (track, participant, enabled) {
        	var userIdentity = getUserIdentity(participant);
            var trackHolder = Onvida.Chat.ui.uiVideochat.querySelector('#' + userIdentity);
            Onvida.Log.debug('Chat Private - vcEnableTrack(' + track.kind + ', ' + userIdentity + ', ' + enabled + ')');
            if (trackHolder != null) {
                var trackWrapper = trackHolder.closest('.' + Onvida.uiPrefix + '-media');
                if (track.kind == 'video') {
                    toggleClass(trackWrapper, 'paused', !enabled);
                } else if (track.kind == 'audio') {
                    toggleClass(trackWrapper, 'muted', !enabled);
                }
                var title = (hasClass(trackWrapper, 'paused') && hasClass(trackWrapper, 'muted')) ? 'Video/Audio' : (hasClass(trackWrapper, 'paused')) ? 'Video' : (hasClass(trackWrapper, 'muted')) ? 'Audio' : '';
                title += (title == '') ? 'Video/Audio Enabled' : ' Disabled';
                trackWrapper.title = title;
            }
        };

        // Attach the Tracks to the DOM.
        var vcAttachTracks = function (tracks, container, participant) {
        	tracks.forEach(function (track) {
        		container.appendChild(track.attach());
        		if (participant)
        			vcEnableTrack(track, participant, true);
            });
        };

        // Attach the Participant's Tracks to the DOM.
        var vcAttachParticipantTracks = function (participant, container) {
        	var allTracks = [];
        	participant.tracks.forEach(publication => {
        		if (publication.track)
        			allTracks.push(publication.track);
        	});

        	vcAttachTracks(allTracks, container, participant);
        };

        // Detach the Tracks from the DOM.
        var vcDetachTracks = function (publications) {
        	publications.forEach(function (publication) {
            	if (publication.track)
            		publication.track.detach().forEach(function (element) { element.remove(); });
            });
        };

        // Detach the Participant's Tracks from the DOM.
        var vcDetachParticipantTracks = function (participant) {
        	var publications = Array.from(participant.tracks.values());
        	vcDetachTracks(publications);
        };

        var vcDisconnect = function () {
            if (videoChatRoom) {
                videoChatRoom.disconnect();
            }
        };

        var getUserIdentity = function (participant) {
        	var identityParts = participant.identity.split('.');
        	var userIdentity = identityParts[2].replace(':', '-');
        	return userIdentity;
        }

        /* Text Chat Methods */
        var startTextChat = function (chatID, token) {
            Onvida.Log.debug('Chat Private - startTextChat()');
            Onvida.Chat.resetTextChat();
            textChatClient = (Onvida.Chat.config.Settings.ChatService == 'Twilio') ? new Onvida.Lib.TwilioChatClient() : new Onvida.Lib.OnvidaChatClient();
            textChatClient.join(chatID, chatID, token).then(() => {
                textChatInProgress = true;
                tcInitClientEvents();
                messageRetrieving = true;
            	textChatClient.getMessages().then(messages => {
                    for (var i = 0; i < messages.length; i++) {
                        tcMessageHandler(messages[i]);
                    }
                    tcHandleNewMessages(messages);
                    if (messages.length != 0) {
                        tcToggleInactivityTimerByMessage(messages[messages.length - 1]);
                    }
                    tcEnableControls(true);
                }).catch(error => {
                    Onvida.Log.error('OnvidaChat.startTextChat(' + error.code + ') > join > getMessages: ' + error.message, document.currentScript);
                });
            }).catch(error => {
                Onvida.Log.error('OnvidaChat.startTextChat(' + error.code + ') > join: ' + error.message, document.currentScript);
            });
        };

        var tcInitClientEvents = function () {
            if (!textChatClient.eventListening()) {
                textChatClient.eventListening(true);
                textChatClient.addEventListener(enums.Events.CONNECTIONSTATE_CHANGED, function (e) {
                	var connectionState = e.detail;
                    Onvida.Log.debug('Text Chat Client - CONNECTIONSTATE_CHANGED: ' + connectionState);
                    if (Onvida.Chat.isQueued() || Onvida.Chat.isInProgress()) {
                    	var isDisconnected = (connectionState == enums.States.CONNECTING) || (connectionState == enums.States.DISCONNECTED);
                        if (isDisconnected && !chatDisconnected) {
                            startDisconnectTimer();
                            handleUserConnectionChange(Onvida.Chat.config.ChatID, false);
                        } else if (!isDisconnected) {
                            stopDisconnectTimer();
                            handleUserConnectionChange(Onvida.Chat.config.ChatID, true);
                        }
                    }
                });

                textChatClient.addEventListener(enums.Events.USER_UPDATED, function (e) {
                	var user = e.detail;
                    if (user.Identity == Onvida.Chat.config.ChatID) {
                        if (user.Online != userOnline) {
                            userOnline = user.Online;
                            var state = user.Online ? 'connected' : 'disconnected';
                            Onvida.Log.debug('Text Chat Client - USER_UPDATED: ' + state);
                            if (!user.Online || chatDisconnected) {
                                updateStatusWithParticipant(state, user, true);
                            }
                        }
                    }
                });

                textChatClient.addEventListener(enums.Events.ROOM_CLOSED, function (e) {
                	Onvida.Log.debug('Text Chat Client - ROOM_CLOSED');
                    endChat(true);
                });

                textChatClient.addEventListener(enums.Events.USER_JOINED, function (e) {
                	var user = e.detail;
                    Onvida.Log.debug('Text Chat Client - USER_JOINED: ' + user.Identity);
                    if (user.Identity != Onvida.Chat.config.ChatID)
                    	updateStatusWithParticipant('joined', user, true);
                });

                textChatClient.addEventListener(enums.Events.USER_LEFT, function (e) {
                	var user = e.detail;
                    Onvida.Log.debug('Text Chat Client - USER_LEFT: ' + user.Identity);
                    if (user.Identity != Onvida.Chat.config.ChatID)
                        updateStatusWithParticipant('left', user, true);
                });

                textChatClient.addEventListener(enums.Events.MESSAGE_ADDED, function (e) {
                	var message = e.detail;
                    Onvida.Log.debug('Text Chat Client - MESSAGE_ADDED: ' + message.Text);
                    tcMessageHandler(message, true);
                });

                textChatClient.addEventListener(enums.Events.TYPING_STARTED, function (e) {
                	var user = e.detail;
                    updateStatusWithParticipant('typing', user);
                    if (currPanel == 'Inactivity') {
                        continueChat('inactivity');
                    }
                    if (inactivityTimerEnabled) {
                        stopInactivityTimer(true);
                    }
                });

                textChatClient.addEventListener(enums.Events.TYPING_ENDED, function (e) {
                	var user = e.detail;
                    clearStatus();
                    if (inactivityTimerEnabled) {
                        startInactivityTimer();
                    }
                });

                textChatClient.addEventListener(enums.Events.TOKEN_EXPIRED, function (e) {
                    Onvida.Log.debug('Text Chat Client - TOKEN_EXPIRED');
                    getClientAccessToken(function (response) {
                        textChatClient.updateToken(response.Token);
                    });
                });
            }
        };

        var handleUserConnectionChange = function (identity, connected) {
            Onvida.sendRequest('Chat/UserConnectionChange', {
                chatID: Onvida.Chat.config.ChatID,
                chatUserID: identity,
                connected: connected,
                source: 'Customer'
            });
        };

        var tcEnableControls = function (enable) {
            Onvida.Chat.ui.btnTextSendMessage.removeEventListener('click', eBtnTextSendMessageClickHandler);
            Onvida.Chat.ui.inputTextMessage.removeEventListener('keypress', eInputTextMessageKeypressHandler);
            Onvida.Chat.ui.holderEmojis.removeEventListener('click', eEmojiClickHandler);
            Onvida.Chat.ui.btnTextSendMessage.disabled = (enable !== false) ? '' : 'disabled';
            if (enable !== false) {
                Onvida.Chat.ui.btnTextSendMessage.addEventListener('click', eBtnTextSendMessageClickHandler);
                Onvida.Chat.ui.inputTextMessage.addEventListener('keypress', eInputTextMessageKeypressHandler);
                Onvida.Chat.ui.holderEmojis.addEventListener('click', eEmojiClickHandler);
                Onvida.Chat.ui.btnTextSendMessage.disabled = '';
                tcShowControls(true);
                tcScrollToBottom();
            }
        };

        var tcShowControls = function (show) {
            showElem(Onvida.Chat.ui.holderTextControls, show);
            showEmojis(show && Onvida.Chat.emojisEnabled());
        }

        var tcSendMessage = function (type, msg) {
            if (typeof type !== 'string' || type == null) {
                msg = Onvida.Chat.ui.inputTextMessage.value;
                Onvida.Chat.ui.inputTextMessage.value = '';
                Onvida.Chat.ui.inputTextMessage.resize();
                type = 'Text';
            }
            msg = Onvida.Utils.stripHTML(msg.toString()).trim();
            if (msg != '') {
                textChatClient.sendMessage(type, msg);
            }
        };

        var tcScrollToBottom = function () {
            Onvida.Chat.ui.holderTextMessages.scrollTop = Onvida.Chat.ui.holderTextMessages.scrollHeight;
        };

        var tcHandleNewMessages = function (oldMessages) {
        	Onvida.Log.debug('Chat Private - tcHandleNewMessages(' + (messageQueueNew != null ? messageQueueNew.length : 0) + ')');
        	messageRetrieving = false;
        	if (messageQueueNew != null) {
        		for (var i = 0; i < messageQueueNew.length; i++) {
        			var newMsg = messageQueueNew[i];
        			var found = false;
        			if (Array.isArray(oldMessages)) {
        				var j = 0;
        				while (j < oldMessages.length && !found) {
        					var oldMsg = oldMessages[j];
        					if (newMsg.TimeStamp == oldMsg.TimeStamp && newMsg.Identity == oldMsg.Identity && newMsg.Type == oldMsg.Type && newMsg.Text == oldMsg.Text)
        						found = true;
        					j++;
        				}
        			}
        			if (!found)
        				tcMessageHandler(newMsg, true);
        		}
        		messageQueueNew = null;
        	}
        }

        var tcMessageHandler = function (message, isNew) {
        	if (isNew && messageRetrieving) {
        		if (messageQueueNew == null)
        			messageQueueNew = new Array();
        		messageQueueNew.push(message);
        	} else {
        		switch (message.Type) {
        			case 'Disclaimer':
        			case 'Text':
        				if (isNew) {
        					playChatSound((message.Identity == Onvida.Chat.config.ChatID) ? 'send' : 'receive');
        					tcToggleInactivityTimerByMessage(message);
        					if (message.Identity != Onvida.Chat.config.ChatID && message.Identity.indexOf('OnvidaSystem') == -1)
        						vcNewChatMessageAlert(true);
        				}
        				tcCreateMessageElement(message);
        				if (Onvida.Chat.isQueued() || Onvida.Chat.isInProgress())
        					showPanel('Chat');
        				break;
        			case 'Closing':
        				if (message.Text == 'inactivity') {
        					if (isNew)
        						showPanel('Inactivity');
        				}
        				break;
        			case 'End':
        				switch (message.Text) {
        					case 'inactivity':
        						tcCreateSystemMessage(message, message.Type, 'Inactivity Timeout');
        						break;
        					case 'disconnect':
        						tcCreateSystemMessage(message, message.Type, 'Customer Network Disconnect');
        						break;
        					case 'agentdisconnect':
        						var agdMessage = Onvida.Chat.config.Settings.AgentDisconnectMessage == null ? 'Agent Network Disconnect' : Onvida.Chat.config.Settings.AgentDisconnectMessage;
        						tcCreateSystemMessage(message, message.Type, agdMessage);
        						break;
        					case 'agent':
        						tcCreateSystemMessage(message, message.Type, 'Chat Ended by Agent');
        						break;
        					case 'user':
        						tcCreateSystemMessage(message, message.Type, 'Chat Ended by Customer');
        						break;
        				}
        				break;
        			case 'Hold':
        				if (isNew)
        					vcShowPanel('Hold');
        				break;
        			case 'Resume':
        				if (isNew)
        					vcShowPanel('Media');
        				break;
        			case 'Continue':
        				break;
        			case 'Error':
        				if (isNew)
        					updateStatus('error', { error: message.Text });;
        				break;
        		}
        	}
        }

        var tcToggleInactivityTimerByMessage = function (message) {
            var systemCreated = message.Identity.indexOf('OnvidaSystem') != -1;
            if (!Onvida.Chat.videoChatEnabled() && !systemCreated) {
                if (message.Identity != Onvida.Chat.config.ChatID) {
                    startInactivityTimer();
                } else {
                    stopInactivityTimer();
                }
            }
        }

        var tcCreateSystemMessage = function (message, newType, newText) {
            var newMessage = {
                FriendlyName: 'System',
                Identity: 'OnvidaSystem',
                Type: newType,
                Text: newText,
                TimeStamp: message.TimeStamp
            };
            tcCreateMessageElement(newMessage);
        }

        var tcCreateMessageElement = function (message, skipQueue) {
            if (messageRendering && skipQueue !== true) {
                messageQueue.push(message);
            } else {
                messageRendering = true;
                if (message.hasOwnProperty('FriendlyName') && message.FriendlyName != null) {
                	tcAppendToDisplay(message, message.FriendlyName);
                } else {
                    textChatClient.getUser(message.Identity).then(user => {
                        tcAppendToDisplay(message, user.FriendlyName);
                    }).catch(function (error) {
                        Onvida.Log.error('OnvidaChat.tcCreateMessageElement(' + error.code + '): ' + error.message, document.currentScript);
                        tcAppendToDisplay(message, null);
                    });
                }
            }
        }

        var tcAppendToDisplay = function (message, friendlyName) {
            var template = '\
            <div class="onv-holder onv-holder-message onv-message-[[authorType]] onv-message-type-[[messageType]]">\
                <div class="onv-holder onv-holder-message-meta">\
                    <div class="onv-txt onv-txt-message-author">[[author]]</div>\
                    <div class="onv-txt onv-txt-message-date">[[date]]</div>\
                    <div class="onv-txt onv-txt-message-time">[[time]]</div>\
                </div>\
                <div class="onv-holder onv-holder-message-text">\
                    <div class="onv-txt onv-txt-message-text">[[message]]</div>\
                </div>\
            </div>\
        ';
            var userCreated = message.Identity == Onvida.Chat.config.ChatID;
            var systemCreated = message.Identity.indexOf('OnvidaSystem') != -1;
            var authorType = (userCreated) ? 'outbound' : (systemCreated) ? 'system' : 'inbound';
            var authorName = (userCreated) ? 'You' : (systemCreated) ? 'System' : (friendlyName == null || friendlyName == 'User') ? 'Agent' : Onvida.Utils.getFirstNameLastInitial(friendlyName);
            var messageType = message.Type.toLowerCase();
            var messageText = Onvida.Utils.linkify(message.Text);

            if (!userCreated && !systemCreated) {
            	agentName = authorName;
            }

            var messageHTML = replaceTags(template, {
                messageType: messageType,
                authorType: authorType,
                author: authorName,
                date: Onvida.Utils.formatDate(message.TimeStamp),
                time: Onvida.Utils.formatTime(message.TimeStamp),
                message: messageText
            });

            Onvida.Chat.ui.holderTextMessages.insertAdjacentHTML('beforeend', messageHTML);
            if (messageQueue.length == 0 && Array.isArray(messageQueueNew)) {
            	messageQueue = messageQueue.concat(messageQueueNew);
            }
            if (messageQueue.length == 0) {
                tcScrollToBottom();
                messageRendering = false;
            } else {
                var nextMessage = messageQueue.shift();
                tcCreateMessageElement(nextMessage, true);
            }
        }

        var tcDisconnect = function () {
			if (textChatClient != null)
	            textChatClient.dispose();
        };

        /* Text Chat Transcript Methods */
        var tcToggleEndPanel = function (state) {
            var newState;
            if (typeof state === 'boolean') {
                newState = state;
                if (newState == endPanelHidden) {
                    return;
                }
            } else
                newState = !endPanelHidden;
            endPanelHidden = newState;
            if (!newState && !chatViewEnabled)
                vcToggleChatView(true);
            toggleClass(Onvida.Chat.ui.btnTextTranscriptView, 'btn-toggled', endPanelHidden);
            Onvida.Chat.ui.btnTextTranscriptView.setAttribute('title', endPanelHidden ? 'Hide Transcript' : 'View Transcript');
            Onvida.Chat.ui.btnTextTranscriptView.firstChild.innerHTML = Onvida.Chat.ui.btnTextTranscriptView.getAttribute('title');
            showPanel((endPanelHidden) ? 'Chat' : endPanel);
            if (endPanelHidden)
                tcScrollToBottom();
        }

        var tcGetTranscript = function (returnHTML) {
            var transcript = '';
            var chatMessages = Onvida.Chat.ui.holderTextMessages.querySelectorAll('.' + Onvida.uiPrefix + '-holder-message');
            for (var i = 0; i < chatMessages.length; i++) {
                var c = chatMessages[i];
                var author = c.querySelector('.' + Onvida.uiPrefix + '-txt-message-author').innerText;
                var date = c.querySelector('.' + Onvida.uiPrefix + '-txt-message-date').innerText;
                var time = c.querySelector('.' + Onvida.uiPrefix + '-txt-message-time').innerText;
                var message = c.querySelector('.' + Onvida.uiPrefix + '-txt-message-text').innerText;
                transcript += (returnHTML) ? '<p>' : '';
                transcript += '[' + author + ' (' + date + ' @ ' + time + ')]:\t' + message;
                transcript += (returnHTML) ? '</p>' : '\r\n\r\n';
            }
            return transcript;
        }

        var tcEmailTranscript = function () {
            Onvida.Log.debug('Chat Private - tcEmailTranscript()');
            Onvida.Utils.email('Chat Transcript', tcGetTranscript());
        };

        var tcDownloadTranscript = function () {
            Onvida.Log.debug('Chat Private - tcDownloadTranscript()');
            Onvida.Utils.download(Onvida.Utils.getDownloadFileName('ChatTranscript', 'txt'), null, tcGetTranscript());
        };

        var tcCopyTranscript = function () {
            Onvida.Log.debug('Chat Private - tcCopyTranscript()');
            if (Onvida.Utils.copy(tcGetTranscript()))
                toggleClass(Onvida.Chat.ui.btnTextTranscriptCopy, 'btn-toggled', true);
        };

        var tcPrintTranscript = function () {
            Onvida.Log.debug('Chat Private - tcPrintTranscript()');
            Onvida.Utils.print(tcGetTranscript(true));
        };

        var showEmojis = function (show) {
            if (show) {
                if (Onvida.Chat.ui.holderEmojis.children.length == 0) {
                    var emojiRange = [
                        [
                            [128515, 'Satisfied'],
                            [128578, 'Somewhat Satisfied'],
                            [128528, 'Meh'],
                            [128577, 'Somewhat Dissatisfied'],
                            [128544, 'Dissatisfied'],
                            [128077, 'Thumbs Up'],
                            [128078, 'Thumbs Down'],
                            [128074, 'Fist Bump'],
                            [11088, 'Star']
                        ]
                        //,[127744, 128761] // Full Range
                    ];
                    var output = '';
                    for (var i = 0; i < emojiRange.length; i++) {
                        if (emojiRange[i].length == 2) {
                            for (var j = emojiRange[i][0]; j <= emojiRange[i][1]; j++) {
                                output += '<a>&#' + j + ';</a>';
                            }
                        } else {
                            for (var j = 0; j < emojiRange[i].length; j++) {
                                var emoji = emojiRange[i][j];
                                var unicode = Array.isArray(emoji) ? emoji[0] : emoji;
                                var title = Array.isArray(emoji) ? emoji[1] : null;
                                output += '<a' + (title == null ? '' : (' title="' + title + '"')) + '>&#' + unicode + ';</a>';
                            }
                        }
                    }
                    Onvida.Chat.ui.holderEmojis.innerHTML = output;
                }
                Onvida.Chat.ui.holderEmojis.addEventListener('click', eEmojiClickHandler);
            } else {
                Onvida.Chat.ui.holderEmojis.removeEventListener('click', eEmojiClickHandler);
            }
            showElem(Onvida.Chat.ui.holderEmojis, show);
        }

        /* DOM & CSS Utilities */
        var showElem = function (elem, show, hideSiblingsClass) {
            var elem = toggleClass(elem, 'hidden', !show);
            if (elem && elem.parentElement && (typeof hideSiblingsClass === 'string')) {
                var siblings = elem.parentElement.children;
                for (var i = 0; i < siblings.length; i++) {
                    if (siblings[i].classList.contains(Onvida.uiPrefix + '-' + hideSiblingsClass) && siblings[i] != elem)
                        showElem(siblings[i], false);
                }
            }
            return elem;
        }

        var toggleClass = function (elem, className, apply) {
            elem = getDOMElem(elem);
            if (elem) {
                className = Onvida.uiPrefix + '-' + className;
                var applied = elem.classList.contains(className);
                if (typeof apply === 'boolean') {
                    if (apply == applied)
                        return elem;
                    applied = apply;
                } else
                    applied = !applied;
                if (applied) {
                    elem.classList.add(className);
                } else {
                    elem.classList.remove(className);
                }
            }
            return elem;
        }

        var disableElem = function (elem, disable) {
            elem = getDOMElem(elem);
            if (elem) {
                toggleClass(elem, 'disabled', disable);
                if (disable === false)
                    elem.removeAttribute('disabled');
                else
                    elem.setAttribute('disabled', 'disabled');
            }
            return elem;
        }

        var toggleRetainedStyles = function (elem, revertToDefault, clearStyles) {
            const customPositionedClass = Onvida.uiPrefix + '-placed';
            if (clearStyles) {
                elem.removeAttribute('style');
                if (elem.hasOwnProperty('origStyle'))
                    delete elem.origStyle;
                if (elem.hasOwnProperty('retainedStyle'))
                    delete elem.retainedStyle;
            }
            if (typeof revertToDefault == 'undefined') {
                revertToDefault = elem.getAttribute('style') != null && (!elem.hasOwnProperty('origStyle') || elem.origStyle != elem.getAttribute('style'));
            }
            if (revertToDefault) {
                if (!clearStyles) {
                    elem.retainedStyle = elem.getAttribute('style');
                    if (elem.hasOwnProperty('origStyle'))
                        elem.setAttribute('style', elem.origStyle);
                    else
                        elem.removeAttribute('style');
                }
                if (elem == Onvida.Chat.ui.moduleRoot)
                    elem.classList.remove(customPositionedClass);
            } else {
                if (elem.hasOwnProperty('retainedStyle'))
                    elem.setAttribute('style', elem.retainedStyle);
                if (elem == Onvida.Chat.ui.moduleRoot)
                    elem.classList.add(customPositionedClass);
            }
        }

        var hasClass = function (elem, className) {
            elem = getDOMElem(elem);
            return elem.classList.contains(Onvida.uiPrefix + '-' + className);
        }

        var getDOMElem = function (elem) {
            if (typeof elem === 'string') {
                elem = (Onvida.Chat.ui.hasOwnProperty(elem)) ? Onvida.Chat.ui[elem] : Onvida.Chat.ui.moduleRoot.querySelector('.' + Onvida.uiPrefix + '-' + elem);
            }
            return elem;
        }

        var showPanel = function (panelName, params) {
            Onvida.Log.debug('Chat Private - showPanel(' + panelName + ')');
            statusEnabled = true;
            lastPanel = currPanel;
            switch (panelName) {
                case 'Identify':
                    showElem(Onvida.Chat.ui.holderStatus, false);
                    break;
                case 'ChatType':
                    chatType = null;
                    break;
                case 'Chat':
                    stopInactivityCountdown();
                    endPanelHidden = true;
                    break;
                case 'Inactivity':
                    updateStatus('inactivity', params);
                    startInactivityCountdown();
                    statusEnabled = false;
                    Onvida.Chat.collapse(false);
                    break;
                case 'InactivityComplete':
                    if (endPanel == null)
                        updateStatus('inactivity-complete', params);
                    statusEnabled = false;
                    endPanelHidden = false;
                    endPanel = panelName;
                    Onvida.Chat.collapse(false);
                    break;
                case 'CloseConfirm':
                    updateStatus('close-confirm', params);
                    systemMessage('Closing', 'close');
                    statusEnabled = false;
                    Onvida.Chat.collapse(false);
                    break;
                case 'CloseComplete':
                    if (endPanel == null)
                        updateStatus('close-complete', params);
                    statusEnabled = false;
                    endPanelHidden = false;
                    endPanel = panelName;
                    Onvida.Chat.collapse(false);
                    break;
                case 'Unsupported':
                    var isIOS = Onvida.Utils.isIOS();
                    showElem(Onvida.Chat.ui.holderUnsupportedIos, isIOS);
                    showElem(Onvida.Chat.ui.holderUnsupportedGeneral, !isIOS);
                    break;
            }
            currPanel = panelName;
            return showElem('panel' + panelName, true, 'panel');
        }

        var hidePanels = function () {
            currPanel = null;
            return showElem('panelChat', false, 'panel');
        }

        var replaceTags = function (elem, params, evalJS) {
            if (elem) {
                var newHTML;
                var isDOMElem = typeof elem !== 'string';
                if (isDOMElem) {
                    if (typeof elem.template == 'undefined' || !elem.hasOwnProperty('template')) {
                        elem.template = (typeof elem.innerHTML == 'undefined') ? '' : elem.innerHTML;
                    }
                    newHTML = elem.template;
                } else newHTML = elem;
                if (typeof params != 'undefined' && params != null) {
                    if (typeof params === 'string' && params != '') {
                        newHTML = params;
                    } else {
                        for (var key in params) {
                            var tag = '[[' + key + ']]';
                            newHTML = newHTML.replace(tag, params[key]);
                        }
                    }
                }

                if (evalJS) {
                    var startFrom = 0;
                    var endAt = 0;
                    var jsTag;
                    var jsValue;
                    while (newHTML.indexOf('[[', startFrom) != -1) {
                        startFrom = newHTML.indexOf('[[');
                        endAt = newHTML.indexOf(']]', startFrom);
                        if (endAt != -1) {
                            jsTag = newHTML.substring(startFrom + 2, endAt);
                            jsValue = eval(jsTag.trim()).toString();
                            newHTML = newHTML.replace('[[' + jsTag + ']]', jsValue);
                        } else {
                            startFrom += 2;
                        }
                    }
                }

                if (isDOMElem)
                    elem.innerHTML = newHTML;
                else
                    elem = newHTML;
            }
            return elem;
        }

        var attachEventHandlers = function (ui) {
            Onvida.Log.debug('Chat Private - attachEventHandlers()');
            for (var i in ui) {
                try {
                    if (typeof eval(ui[i].handler) === 'function') {
                        Onvida.Log.debug(ui[i].handler + ' - Attached');
                        ui[i].addEventListener('click', eval(ui[i].handler));
                    }
                } catch (e) { }
            }
        }

        var checkOrientationChange = function (element, width, height, left, top) {
            if (typeof width === 'undefined') {
                width = parseFloat(getComputedStyle(element, null).getPropertyValue('width').replace('px', ''));
                height = parseFloat(getComputedStyle(element, null).getPropertyValue('width').replace('px', ''));
            }
            toggleClass(element, 'orientation-landscape', (width / height > .85));
        }

        /* Module Positioning Utilities */
        var initResize = function (element, resizeCallback) {
            const resizeResetter = element.querySelector('.' + Onvida.uiPrefix + '-section-module-header');
            const resizers = element.querySelectorAll('.' + Onvida.uiPrefix + '-resizer');
            let elementStyles = getComputedStyle(element, null);
            let width0 = 0;
            let height0 = 0;
            let x0 = 0;
            let y0 = 0;
            let mouseX0 = 0;
            let mouseY0 = 0;
            let origX = null;
            let origY = null;
            let origWidth = null;
            let origHeight = null;
            let maxWidth = parseFloat(elementStyles.getPropertyValue('max-width').replace('px', ''));
            let maxHeight = parseFloat(elementStyles.getPropertyValue('max-height').replace('px', ''));
            let minWidth = parseFloat(elementStyles.getPropertyValue('min-width').replace('px', ''));
            let minHeight = parseFloat(elementStyles.getPropertyValue('min-height').replace('px', ''));
            maxWidth = (isNaN(maxWidth)) ? null : maxWidth;
            maxHeight = (isNaN(maxHeight)) ? null : maxHeight;
            minWidth = (isNaN(minWidth)) ? 30 : minWidth;
            minHeight = (isNaN(minHeight)) ? 30 : minHeight;

            resizeResetter.addEventListener('dblclick', function () {
                toggleRetainedStyles(element);
            });

            for (let i = 0; i < resizers.length; i++) {
                const currentResizer = resizers[i];
                currentResizer.addEventListener(Onvida.Utils.eventDown(), function (e) {
                    if (moduleResizable && !chatCollapsed) {
                        e.preventDefault();
                        width0 = parseFloat(getComputedStyle(element, null).getPropertyValue('width').replace('px', ''));
                        height0 = parseFloat(getComputedStyle(element, null).getPropertyValue('height').replace('px', ''));
                        x0 = element.getBoundingClientRect().left;
                        y0 = element.getBoundingClientRect().top;
                        mouseX0 = e.pageX;
                        mouseY0 = e.pageY;
                        origWidth = (origWidth == null) ? width0 : origWidth;
                        origHeight = (origHeight == null) ? height0 : origHeight;
                        origX = (origX == null) ? x0 : origX;
                        origY = (origY == null) ? y0 : origY;
                        window.addEventListener(Onvida.Utils.eventMove(), resize)
                        window.addEventListener(Onvida.Utils.eventUp(), stopResize)
                    }
                });

                function resize(e) {
                    let newWidth = 0;
                    let newHeight = 0;
                    let newTop = null;
                    let newLeft = null;
                    let viewPortWidth = (document.body.clientWidth || document.documentElement.clientWidth);
                    let viewPortHeight = (document.body.clientHeight || document.documentElement.clientHeight);
                    let localMaxWidth = (maxWidth == null || maxWidth > viewPortWidth) ? viewPortWidth : maxWidth;
                    let localMaxHeight = (maxHeight == null || maxHeight > viewPortHeight) ? viewPortHeight : maxHeight;

                    if (currentResizer.classList.contains(Onvida.uiPrefix + '-bottom-right')) {
                        newWidth = width0 + (e.pageX - mouseX0);
                        newHeight = height0 + (e.pageY - mouseY0);
                    }
                    else if (currentResizer.classList.contains(Onvida.uiPrefix + '-bottom-left')) {
                        newWidth = width0 - (e.pageX - mouseX0);
                        newHeight = height0 + (e.pageY - mouseY0);
                        newLeft = x0 + (e.pageX - mouseX0);
                    }
                    else if (currentResizer.classList.contains(Onvida.uiPrefix + '-top-right')) {
                        newWidth = width0 + (e.pageX - mouseX0);
                        newHeight = height0 - (e.pageY - mouseY0);
                        newTop = y0 + (e.pageY - mouseY0);
                    }
                    else {
                        newWidth = width0 - (e.pageX - mouseX0);
                        newHeight = height0 - (e.pageY - mouseY0);
                        newTop = y0 + (e.pageY - mouseY0);
                        newLeft = x0 + (e.pageX - mouseX0);
                    }

                    newWidth = (newWidth > localMaxWidth) ? localMaxWidth : (newWidth < minWidth) ? minWidth : newWidth;
                    newHeight = (newHeight > localMaxHeight) ? localMaxHeight : (newHeight < minHeight) ? minHeight : newHeight;
                    newLeft = (newLeft == null) ? null : (newLeft > (viewPortWidth - newWidth)) ? (viewPortWidth - newWidth) : (newLeft < 0) ? 0 : newLeft;
                    newTop = (newTop == null) ? null : (newTop > (viewPortHeight - newHeight)) ? (viewPortHeight - newHeight) : (newTop < 0) ? 0 : newTop;

                    element.style.width = newWidth + 'px';
                    element.style.height = newHeight + 'px';
                    if (newLeft != null) {
                        element.style.left = newLeft + 'px';
                        element.style.right = 'auto';
                    }
                    if (newTop != null) {
                        element.style.top = newTop + 'px';
                        element.style.bottom = 'auto';
                    }

                    if (typeof resizeCallback === 'function')
                        resizeCallback(element, newWidth, newHeight, newLeft, newTop);
                }

                function stopResize() {
                    window.removeEventListener(Onvida.Utils.eventMove(), resize);
                }
            }
        }

        var initDrag = function (element) {
            const dragger = element.querySelector('.' + Onvida.uiPrefix + '-section-module-header');
            const draggableClass = Onvida.uiPrefix + '-draggable';
            const draggingClass = Onvida.uiPrefix + '-dragging';
            const customPositionedClass = Onvida.uiPrefix + '-placed';
            let width0 = 0;
            let height0 = 0;
            let mouseX0 = 0;
            let mouseY0 = 0;
            let origX = null;
            let origY = null;
            let viewPortWidth = (document.body.clientWidth || document.documentElement.clientWidth);
            let viewPortHeight = (document.body.clientHeight || document.documentElement.clientHeight);

            dragger.classList.add(draggableClass);

            dragger.addEventListener(Onvida.Utils.eventDown(), function (e) {
                if (moduleDraggable && !chatCollapsed && !e.target.classList.contains(Onvida.uiPrefix + '-btn')) {
                    e.preventDefault();
                    dragger.classList.add(draggingClass);
                    element.classList.add(customPositionedClass);
                    viewPortWidth = (document.body.clientWidth || document.documentElement.clientWidth);
                    viewPortHeight = (document.body.clientHeight || document.documentElement.clientHeight);
                    width0 = parseFloat(getComputedStyle(element, null).getPropertyValue('width').replace('px', ''));
                    height0 = parseFloat(getComputedStyle(element, null).getPropertyValue('height').replace('px', ''));
                    x0 = element.getBoundingClientRect().left;
                    y0 = element.getBoundingClientRect().top;
                    mouseX0 = e.pageX;
                    mouseY0 = e.pageY;
                    origX = (origX == null) ? x0 : origX;
                    origY = (origY == null) ? y0 : origY;
                    window.addEventListener(Onvida.Utils.eventMove(), drag);
                    window.addEventListener(Onvida.Utils.eventUp(), stopDrag);
                }
            });

            window.addEventListener('resize', function (e) {
                toggleRetainedStyles(element, true);
            });

            function drag(e) {
                let newTop = null;
                let newLeft = null;

                newTop = y0 + (e.pageY - mouseY0);
                newLeft = x0 + (e.pageX - mouseX0);

                newLeft = (newLeft > (viewPortWidth - width0)) ? (viewPortWidth - width0) : (newLeft < 0) ? 0 : newLeft;
                newTop = (newTop > (viewPortHeight - height0)) ? (viewPortHeight - height0) : (newTop < 0) ? 0 : newTop;

                element.style.bottom = 'auto';
                element.style.right = 'auto';
                element.style.left = newLeft + 'px';
                element.style.top = newTop + 'px';
            }

            function stopDrag() {
                window.removeEventListener(Onvida.Utils.eventMove(), drag);
                dragger.classList.remove(draggingClass);
            }
        }

        var initTextareaAutoSize = function (textarea, messageHolder) {
            textarea.origHeight = parseFloat(textarea.scrollHeight);
            textarea.startHeight = 30;

            textarea.resize = function (e) {
                let currHeight = parseInt(this.style.height);
                this.style.height = 'inherit';
                let scrollHeight = parseFloat(this.scrollHeight);
                let newHeight = (scrollHeight > this.origHeight) ? scrollHeight : this.origHeight;
                let maxHeight = Onvida.Chat.ui.moduleRoot.clientHeight * 0.5;
                if (newHeight > maxHeight) {
                    newHeight = maxHeight;
                    this.style.overflow = 'auto';
                } else {
                    this.style.overflow = 'hidden';
                    if (this.startHeight > newHeight) {
                        newHeight = this.startHeight;
                    }
                }
                this.style.height = newHeight + 'px';
                messageHolder.scrollTop = messageHolder.scrollHeight;
            }

            textarea.addEventListener('input', textarea.resize);
            textarea.addEventListener('cut', textarea.resize);
            textarea.addEventListener('paste', textarea.resize);
        }

        var initWindowUnload = function (url, dataGetter) {
            function confirmLeave(e) {
                if (Onvida.Chat.isQueued() || Onvida.Chat.isInProgress()) {
                    var message = "You have a current chat in progress.\nIf you leave this page, your chat will end.\nClick OK to leave. Click Cancel to continue your chat session.";
                    e.preventDefault();
                    e.returnValue = message;
                    return message;
                }
                return;
            }

            function cleanup(e) {
                data = dataGetter();
                if (data != null && data != {}) {
                    if (navigator && ('sendBeacon' in navigator) && (navigator.sendBeacon === 'function')) {
                        url = Onvida.Utils.getServiceURL(url);
                        navigator.sendBeacon(url, data);
                    } else {
                        Onvida.sendRequest(url, data, null, null, true);
                    }
                }
            }

            var event = (Onvida.Utils.isIOS()) ? 'pagehide' : 'unload';

            window.addEventListener('beforeunload', confirmLeave, false);
            window.addEventListener(event, cleanup, false);
        }

        var toggleTranscriptControls = function () {
            if (Onvida.Utils.isIOS()) {
                var iosVersion = Onvida.Utils.getIOSVersion();
                showElem('btnTextTranscriptDownload', iosVersion[0] >= 13);
            }
        }

        /*Event Handlers */
        // UI Module Buttons
        var eBtnUiCloseClickHandler = function (e) {
            if ((chatInQueue || chatAnswered || currPanel == 'Identify') && !chatEnding)
                if (currPanel != 'CloseConfirm')
                    showPanel('CloseConfirm');
                else endChat();
            else
                Onvida.close('Chat');
        };

        var eBtnUiMinmaxToggleClickHandler = function (e) {
            Onvida.Chat.collapse(!hasClass(e.target, 'btn-toggled'));
        };

        var eBtnUiPopToggleClickHandler = function (e) {
            Onvida.Chat.pop(!hasClass(e.target, 'btn-toggled'));
        };

        var eBtnUiSoundsToggleClickHandler = function (e) {
            Onvida.Chat.mute(!hasClass(e.target, 'btn-toggled'));
        };

        // Video Buttons
        var eBtnVideoVideoToggleClickHandler = function (e) {
            vcToggleVideo();
        };

        var eBtnVideoAudioToggleClickHandler = function (e) {
            vcToggleAudio();
        };

        var eBtnVideoSelfViewToggleClickHandler = function (e) {
            vcToggleSelfView();
        };

        var eBtnVideoChatToggleClickHandler = function (e) {
            vcToggleChatView();
        };

        var eBtnVideoHangupClickHandler = function (e) {
            if ((chatInQueue || chatAnswered || currPanel == 'Identify') && !chatEnding)
                if (currPanel != 'CloseConfirm')
                    showPanel('CloseConfirm');
                else endChat();
            else
                Onvida.close('Chat');
        };

        // Text Buttons
        var eBtnTextSendMessageClickHandler = function (e) {
            tcSendMessage();
        };

        // Transcript Buttons
        var eBtnTextTranscriptViewClickHandler = function (e) {
            tcToggleEndPanel();
        };

        var eBtnTextTranscriptEmailClickHandler = function (e) {
            tcEmailTranscript();
        };

        var eBtnTextTranscriptDownloadClickHandler = function (e) {
            tcDownloadTranscript();
        };

        var eBtnTextTranscriptCopyClickHandler = function (e) {
            tcCopyTranscript();
        };

        var eBtnTextTranscriptPrintClickHandler = function (e) {
            tcPrintTranscript();
        };

        // Panel/User Flow Buttons
        var eBtnIdentifyStartClickHandler = function (e) {
            if (validRegForm()) {
                startChat(Onvida.user);
            }
            return false;
        };

        var eBtnInactivityContinueClickHandler = function (e) {
            continueChat('inactivity');
        };

        var eBtnInactivityCompleteResumeClickHandler = function (e) {
            startChat(Onvida.user, true);
        };

        var eBtnInactivityCompleteCloseClickHandler = function (e) {
            Onvida.close('Chat');
        };

        var eBtnCloseConfirmClickHandler = function (e) {
            if (lastPanel == 'Identify')
                Onvida.close('Chat');
            else endChat();
        };

        var eBtnCloseCancelClickHandler = function (e) {
            continueChat('close');
        };

        var eBtnCloseCompleteResumeClickHandler = function (e) {
            startChat(Onvida.user, true);
        };

        var eBtnCloseCompleteCloseClickHandler = function (e) {
            Onvida.close('Chat');
        };

        var eBtnUnavailableCloseClickHandler = function (e) {
            Onvida.close('Chat');
        };

        var eBtnUnsupportedSafariClickHandler = function (e) {
            window.open('https://support.apple.com/en-us/HT204204');
        };

        var eBtnUnsupportedChromeClickHandler = function (e) {
            window.open('https://www.google.com/chrome/');
        };

        var eBtnUnsupportedFirefoxClickHandler = function (e) {
            window.open('https://www.mozilla.org/firefox/');
        };

        var eBtnUnsupportedEdgeClickHandler = function (e) {
            window.open('https://www.microsoft.com/windows/microsoft-edge');
        };

        var eBtnChatTypeVideoClickHandler = function (e) {
            setChatType('Video', true);
        };

        var eBtnChatTypeAudioClickHandler = function (e) {
            setChatType('Audio', true);
        };

        var eBtnChatTypeTextClickHandler = function (e) {
            setChatType('Text', true);
        };

        var eInputTextMessageKeypressHandler = function (e) {
            if (textChatClient.ready()) {
                window.clearTimeout(typingTimer);
                if (typeof e != 'undefined' && e.keyCode == 13) {
                    e.preventDefault();
                    eBtnTextSendMessageClickHandler();
                } else {
                    textChatClient.typing();
                    if (inactivityTimerEnabled) {
                        stopInactivityTimer(true);
                        typingTimer = window.setTimeout(function () {
                            startInactivityTimer();
                        }, typingWait);
                    }
                }
            }
        };

        var eEmojiClickHandler = function (e) {
            if (e.target.nodeName == 'A') {
                Onvida.Chat.ui.inputTextMessage.value += e.target.innerText;
                eInputTextMessageKeypressHandler();
            }
        };

        return {
            // Public Variables
            ready: false,
            formLoaded: false,
            config: {
                Token: null,
                ChatID: null,
                UserIdentity: null,
                QueueID: null,
                Features: ['videochat', 'audiochat', 'textchat'],
                Settings: {
                    ChatService: null,
                    VideoService: null,
                	AgentDisconnectMessage: null
                },
                AutoInitialize: false,
                AutoRun: false,
                FormType: Onvida.FormTypes.NONE
            },
            ui: {},
            uiClasses: [
                // UI Components
                'ui-videochat',
                'ui-textchat',

                // Panels
                'panel-identify',
                'panel-chat',
                'panel-inactivity',
                'panel-inactivity-complete',
                'panel-close-confirm',
                'panel-close-complete',
                'panel-unavailable',
                'panel-unsupported',
                'panel-video-media',
                'panel-video-waiting',
                'panel-video-hold',
                'panel-chat-type',

                // Holders
                'holder-status',
                'holder-status-icons',
                'holder-status-messages',
                'holder-video-buttons',
                'holder-text-messages',
                'holder-text-controls',
                'holder-unsupported-ios',
                'holder-unsupported-general',
                'holder-transcript',
                'holder-emojis',

                // Buttons
                'btn-ui-minmax-toggle',
                'btn-ui-pop-toggle',
                'btn-ui-close',
                //'btn-ui-sounds-toggle',
                'btn-identify-start',
                'btn-video-video-toggle',
                'btn-video-audio-toggle',
                'btn-video-chat-toggle',
                'btn-video-self-view-toggle',
                'btn-video-hangup',
                'btn-text-send-message',
                'btn-text-transcript-view',
                'btn-text-transcript-email',
                'btn-text-transcript-download',
                'btn-text-transcript-copy',
                'btn-text-transcript-print',
                'btn-inactivity-continue',
                'btn-inactivity-complete-resume',
                'btn-inactivity-complete-close',
                'btn-close-confirm',
                'btn-close-cancel',
                'btn-close-complete-resume',
                'btn-close-complete-close',
                'btn-unavailable-close',
                'btn-unsupported-safari',
                'btn-unsupported-chrome',
                'btn-unsupported-firefox',
                'btn-unsupported-edge',
                'btn-chat-type-video',
                'btn-chat-type-audio',
                'btn-chat-type-text',

                // Forms & Fields
                'form-identify',
                'input-text-message',

                // Media
                'media-local',
                'media-remote',
                'media-waiting',

                // Text Display
                'txt-module-title',
                'txt-inactivity-count',
                'txt-unavailable'
            ],

            // Public Methods
            init: function (cfg) {
                Onvida.Log.debug('Chat.init()');
                var self = this;
                ready = false;
                this.config = Onvida.Utils.extend(this.config, cfg);
                if (Onvida.chatEnableEmojis === true && !this.emojisEnabled())
                    this.config.Features.push('emojis');
                else if (Onvida.chatEnableEmojis === false && this.emojisEnabled()) {
                    var index = Onvida.Utils.getArrayIndex(this.config.Features, 'emojis');
                    this.config.Features.splice(index, 1);
                }
                if (Onvida.formType != null)
                    this.config.FormType = Onvida.formType;
                this.ui = Onvida.Utils.initUIElements('chat', this.uiClasses);

                if (this.ui.errors.length > 0) {
                    Onvida.Log.error('Chat Missing UI Elements: ' + this.ui.errors.join(', '));
                } else {
                    delete this.ui.errors;
                    attachEventHandlers(this.ui);
                    this.ui.moduleRoot.style.visibility = 'hidden';
                    this.reset();
                    initResize(this.ui.moduleRoot, checkOrientationChange);
                    initDrag(this.ui.moduleRoot);
                    initTextareaAutoSize(this.ui.inputTextMessage, this.ui.holderTextMessages);
                    initWindowUnload('Chat/CloseChat', function () {
                        return ((Onvida.Chat.config.ChatID == null) ? null : { chatID: Onvida.Chat.config.ChatID });
                    });
                    if (Onvida.Chat.config.HeaderText != null)
                        this.ui.txtModuleTitle.innerHTML = Onvida.Chat.config.HeaderText; showElem(this.ui.moduleRoot, true);
                    this.open();
                    toggleTranscriptControls();
                    if (Onvida.Utils.isWebRTCSupported()) {
                        this.isAvailable(function (response) {
                            if (response.Available) {
                                getIdentifyForm(function () {
                                    ready = true;
                                    Onvida.Chat.mute(chatMuted);
                                    if (Onvida.Chat.config.FormType == Onvida.FormTypes.NONE) {
                                        startChat(Onvida.user);
                                        self.ui.moduleRoot.style.visibility = '';
                                    } else {
                                        showPanel('Identify');
                                        self.ui.moduleRoot.style.visibility = '';
                                    }
                                    self.ui.moduleRoot.origStyle = self.ui.moduleRoot.getAttribute('style');
                                });
                            } else {
                                ready = true;
                                self.ui.moduleRoot.style.visibility = '';
                                Onvida.Chat.mute(chatMuted);
                                declineChat(response.ErrorType, response.ErrorMessage, response.ErrorInfo);
                            }
                        });
                    } else {
                        self.ui.moduleRoot.style.visibility = '';
                        showPanel('Unsupported');
                    }
                }
            },
            startChat: function (user) {
                Onvida.Log.debug('Chat.startChat()');
                if (ready)
                    startChat(user);
                else this.init();
            },
            endChat: function () {
                Onvida.Log.debug('Chat.endChat()');
                if (ready)
                    endChat();
            },
            mute: function (state) {
                Onvida.Log.debug('Chat.mute(' + (state !== false) + ')');
                chatMuted = state !== false;
                if (ready) {
                    //toggleClass(this.ui.btnUiSoundsToggle, 'btn-toggled', chatMuted);
                    //this.ui.btnUiSoundsToggle.setAttribute('title', chatMuted ? 'Unmute Sounds' : 'Mute Sounds');
                    //this.ui.btnUiSoundsToggle.firstChild.innerHTML = this.ui.btnUiSoundsToggle.getAttribute('title');
                }
            },
            collapse: function (state) {
                Onvida.Log.debug('Chat.collapse(' + (state !== false) + ')');
                chatCollapsed = state !== false;
                if (ready) {
                    toggleRetainedStyles(this.ui.moduleRoot, chatCollapsed);
                    toggleClass(this.ui.btnUiMinmaxToggle, 'btn-toggled', chatCollapsed);
                    toggleClass(this.ui.moduleRoot, 'module-collapsed', chatCollapsed);
                    this.ui.btnUiMinmaxToggle.setAttribute('title', chatCollapsed ? 'Expand' : 'Collapse');
                    this.ui.btnUiMinmaxToggle.firstChild.innerHTML = this.ui.btnUiMinmaxToggle.getAttribute('title');
                }
            },
            pop: function (state) {
                Onvida.Log.debug('Chat.pop(' + (state !== false) + ')');
                chatPopped = state !== false;
                if (ready) {
                    toggleClass(this.ui.btnUiPopToggle, 'btn-toggled', chatPopped);
                    this.ui.btnUiPopToggle.setAttribute('title', chatPopped ? 'Dock to Parent Window' : 'Launch in New Window');
                    this.ui.btnUiPopToggle.firstChild.innerHTML = this.ui.btnUiPopToggle.getAttribute('title');
                    //if (chatPopped)
                    //    launchInNewWindow();
                    //else
                    //    dockToParentWindow();
                }
            },
            open: function (collapsed) {
                Onvida.Log.debug('Chat.open(' + collapsed + ')');
                chatOpen = true;
                chatCollapsed = collapsed === true;
                if (ready) {
                    this.collapse(chatCollapsed);
                }
            },
            close: function () {
                Onvida.Log.debug('Chat.close()');
                chatOpen = false;
                if (ready) {
                    if (Onvida.Chat.isQueued() || Onvida.Chat.isInProgress())
                        Onvida.Chat.endChat();
                    closeChat();
                    Onvida.Chat.reset();
                    toggleRetainedStyles(this.ui.moduleRoot, true, true);
                }
            },
            enableResize: function (state) {
                Onvida.Log.debug('Chat.enableResize(' + (state !== false) + ')');
                moduleResizable = state !== false;
                if (ready) {
                    toggleClass(this.ui.moduleRoot, 'module-resizable', chatCollapsed);
                }
            },
            enableDrag: function (state) {
                Onvida.Log.debug('Chat.enableDrag(' + (state !== false) + ')');
                moduleDraggable = state !== false;
                if (ready) {
                    toggleClass(this.ui.moduleRoot, 'module-draggable', chatCollapsed);
                }
            },
            enableVideo: function (state) {
                Onvida.Log.debug('Chat.enableVideo(' + (state !== false) + ')');
                if (ready)
                    vcToggleVideo(state !== false);
            },
            enableAudio: function (state) {
                Onvida.Log.debug('Chat.enableAudio(' + (state !== false) + ')');
                if (ready)
                    vcToggleAudio(state !== false);
            },
            getTranscript: function () {
                Onvida.Log.debug('Chat.getTranscript()');
                return (ready) ? tcGetTranscript() : null;
            },
            reset: function () {
                Onvida.Log.debug('Chat.reset()');
                if (ready) {
                    stopCloseTimer();
                    this.resetUI();
                    this.resetVideoChat();
                    this.resetTextChat();
                }
            },
            resetUI: function () {
                Onvida.Log.debug('Chat.resetUI()');
                if (ready) {
                    statusEnabled = true;
                    endPanel = null;
                    endPanelHidden = true;
                    hidePanels();
                    clearStatus();
                }
            },
            resetVideoChat: function () {
                Onvida.Log.debug('Chat.resetVideoChat()');
                if (ready) {
                    videoChatClientReady = false;
                    videoChatInProgress = false;
                    videoChatAudioDeviceFound = false;
                    videoChatVideoDeviceFound = false;
                    pendingData = null;
                    if (videoChatRoom != null) {
                        vcDetachParticipantTracks(videoChatRoom.localParticipant);
                        videoChatRoom.participants.forEach(vcDetachParticipantTracks);
                        if (videoChatMedia.tracks) {
                        	videoChatMedia.tracks.forEach(function (publication) {
                        		if (publication.track) {
                        			publication.track.stop();
                        			publication.unpublish();
                        		}
                            });
                        }
                        vcToggleVideo(false);
                        vcToggleAudio(false);
                        vcToggleSelfView(false);
                    }
                    var waitingTracks = vcGetWaitingTracks();
                    waitingTracks.forEach(function (track) {
                        track.stop();
                    });
                    Onvida.Chat.ui.mediaWaiting.innerHTML = '';
                    vcShowPanel('Media', false);
                    toggleClass(Onvida.Chat.ui.mediaRemote, 'paused', true);
                    toggleClass(Onvida.Chat.ui.mediaRemote, 'muted', true);
                    videoChatMedia = null;
                    videoChatRoom = null;
                }
            },
            resetTextChat: function () {
                Onvida.Log.debug('Chat.resetTextChat()');
                if (ready) {
                    textChatInProgress = false;
                    queuePositionLast = null;
                    chatStarting = false;
                    chatEnding = false;
                    chatStatusFailures = 0;
                    showElem(Onvida.Chat.ui.holderTranscript, false);
                    Onvida.Chat.ui.holderTextMessages.innerHTML = '';
                    messageQueue = new Array();
                    messageRendering = false;
                    messageRetrieving = false;
                    tcEnableControls(false);
                    tcShowControls(false);
                    if (textChatClient != null) {
                        textChatClient.reset();
                        textChatClient.dispose().then(() => {
                            textChatClient = null;
                        });
                    }
                }
            },
            isAvailable: function (callback) {
                Onvida.Log.debug('Chat.isAvailable()');
                Onvida.sendRequest('Chat/IsChatAvailable', {}, function (response) {
                    if (typeof callback === 'function')
                        callback(response);
                }, function (errorCode, message) {
                    if (typeof callback === 'function')
                        callback({
                            Available: false,
                            ErrorType: 'ApplicationError',
                            ErrorMessage: message,
                            ErrorInfo: null
                        });
                });
            },

            // Public Boolean Functions
            videoChatEnabled: function () {
                return Onvida.Utils.isInArray(this.config.Features, 'videochat');
            },
            audioChatEnabled: function () {
                return Onvida.Utils.isInArray(this.config.Features, 'audiochat');
            },
            textChatEnabled: function () {
                return Onvida.Utils.isInArray(this.config.Features, 'textchat');
            },
            emojisEnabled: function () {
                return Onvida.Utils.isInArray(this.config.Features, 'emojis');
            },
            isQueued: function () {
                return !chatEnding && chatInQueue && !chatAnswered;
            },
            isInProgress: function () {
                return !chatEnding && chatAnswered;
            },
            isMuted: function () {
                return chatMuted;
            },
            isPopped: function () {
                return chatPopped;
            },
            isCollapsed: function () {
                return chatCollapsed;
            },
            isOpen: function () {
                return chatOpen;
            },
            isClosed: function () {
                return !chatOpen;
            }
        };
    })();
} else {
    console.error('Onvida Common Library not found.')
}