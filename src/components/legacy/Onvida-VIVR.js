if (typeof window.Onvida != 'undefined' && window.Onvida != null && !window.Onvida.hasOwnProperty('VIVR')) {
    Onvida.Log.debug('Onvida.VIVR Module Loaded');
    window.Onvida.VIVR = (function () {
        /* Private Variables */
        var
            statusTimer = null,
            statusWait = 5000,
            statusEnabled = false,

            statusAutoHideTimer = null,
            statusAutoHideWait = 3000,

            inactivityTimer = null,
            inactivityTimeout = 15 * 60,
            inactivityTimerEnabled = false,

            inactivityCounter = null,
            inactivityCountdownMax = 30,
            inactivityCountdownTimer = null,
            inactivityCountdownWait = 1000,

            closeTimer = null,
            closeWait = 5 * 60 * 1000,

            disconnectTimer = null,
            disconnectWait = 10 * 1000,

            vivrStarting = false,
            vivrEnding = false,
            vivrInProgress = false,
            vivrOpen = false,
            vivrCollapsed = false,
            vivrPopped = false,
            vivrMuted = false,

            currPrompt = null,
            promptIndex = null,
            promptHistory = new Array(),
            navEnabled = false,

            currPanel = null,
            endPanelHidden = true,
            endPanel = null,

            moduleResizable = true,
            moduleDraggable = true;


        /* VIVR Flow Methods */
        var startVIVR = function (user) {
            if (!vivrStarting && !vivrInProgress && !vivrEnding) {
                Onvida.Log.debug('VIVR Private - startVIVR()');
                Onvida.VIVR.reset();
                vivrStarting = true;
                vivrInProgress = false;
                queueVIVR(user, function (response) {
                    showPanel('Flow');
                    navEnabled = true;
                    renderPrompt(response.Prompt);
                });
            }
        }

        var continueVIVR = function (source) {
            startInactivityTimer();
            stopCloseTimer();
            vivrInProgress = true;
            showPanel('Flow');
        }

        var endVIVR = function (inactivityTimeout) {
            if (Onvida.VIVR.isInProgress()) {
                if (!vivrEnding) {
                    Onvida.Log.debug('VIVR Private - endVIVR(' + inactivityTimeout + ')');
                    vivrEnding = true;
                    stopInactivityTimer();
                    stopInactivityCountdown();
                    showElem(Onvida.VIVR.ui.btnCloseCompleteResume, false);
                    showPanel(inactivityTimeout ? 'InactivityComplete' : 'CloseComplete', inactivityTimeout ? { reason: 'inactivity' } : null);
                    vivrEnding = false;
                    vivrStarting = false;
                    vivrInProgress = false;
                    if (!inactivityTimeout)
                        closeVIVR();
                    startCloseTimer();
                }
            }
        }

        var closeVIVR = function () {
            stopCloseTimer();
            if (Onvida.VIVR.config.VIVRID != null) {
                Onvida.Log.debug('VIVR Private - closeVIVR()');
                Onvida.sendRequest('VisualIVR/CloseVIVR', {
                    vivrID: Onvida.VIVR.config.VIVRID
                }, function (response) {
                    Onvida.VIVR.config.VIVRID = null;
                });
            }
        }

        var queueVIVR = function (user, callback) {
            var userData = (typeof user == 'undefined' || user == null) ? null : JSON.stringify(user);
            Onvida.Log.debug('VIVR Private - queueVIVR(' + userData + ')');
            Onvida.sendRequest('VisualIVR/InboundVIVR', {
                userData: userData,
                requestType: Onvida.requestType,
                requestTypeColor: Onvida.requestTypeColor,
                deviceType: 'Browser'
            }, function (response) {
                if (!vivrEnding) {
                    Onvida.VIVR.config.VIVRID = response.VIVRID;
                    Onvida.VIVR.config.UserIdentity = response.UserIdentity;
                    Onvida.VIVR.config.PhoneNumber = response.PhoneNumber;
                    vivrInProgress = true;
                    callback(response);
                }
            }, function (errorCode, message) {
                if (typeof message === 'string') {
                    var messageParts = message.split('|');
                    if (messageParts.length >= 2) {
                        var errorType = messageParts.shift();
                        var errorMessage = messageParts.join('|').trim();
                        declineVIVR(errorType, errorMessage);
                    }
                }
            });
        };

        var declineVIVR = function (errorType, errorMessage) {
            Onvida.Log.warn('VIVR Private - declineVIVR: ' + errorType + ' - ' + errorMessage);
            vivrInProgress = false;
            if (errorMessage != '' && errorMessage != 'null') {
                replaceTags(Onvida.VIVR.ui.txtUnavailable, errorMessage);
            } else {
                replaceTags(Onvida.VIVR.ui.txtUnavailable, Onvida.VIVR.ui.txtUnavailable.template);
            }
            showPanel('Unavailable');
        }

        var startInactivityTimer = function () {
            stopInactivityTimer();
            if (inactivityTimeout > 0) {
                inactivityTimerEnabled = true;
                inactivityTimer = window.setTimeout(function () {
                    if (Onvida.VIVR.isInProgress())
                        showPanel('Inactivity');
                }, inactivityTimeout * 1000);
            }
        }

        var stopInactivityTimer = function (pauseOnly) {
            window.clearTimeout(inactivityTimer);
            if (!pauseOnly)
                inactivityTimerEnabled = false;
        }

        var startInactivityCountdown = function () {
            inactivityCounter = inactivityCountdownMax;
            updateInactivityCountdown();
        }

        var stopInactivityCountdown = function () {
            window.clearTimeout(inactivityCountdownTimer);
            inactivityCounter = null;
        }

        var updateInactivityCountdown = function () {
            window.clearTimeout(inactivityCountdownTimer);
            Onvida.VIVR.ui.txtInactivityCount.innerText = inactivityCounter;
            inactivityCounter--;
            if (inactivityCounter >= 0) {
                inactivityCountdownTimer = window.setTimeout(updateInactivityCountdown, inactivityCountdownWait);
            } else {
                endVIVR(true);
            }
        }

        var startCloseTimer = function () {
            Onvida.Log.debug('VIVR Private - startCloseTimer()');
            window.clearTimeout(closeTimer);
            closeTimer = window.setTimeout(function () { Onvida.close('VIVR'); }, closeWait);
        }

        var stopCloseTimer = function () {
            window.clearTimeout(closeTimer);
        }

        /* Navigation Controls */
        var go = function (index) {
            if (navEnabled && index >= 0 && index < promptHistory.length) {
                Onvida.Log.debug('VIVR Private - go(' + index + ')');
                navEnabled = false;
                promptIndex = index;
                currPrompt = promptHistory[promptIndex];
                var holder = Onvida.VIVR.ui.holderFlow;
                var panel = holder.querySelectorAll('.' + Onvida.uiPrefix + '-panel-prompt')[index];
                var input = panel.querySelector('.' + Onvida.uiPrefix + '-input');
                if (currPrompt.hasOwnProperty('Value')) {
					if (input) {
						input.value = currPrompt.Value;
                	} else {
                		var buttons = panel.querySelectorAll('.' + Onvida.uiPrefix + '-btn');
                		for (var i = 0; i < buttons.length; i++) {
                			if (buttons[i].value == currPrompt.Value) {
                				buttons[i].classList.add(Onvida.uiPrefix + '-selected');
                			} else {
                				buttons[i].classList.remove(Onvida.uiPrefix + '-selected');
                			}
                		}
                	}
                }
                showElem(panel, true, 'panel-prompt');
                navEnabled = true;
                updateNavigation();
                startInactivityTimer();
            }
        }

        var goNext = function (input) {
            if (navEnabled){
                Onvida.Log.debug('VIVR Private - goNext(' + input + ')');
                stopInactivityTimer();
                if (typeof input == 'undefined' && (promptIndex + 1 < promptHistory.length)) {
                    input = promptHistory[promptIndex + 1].InteractionState.Input;
                }
                if (typeof input != 'undefined') {
                	navEnabled = false;
                	promptHistory[promptIndex].Value = input;
                    getPromptResponse(currPrompt.ID, input, 'next', function (response) {
                        Onvida.Log.debug('VIVR Private - goNext(' + input + '): curr ' + currPrompt.ID + ' > next ' + response.ID);
                        renderPrompt(response);
                    });
                }
            }
        }

        var goHome = function () {
            if (navEnabled && promptIndex > 0) {
                Onvida.Log.debug('VIVR Private - goHome()');
                stopInactivityTimer();
                navEnabled = false;
                getPromptResponse(currPrompt.ID, null, 'home', function (response) {
                    go(0);
                });
            }
        }

        var goBack = function () {
            if (navEnabled && promptIndex > 0) {
                Onvida.Log.debug('VIVR Private - goBack()');
                stopInactivityTimer();
                navEnabled = false;
                getPromptResponse(currPrompt.ID, null, 'back', function (response) {
                    go(promptIndex - 1);
                });
            }
        }

        var getPromptResponse = function (id, input, destination, callback) {
            Onvida.Log.debug('VIVR Private - getPromptResponse(' + id + ', ' + input + ', ' + destination + ')');
            var canceled = destination == 'home' || destination == 'back';
            var state = (destination == 'back') ? promptHistory[promptIndex - 1].InteractionState : null;
            if (destination == 'back')
            	state.PromptID = promptHistory[promptIndex - 1].ID;
            Onvida.sendRequest('VisualIVR/PromptResponse', {
                promptID: id,
                input: input,
                canceled: canceled,
                state: JSON.stringify(state)
            }, function (response) {
                navEnabled = true;
                if (typeof callback === 'function')
                    callback(response);
            }, function (errorCode, message) {
                if (typeof message === 'string') {
                    var messageParts = message.split('|');
                    if (messageParts.length >= 2) {
                        var errorType = messageParts.shift();
                        var errorMessage = messageParts.join('|').trim();
                        declineVIVR(errorType, errorMessage);
                    }
                }
            });
        }

        var renderPrompt = function (prompt) {
            Onvida.Log.debug('VIVR Private - renderPrompt(' + prompt.ID + ')');
            // If failure, display failure message
            if (currPrompt != null && currPrompt.ID == prompt.ID) {
                var holder = Onvida.VIVR.ui.holderFlow;
                var panel = holder.querySelectorAll('.' + Onvida.uiPrefix + '-panel-prompt')[promptIndex];
                var message = panel.querySelector('.' + Onvida.uiPrefix + '-txt-header');
                message.innerHTML = (prompt.FailureMessage == '') ? prompt.Message : prompt.FailureMessage;
            // Else if success...
            } else {
                addPromptPanel(promptIndex + 1, prompt);
                if (promptIndex + 1 >= promptHistory.length)
                    promptHistory.push(prompt);
                else
                    promptHistory[promptIndex + 1] = prompt;
                go(promptIndex + 1);
            }
        }

        var addPromptPanel = function (index, prompt) {
            Onvida.Log.debug('VIVR Private - addPromptPanel()');
            var holder = Onvida.VIVR.ui.holderFlow;
            var panels = holder.querySelectorAll('.' + Onvida.uiPrefix + '-panel-prompt');
            var buttonClickHandler = function (e, button) {
                var input = button.closest('FORM').querySelector('.' + Onvida.uiPrefix + '-input');
                goNext(input.value);
            }
            var typeHTML = '';
            var panelTemplate = '<div id="onv-panel-prompt-[[index]]" data-promptid="[[id]]" class="onv-panel onv-panel-prompt onv-hidden">\
                <div class="onv-holder onv-holder-prompt">\
                    <div class="onv-txt onv-txt-header">[[header]]</div>\
                    <div class="onv-txt">[[description]]</div>\
                    [[typeHTML]]\
                </div>\
            </div>';
            var formTemplate = '<form id="onv-form-prompt-[[index]]" class="onv-form onv-form-prompt" onsubmit="return false">\
                <div class="onv-holder-form">[[formHTML]]</div>\
                [[buttonsHTML]]\
            </form>';
            var inputTemplate = '<input class="onv-input" type="text" placeholder="[[placeholder]]" required maxlength="[[maxlength]]" />';
            var selectTemplate = '<select class="onv-input" size="1" required >[[options]]</select>';
            var selectOptionTemplate = '<option value="[[value]]">[[label]]</option>';
            var buttonHolderTemplate = '<div class="onv-holder onv-holder-buttons">[[buttons]]</div>';
            var buttonTemplate = '<button class="onv-btn" value="[[value]]"><span>[[label]]</span></button>';
            var savedChoice = ((promptHistory.length > promptIndex + 2) && (promptHistory[promptIndex + 1].ID == prompt.ID)) ? promptHistory[promptIndex + 2].InteractionState.Input : '';

            // If No Prompt Responses, Treat it Like a HangUp Prompt
            if (prompt.Type == 'Ask' && prompt.IVRPrompts.length == 0)
                prompt.Type = 'HangUp';

            switch (prompt.Type) {
                case 'API':
                case 'ChangeQueue':
                    var buttonsHTML = replaceTags(buttonTemplate, { label: 'Next', value: null });
                    typeHTML = replaceTags(buttonHolderTemplate, { buttons: buttonsHTML });
                    buttonClickHandler = function (e, button) {
                        var value = button.value;
                        goNext(value);
                    };
                    break;
                case 'Ask':
                    // Free-Form Text - Prompt Responses Do Not Have Labels
                    if (prompt.IVRPrompts[0].Label == null || prompt.IVRPrompts[0].Label == '') {
                        var formHTML = replaceTags(inputTemplate, {
                            placeholder: (prompt.Attributes.hasOwnProperty('Placeholder')) ? prompt.Attributes.Placeholder : '',
                            maxlength: (prompt.Attributes.hasOwnProperty('numDigits')) ? prompt.Attributes.numDigits : 50
                        });
                        var buttonsHTML = replaceTags(buttonTemplate, { label: 'Next' });
                        buttonsHTML = replaceTags(buttonHolderTemplate, { buttons: buttonsHTML });
                        typeHTML = replaceTags(formTemplate, { index: index, formHTML: formHTML, buttonsHTML: buttonsHTML });
                    // DropDown - DropDown Attribute is true and Prompt Responses Do Have Labels
                    } else if (prompt.Attributes.hasOwnProperty('DropDown') && prompt.Attributes.DropDown.toLowerCase() == 'true') {
                    	var optionsHTML = '';
                    	optionsHTML += replaceTags(selectOptionTemplate, {
                    		label: 'Please select...',
                    		value: ''
                    	});
                        for (var i = 0; i < prompt.IVRPrompts.length; i++) {
                            optionsHTML += replaceTags(selectOptionTemplate, {
                                label: prompt.IVRPrompts[i].Label,
                                value: prompt.IVRPrompts[i].Value
                            });
                        }
                        var formHTML = replaceTags(selectTemplate, { options: optionsHTML });
                        var buttonsHTML = replaceTags(buttonTemplate, { label: 'Next' });
                        buttonsHTML = replaceTags(buttonHolderTemplate, { buttons: buttonsHTML });
                        typeHTML = replaceTags(formTemplate, { index: index, formHTML: formHTML, buttonsHTML: buttonsHTML });
                    // Radio Button Choices - Prompt Responses Do Have Labels
                    } else {
                        var buttonsHTML = '';
                        for (var i = 0; i < prompt.IVRPrompts.length; i++) {
                        	var value = prompt.IVRPrompts[i].Value;
                        	buttonsHTML += replaceTags(buttonTemplate, {
                                label: prompt.IVRPrompts[i].Label,
                                value: value
                            });
                        }
                        typeHTML = replaceTags(buttonHolderTemplate, { buttons: buttonsHTML });
                        buttonClickHandler = function (e, button, input) {
                            var value = button.value;
                            goNext(value);
                        };
                    }
                    break;
                case 'Hangup':
                    var buttonsHTML = replaceTags(buttonTemplate, { label: 'Close', value: null });
                    typeHTML = replaceTags(buttonHolderTemplate, { buttons: buttonsHTML });
                    buttonClickHandler = function (e, button) {
                        showPanel('CloseConfirm');
                    };
                    break;
                case 'PIN':
                    var formHTML = replaceTags(inputTemplate, {
                        placeholder: (prompt.Attributes.hasOwnProperty('Placeholder')) ? prompt.Attributes.Placeholder : 'PIN',
                        maxlength: (prompt.Attributes.hasOwnProperty('numDigits')) ? prompt.Attributes.numDigits : 10
                    });
                    var buttonsHTML = replaceTags(buttonTemplate, { label: 'Next' });
                    buttonsHTML = replaceTags(buttonHolderTemplate, { buttons: buttonsHTML });
                    typeHTML = replaceTags(formTemplate, { index: index, formHTML: formHTML, buttonsHTML: buttonsHTML });
                    break;
                case 'ReferralCode':
                    var formHTML = replaceTags(inputTemplate, {
                        placeholder: (prompt.Attributes.hasOwnProperty('Placeholder')) ? prompt.Attributes.Placeholder : 'Referral Code',
                        maxlength: (prompt.Attributes.hasOwnProperty('numDigits')) ? prompt.Attributes.numDigits : 20
                    });
                    var buttonsHTML = replaceTags(buttonTemplate, { label: 'Next' });
                    buttonsHTML = replaceTags(buttonHolderTemplate, { buttons: buttonsHTML });
                    typeHTML = replaceTags(formTemplate, { index: index, formHTML: formHTML, buttonsHTML: buttonsHTML });
                    break;
                case 'SDKModule':
                default:
                    typeHTML = '';
                    break;
            }

            var panelHTML = replaceTags(panelTemplate, {
                id: prompt.ID,
                index: index,
                header: replaceTags(prompt.Message, null, true),
                description: replaceTags(prompt.Description, null, true),
                typeHTML: typeHTML
            });

            if (index < promptHistory.length) {
                var tmpDiv = document.createElement('DIV');
                tmpDiv.innerHTML = panelHTML;
                var oldPanel = holder.querySelectorAll('.' + Onvida.uiPrefix + '-panel-prompt')[index];
                holder.replaceChild(tmpDiv.firstChild, oldPanel);
                tmpDiv.remove();
            } else {
                holder.insertAdjacentHTML('beforeend', panelHTML);
            }

            var panel = holder.querySelectorAll('.' + Onvida.uiPrefix + '-panel-prompt')[index];
            var input = panel.querySelector('.' + Onvida.uiPrefix + '-input');
            var buttons = panel.querySelectorAll('.' + Onvida.uiPrefix + '-btn');
            for (var i = 0; i < buttons.length; i++) {
                buttons[i].addEventListener('click', function (e) {
                    buttonClickHandler(e, this);
                });
                if (savedChoice != null && !input) {
                	if (buttons[i].value == savedChoice) {
                		buttons[i].classList.add(Onvida.uiPrefix + '-selected');
                	}
                }
            }

            if (input){
            	input.value = savedChoice;
            	input.addEventListener('change', startInactivityTimer);
            }

            if (prompt.Type == 'SDKModule') {
                var tmpMuted = vivrMuted;
                vivrMuted = true;
                Onvida.close('VIVR');
                vivrMuted = tmpMuted;
                Onvida.launch('Chat', function () {
                	Onvida.Chat.mute(vivrMuted);
                });
            }
        }

        var removePromptPanel = function (index) {
            Onvida.Log.debug('VIVR Private - removePromptPanel()');
            var holder = Onvida.VIVR.ui.holderFlow;
            var panels = holder.querySelectorAll('.' + Onvida.uiPrefix + '-panel-prompt');
            panels[index].remove();
        }

        var updateNavigation = function () {
        	var backDisabled = promptIndex == 0 || (promptHistory[promptIndex].Attributes.hasOwnProperty('DisableBack') && promptHistory[promptIndex].Attributes.DisableBack == 'True');
            var nextDisabled = promptIndex + 1 >= promptHistory.length;
            toggleClass('btnNavHome', 'disabled', backDisabled);
            toggleClass('btnNavBack', 'disabled', backDisabled);
            toggleClass('btnNavNext', 'disabled', nextDisabled);
        }

        var updateStatus = function (stateName, params, autoHide) {
            if (statusEnabled) {
                Onvida.Log.debug('VIVR Private - updateStatus(' + stateName + ', ' + JSON.stringify(params) + ', ' + autoHide + ')');
                window.clearTimeout(statusAutoHideTimer);
                var pic = showElem('pic-status-' + stateName, true, 'pic');
                var txt = showElem('txt-status-' + stateName, true, 'txt');
                replaceTags(txt, params);
                showElem(Onvida.VIVR.ui.holderStatus, true);
                switch (stateName) {
                    case 'active':
                        break;
                    case 'close-confirm':
                    case 'inactivity':
                    case 'error':
                        playVIVRSound('alert');
                        break;
                    case 'close-complete':
                    case 'inactivity-complete':
                        playVIVRSound('end');
                        break;
                }
                if (autoHide) {
                    statusAutoHideTimer = window.setTimeout(clearStatus, statusAutoHideWait);
                }
            }
        }

        var clearStatus = function () {
            Onvida.Log.debug('VIVR Private - clearStatus()');
            updateStatus((vivrInProgress) ? 'active' : 'inactive');
        }

        var playVIVRSound = function (soundName) {
        	if (!vivrMuted) {
        		Onvida.Utils.audioPlay('vivr-' + soundName);
        	}
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

        var toggleRetainedStyles = function (elem, revertToDefault) {
            if (typeof revertToDefault == 'undefined') {
                revertToDefault = elem.getAttribute('style') != null;
            }
            if (revertToDefault) {
                elem.retainedStyle = elem.getAttribute('style');
                elem.removeAttribute('style');
            } else {
                elem.setAttribute('style', elem.retainedStyle);
            }
        }

        var hasClass = function (elem, className) {
            elem = getDOMElem(elem);
            return elem.classList.contains(Onvida.uiPrefix + '-' + className);
        }

        var getDOMElem = function (elem) {
            if (typeof elem === 'string') {
                elem = (Onvida.VIVR.ui.hasOwnProperty(elem)) ? Onvida.VIVR.ui[elem] : Onvida.VIVR.ui.moduleRoot.querySelector('.' + Onvida.uiPrefix + '-' + elem);
            }
            return elem;
        }

        var showPanel = function (panelName, params) {
            Onvida.Log.debug('VIVR Private - showPanel(' + panelName + ')');
            statusEnabled = true;
            switch (panelName) {
                case 'Flow':
                    updateStatus('active', params);
                    stopInactivityCountdown();
                    startInactivityTimer();
                    endPanelHidden = true;
                    break;
                case 'Help':
                    startInactivityTimer();
                    break;
                case 'Inactivity':
                    updateStatus('inactivity', params);
                    startInactivityCountdown();
                    Onvida.VIVR.collapse(false);
                    break;
                case 'InactivityComplete':
                    if (endPanel == null)
                        updateStatus('inactivity-complete', params);
                    endPanelHidden = false;
                    endPanel = panelName;
                    Onvida.VIVR.collapse(false);
                    break;
                case 'CloseConfirm':
                    updateStatus('close-confirm', params);
                    Onvida.VIVR.collapse(false);
                    break;
                case 'CloseComplete':
                    if (endPanel == null)
                        updateStatus('close-complete', params);
                    endPanelHidden = false;
                    endPanel = panelName;
                    Onvida.VIVR.collapse(false);
                    break;
            }
            currPanel = panelName;
            return showElem('panel' + panelName, true, 'panel');
        }

        var hidePanels = function () {
            Onvida.Log.debug('VIVR Private - hidePanels()');
            currPanel = null;
            return showElem('panelFlow', false, 'panel');
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
				
				if (evalJS){
					var startFrom = 0;
					var endAt = 0;
					var jsTag;
					var jsValue;
					while(newHTML.indexOf('[[', startFrom) != -1){
						startFrom = newHTML.indexOf('[[');
						endAt = newHTML.indexOf(']]', startFrom);
						if (endAt != -1){
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
            Onvida.Log.debug('VIVR Private - attachEventHandlers()');
            for (var i in ui) {
                try {
                    if (typeof eval(ui[i].handler) === 'function') {
                        Onvida.Log.debug(ui[i].handler + ' - Attached');
                        ui[i].addEventListener('click', eval(ui[i].handler));
                    }
                } catch (e) { }
            }
        }

        /* Module Positioning Utilities */
        var initResize = function (element) {
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

            //var logDisplay = document.createElement('DIV');
            //logDisplay.style.position = 'absolute';
            //logDisplay.style.width = '200px';
            //logDisplay.style.height = 'auto';
            //logDisplay.style.bottom = '0px';
            //logDisplay.style.left = '0px';
            //logDisplay.style.padding = '10px';
            //logDisplay.style.background = '#CCC';
            //logDisplay.style.border = 'solid 1px #333';
            //document.body.appendChild(logDisplay);

            resizeResetter.addEventListener('dblclick', function () {
                toggleRetainedStyles(element);
            });

            for (let i = 0; i < resizers.length; i++) {
                const currentResizer = resizers[i];
                currentResizer.addEventListener(Onvida.Utils.eventDown(), function (e) {
                    if (moduleResizable && !vivrCollapsed) {
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

                    //var output = '';
                    //output += 'viewPortWidth: ' + viewPortWidth + '<br/>';
                    //output += 'viewPortHeight: ' + viewPortHeight + '<br/>';
                    //output += 'origX: ' + origX + '<br/>';
                    //output += 'origY: ' + origY + '<br/>';
                    //output += 'x0: ' + x0 + '<br/>';
                    //output += 'y0: ' + y0 + '<br/>';
                    //output += 'width0: ' + width0 + '<br/>';
                    //output += 'height0: ' + height0 + '<br/>';
                    //output += 'mouseX0: ' + mouseX0 + '<br/>';
                    //output += 'mouseY0: ' + mouseY0 + '<br/>';
                    //output += 'newLeft: ' + newLeft + '<br/>';
                    //output += 'newTop: ' + newTop + '<br/>';
                    //output += 'newWidth: ' + newWidth + '<br/>';
                    //output += 'newHeight: ' + newHeight + '<br/>';
                    //logDisplay.innerHTML = output;
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
                if (moduleDraggable && !vivrCollapsed && !e.target.classList.contains(Onvida.uiPrefix + '-btn')) {
                    e.preventDefault();
                    dragger.classList.add(draggingClass);
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

        var initWindowUnload = function (url, dataGetter) {
            function cleanup() {
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

            window.addEventListener('unload', cleanup, false);
        }

        /*Event Handlers */
        // UI Module Buttons
        var eBtnUiCloseClickHandler = function (e) {
            if (vivrInProgress)
            	if (currPanel != 'CloseConfirm')
            		showPanel('CloseConfirm');
            	else endVIVR();
            else
            	Onvida.close('VIVR');
        };

        var eBtnUiMinmaxToggleClickHandler = function (e) {
            Onvida.VIVR.collapse(!hasClass(e.target, 'btn-toggled'));
        };

        var eBtnUiPopToggleClickHandler = function (e) {
            Onvida.VIVR.pop(!hasClass(e.target, 'btn-toggled'));
        };

        var eBtnUiSoundsToggleClickHandler = function (e) {
        	Onvida.VIVR.mute(!hasClass(e.target, 'btn-toggled'));
        };

    	// Navigation Buttons
        var eBtnNavHomeClickHandler = function (e) {
        	if (!hasClass('btnNavHome', 'disabled'))
				goHome();
        };

        var eBtnNavBackClickHandler = function (e) {
        	if (!hasClass('btnNavBack', 'disabled'))
				goBack();
        };

        var eBtnNavNextClickHandler = function (e) {
        	if (!hasClass('btnNavNext', 'disabled'))
				goNext();
        };

        var eBtnNavHelpClickHandler = function (e) {
            showPanel('Help');
        };

        // Panel/User Flow Buttons
        var eBtnInactivityContinueClickHandler = function (e) {
            continueVIVR('inactivity');
        };

        var eBtnInactivityCompleteResumeClickHandler = function (e) {
            continueVIVR('inactivity');
        };

        var eBtnInactivityCompleteCloseClickHandler = function (e) {
            Onvida.close('VIVR');
        };

        var eBtnCloseConfirmClickHandler = function (e) {
            endVIVR();
        };

        var eBtnCloseCancelClickHandler = function (e) {
            continueVIVR('close');
        };

        var eBtnCloseCompleteCloseClickHandler = function (e) {
            Onvida.close('VIVR');
        };

        var eBtnUnavailableCloseClickHandler = function (e) {
            Onvida.close('VIVR');
        };

        return {
            // Public Variables
            ready: false,
            config: {
                VIVRID: null,
                UserIdentity: null,
                QueueID: null,
                PhoneNumber: null,
                AutoInitialize: false,
                AutoRun: false,
                HeaderText: null
            },
            ui: {},
            uiClasses: [
                // Panels
                'panel-help',
                'panel-flow',
                'panel-inactivity',
                'panel-inactivity-complete',
                'panel-close-confirm',
                'panel-close-complete',
                'panel-unavailable',
                'holder-flow',
                'holder-status',

                // Buttons
                'btn-ui-minmax-toggle',
                'btn-ui-pop-toggle',
                'btn-ui-close',
                'btn-ui-sounds-toggle',
                'btn-nav-home',
                'btn-nav-back',
                'btn-nav-next',
                'btn-nav-help',
                'btn-inactivity-continue',
                'btn-inactivity-complete-resume',
                'btn-inactivity-complete-close',
                'btn-close-confirm',
                'btn-close-cancel',
                'btn-close-complete-close',
                'btn-unavailable-close',

                // Text Display
                'txt-module-title',
                'txt-inactivity-count',
                'txt-unavailable'
            ],

            // Public Methods
            init: function (cfg) {
                Onvida.Log.debug('VIVR.init()');
                var self = this;
                ready = false;
                this.config = Onvida.Utils.extend(this.config, cfg);
                this.ui = Onvida.Utils.initUIElements('vivr', this.uiClasses);

                if (this.ui.errors.length > 0) {
                    Onvida.Log.error('VIVR Missing UI Elements: ' + this.ui.errors.join(', '));
                } else {
                    delete this.ui.errors;
                    attachEventHandlers(this.ui);
                    this.ui.moduleRoot.style.visibility = 'hidden';
                    this.reset();
                    initResize(this.ui.moduleRoot);
                    initDrag(this.ui.moduleRoot);
                    initWindowUnload('VisualIVR/CloseVIVR', function () {
                        return ((Onvida.VIVR.config.VIVRID == null) ? null : { vivrID: Onvida.VIVR.config.VIVRID });
                    });
                    if (Onvida.VIVR.config.HeaderText != null)
                        this.ui.txtModuleTitle.innerHTML = Onvida.VIVR.config.HeaderText;
                    showElem(this.ui.moduleRoot, true);
                    this.open();
                    ready = true;
                    startVIVR(Onvida.user);
                    this.ui.moduleRoot.style.visibility = '';
                }
            },
            startVIVR: function (user) {
                Onvida.Log.debug('VIVR.startVIVR()');
                if (ready)
                    startVIVR(user);
                else this.init();
            },
            endVIVR: function () {
                Onvida.Log.debug('VIVR.endVIVR()');
                if (ready)
                    endVIVR();
            },
            mute: function (state) {
            	Onvida.Log.debug('VIVR.mute(' + (state !== false) + ')');
            	vivrMuted = state !== false;
            	if (ready) {
            		toggleClass(this.ui.btnUiSoundsToggle, 'btn-toggled', vivrMuted);
            		this.ui.btnUiSoundsToggle.setAttribute('title', vivrMuted ? 'Unmute Sounds' : 'Mute Sounds');
            		this.ui.btnUiSoundsToggle.firstChild.innerHTML = this.ui.btnUiSoundsToggle.getAttribute('title');
            	}
            },
            collapse: function (state) {
                Onvida.Log.debug('VIVR.collapse(' + (state !== false) + ')');
                vivrCollapsed = state !== false;
                if (ready) {
                    toggleRetainedStyles(this.ui.moduleRoot, vivrCollapsed);
                    toggleClass(this.ui.btnUiMinmaxToggle, 'btn-toggled', vivrCollapsed);
                    toggleClass(this.ui.moduleRoot, 'module-collapsed', vivrCollapsed);
                    this.ui.btnUiMinmaxToggle.setAttribute('title', vivrCollapsed ? 'Expand' : 'Collapse');
                    this.ui.btnUiMinmaxToggle.firstChild.innerHTML = this.ui.btnUiMinmaxToggle.getAttribute('title');
                }
            },
            pop: function (state) {
                Onvida.Log.debug('VIVR.pop(' + (state !== false) + ')');
                vivrPopped = state !== false;
                if (ready) {
                    toggleClass(this.ui.btnUiPopToggle, 'btn-toggled', vivrPopped);
                    this.ui.btnUiPopToggle.setAttribute('title', vivrPopped ? 'Dock to Parent Window' : 'Launch in New Window');
                    this.ui.btnUiPopToggle.firstChild.innerHTML = this.ui.btnUiPopToggle.getAttribute('title');
                    //if (vivrPopped)
                    //    launchInNewWindow();
                    //else
                    //    dockToParentWindow();
                }
            },
            open: function (collapsed) {
                Onvida.Log.debug('VIVR.open(' + collapsed + ')');
                vivrOpen = true;
                vivrCollapsed = collapsed === true;
                if (ready) {
                    this.collapse(vivrCollapsed);
                }
            },
            close: function () {
                Onvida.Log.debug('VIVR.close()');
                vivrOpen = false;
                if (ready) {
                    if (Onvida.VIVR.isInProgress())
                        Onvida.VIVR.endVIVR();
                    closeVIVR();
                    Onvida.VIVR.reset();
                }
            },
            enableResize: function (state) {
                Onvida.Log.debug('VIVR.enableResize(' + (state !== false) + ')');
                moduleResizable = state !== false;
                if (ready) {
                    toggleClass(this.ui.moduleRoot, 'module-resizable', vivrCollapsed);
                }
            },
            enableDrag: function (state) {
                Onvida.Log.debug('VIVR.enableDrag(' + (state !== false) + ')');
                moduleDraggable = state !== false;
                if (ready) {
                    toggleClass(this.ui.moduleRoot, 'module-draggable', vivrCollapsed);
                }
            },
            reset: function () {
                Onvida.Log.debug('VIVR.reset()');
                if (ready) {
                    currPrompt = null;
                    promptIndex = null;
                    promptHistory = new Array();
                    stopCloseTimer();
                    this.resetUI();
                }
            },
            resetUI: function () {
                Onvida.Log.debug('VIVR.resetUI()');
                if (ready) {
                    statusEnabled = true;
                    navEnabled = false;
                    endPanel = null;
                    endPanelHidden = true;
                    hidePanels();
                    currPrompt = null;
                    promptIndex = -1;
                    promptHistory = new Array();
                    Onvida.VIVR.ui.holderFlow.innerHTML = '';
                    clearStatus();
                }
            },
            isInProgress: function () {
                return !vivrEnding && vivrInProgress;
            },
            isMuted: function () {
            	return vivrMuted;
            },
            isPopped: function () {
                return vivrPopped;
            },
            isCollapsed: function () {
                return vivrCollapsed;
            },
            isOpen: function () {
                return vivrOpen;
            },
            isClosed: function () {
                return !vivrOpen;
            }
        };
    })();
} else {
    console.error('Onvida Common Library not found.')
}