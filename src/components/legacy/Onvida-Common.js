(function() {
    /* Onvida Core */
    window.Onvida = {
      ready: false,
      initialized: false,
      initialModuleLoad: true,
      autoInitialize: false,
      iFrame: null,
      sessionID: null,
      user: null,
      client: null,
      env: null,
      culture: "en-US",
      formType: null,
      queueID: null,
      embedAccessKey: null,
      requestType: null,
      requestTypeColor: null,
      bypassVIVR: false,
      enableChatEmojis: null,
      apiBase: null,
      libBase: null,
      release: "10.3.0.1",
      modules: new Array(),
      languages: new Array(),
      launchButtons: new Array(),
      root: null,
      skin: null,
      scriptSrc: "Onvida-Common.js",
      uiPrefix: "onv",
      Lib: {},
      Utils: utils,
      Log: log,
      Loader: loader,
      FormTypes: Object.freeze({
        NONE: 0,
        DEFAULT: 1,
        CUSTOM: 2,
      }),
  
      init: function(cfg) {
        if (!this.initialized) {
          this.initialized = true;
          var context = utils.getContext(this.scriptSrc);
          log.log(context);
        }
  
        if (cfg === Object(cfg)) {
          var overrides = [
            "onReady",
            "onModulesLoaded",
            "onModuleOpened",
            "onModuleClosed",
            "user",
            "requestType",
            "requestTypeColor",
            "culture",
            "embedAccessKey",
            "root",
            "skin",
            "formType",
            "bypassVIVR",
            "chatEnableEmojis",
          ];
          log.logLevel =
            cfg.hasOwnProperty("debug") && cfg.debug === true
              ? log.LogLevels.DEBUG
              : log.LogLevels.WARN;
          for (var i in overrides) {
            this[overrides[i]] = cfg.hasOwnProperty(overrides[i])
              ? cfg[overrides[i]]
              : this[overrides[i]];
          }
        }
  
        log.info(
          "Onvida Library - " +
            this.release.type +
            " (" +
            this.release.version +
            ")"
        );
        log.debug(
          "Onvida.init(" +
            (typeof cfg == "undefined" || cfg == null
              ? ""
              : JSON.stringify(cfg, null, "\t")) +
            ")"
        );
  
        if (this.embedAccessKey != null && domReady) this.createSessionIFrame();
      },
  
      onReady: function() {
        log.debug("Onvida.onReady");
      },
  
      onModulesLoaded: function() {
        log.debug("Onvida.onModulesLoaded");
      },
  
      onModuleOpened: function(moduleName) {
        log.debug("Onvida.onModuleOpened(" + moduleName + ")");
      },
  
      onModuleClosed: function(moduleName) {
        log.debug("Onvida.onModuleClosed(" + moduleName + ")");
      },
  
      onError: function(e) {
        onvidaError(e);
      },
  
      xmlHTTP: function() {
        var xmlhttp = false,
          XMLHttpFactories = [
            function() {
              return new XDomainRequest();
            },
            function() {
              return new XMLHttpRequest();
            },
            function() {
              return new ActiveXObject("Msxml2.XMLHTTP");
            },
            function() {
              return new ActiveXObject("Msxml3.XMLHTTP");
            },
            function() {
              return new ActiveXObject("Microsoft.XMLHTTP");
            },
          ],
          i,
          l;
        for (i = 0, l = XMLHttpFactories.length; i < l; i++) {
          try {
            xmlhttp = XMLHttpFactories[i]();
          } catch (e) {
            continue;
          }
          break;
        }
        return xmlhttp;
      },
  
      sendRequest: function(url, postData, callback, errorCallback, synchronous) {
        if (!this.xmlHTTP()) {
          log.error("Onvida.sendRequest: XMLHttpRequest not supported");
          return;
        }
        log.debug(
          "Onvida.sendRequest(" +
            url +
            ") - Data: " +
            JSON.stringify(postData) +
            ")"
        );
        if (typeof postData === "function") {
          errorCallback = callback;
          callback = postData;
          postData = null;
        }
  
        var absUrl = utils.getServiceURL(url);
  
        var method = postData ? "POST" : "GET";
  
        var xmlHTTP = this.xmlHTTP();
        xmlHTTP.open(method, absUrl, synchronous !== true);
        try {
          if (postData)
            xmlHTTP.setRequestHeader(
              "Content-type",
              "application/x-www-form-urlencoded"
            );
        } catch (e) {
          log.warn(e);
        }
  
        //XMLHttpRequest
        var self = this;
  
        var successHandler = function(
          url,
          response,
          type,
          callback,
          errorCallback
        ) {
          var rawData = JSON.stringify(response);
          log.debug(
            "Onvida.sendRequest(" +
              url +
              ") - Success: " +
              (rawData.length > 150 ? rawData.substring(0, 150) + "..." : rawData)
          );
          var responseData = response;
          switch (type) {
            case "":
              if (!responseData.indexOf('{"Response":') == 0) break;
            case "json":
              responseData = JSON.parse(responseData);
              if (
                responseData.hasOwnProperty("Response") &&
                responseData.Response.hasOwnProperty("Data")
              ) {
                if (
                  responseData.Response.Data == null &&
                  responseData.Response.hasOwnProperty("Status") &&
                  responseData.Response.Status == 2
                ) {
                  failureHandler(
                    url,
                    200,
                    responseData.Response.Message,
                    errorCallback
                  );
                  return;
                }
                responseData = responseData.Response.Data;
              }
              break;
          }
          if (typeof callback === "function") callback(responseData);
        };
  
        var failureHandler = function(url, status, statusText, errorCallback) {
          log.error(
            "Onvida.sendRequest(" +
              url +
              ") - Failure(" +
              status +
              "): " +
              statusText
          );
          if (typeof errorCallback === "function")
            errorCallback(status, statusText);
        };
  
        xmlHTTP.onreadystatechange = function() {
          if (xmlHTTP.readyState != 4) return;
          if (xmlHTTP.status == 200 || xmlHTTP.status == 304) {
            successHandler(
              url,
              xmlHTTP.response,
              xmlHTTP.responseType,
              callback,
              errorCallback
            );
          } else {
            failureHandler(
              url,
              xmlHTTP.status,
              xmlHTTP.statusText,
              errorCallback
            );
          }
        };
        try {
          //XDomainRequest
          if (xmlHTTP + "" == "[object XDomainRequest]") {
            log.debug("Onvida.sendRequest(" + url + ") - Using XDomainRequest");
            xmlHTTP.onload = function() {
              successHandler(
                url,
                xmlHTTP.response,
                xmlHTTP.responseType,
                callback,
                errorCallback
              );
            };
            xmlHTTP.onerror = xmlHTTP.ontimeout = function() {
              failureHandler(
                url,
                xmlHTTP.status,
                xmlHTTP.statusText,
                errorCallback
              );
            };
          }
        } catch (e) {
          failureHandler(url, e.number, e.message, errorCallback);
        }
  
        if (xmlHTTP.readyState == 4) return;
        xmlHTTP.send(utils.createQS(postData));
      },
  
      createSessionIFrame: function() {
        if (this.iFrame == null) {
          log.debug("Onvida.createSessionIFrame()");
          this.iFrame = document.createElement("iframe");
          this.iFrame.width = 0;
          this.iFrame.height = 0;
          this.iFrame.sandbox = "allow-same-origin allow-scripts";
          this.iFrame.style.display = "none";
          this.iFrame.src =
            this.apiBase +
            "Chat/GetClientSession?key=" +
            encodeURIComponent(this.embedAccessKey);
          document.body.appendChild(this.iFrame);
        }
      },
  
      getRoot: function() {
        if (utils.isHTMLElement(this.root)) return this.root;
  
        if (typeof this.root === "string") {
          var selector = this.root;
          this.root =
            selector.trim() != "" ? document.querySelector(selector) : null;
          if (utils.isHTMLElement(this.root)) return this.root;
          else log.warn("Unable to find Onvida root: " + selector);
        }
  
        var elem = document.getElementById("onvida");
        if (elem == null) {
          elem = document.createElement("div");
          elem.id = "onvida";
          if (
            document.head.innerHTML
              .toLowerCase()
              .indexOf(this.scriptSrc.toLowerCase()) != -1
          ) {
            document.body.appendChild(elem);
          } else {
            var embedScript = document.querySelector(
              'script[src*="' + this.scriptSrc + '"]'
            );
            embedScript =
              embedScript == null
                ? document.querySelector(
                    'script[src*="' + this.scriptSrc.toLowerCase() + '"]'
                  )
                : embedScript;
            if (embedScript == null) document.body.appendChild(elem);
            else embedScript.insertAdjacentElement("afterend", elem);
          }
        }
        this.root = elem;
        return this.root;
      },
  
      getEmbedConfig: function(initial, callback) {
        log.debug(
          "Onvida.getEmbedConfig(" + initial + ", " + this.embedAccessKey + ")"
        );
        if (this.embedAccessKey != null) {
          var self = this;
          this.sendRequest(
            "Chat/GetEmbedConfig",
            { embedAccessKey: this.embedAccessKey },
            function(response) {
              self.client = response.Client;
              self.env = response.Environment;
              self.queueID = response.QueueID;
              self.modules = response.Modules;
              self.ready = true;
  
              var vivrIndex = utils.getArrayIndex(self.modules, "VIVR", "Name");
              var vivrIsPrimary = vivrIndex != -1;
              if (self.bypassVIVR && vivrIsPrimary && self.modules.length > 1) {
                self.modules.splice(vivrIndex, 1);
                vivrIsPrimary = false;
              }
  
              if (initial) {
                self.getRoot();
                self.initLaunchButtons();
                loader.loadQueueAddCSS("Onvida.css");
                if (self.skin != null) {
                  var skinClass = self.uiPrefix + "-skin-" + self.skin;
                  self.getRoot().classList.add(skinClass);
                  loader.loadQueueAddCSS(
                    "skins/Onvida-Skin-" + self.skin + ".css"
                  );
                }
  
                loader.loadQueueExecute(function(data) {
                  for (var i = 0; i < self.launchButtons.length; i++) {
                    var btn = self.launchButtons[i];
                    if (vivrIsPrimary) {
                      if (btn.module == "VIVR")
                        btn.classList.remove(self.uiPrefix + "-hidden");
                      else btn.classList.add(self.uiPrefix + "-hidden");
                    }
                    if (btn.openLabel != null) btn.setAttribute("style", "");
                  }
                  if (typeof self.onReady === "function") self.onReady();
                  if (self.autoInitialize) self.loadModules(initial);
                });
              }
              if (typeof callback === "function") callback();
            },
            function(errorCode, message) {
              console.error(
                "Onvida.getEmbedConfig() - Failure(" + errorCode + "): " + message
              );
            }
          );
        }
      },
  
      initLaunchButtons: function() {
        var self = this;
        this.launchButtons = document.querySelectorAll(".onv-open-btn");
        for (var i = 0; i < this.launchButtons.length; i++) {
          var launchButton = this.launchButtons[i];
          launchButton.module = launchButton.getAttribute(
            "data-" + this.uiPrefix + "-module"
          );
          launchButton.module =
            launchButton.module == "" ? null : launchButton.module;
          launchButton.openLabel = launchButton.getAttribute(
            "data-" + this.uiPrefix + "-open-label"
          );
          launchButton.closeLabel = launchButton.getAttribute(
            "data-" + this.uiPrefix + "-close-label"
          );
          if (
            launchButton.openLabel != null &&
            launchButton.closeLabel != null &&
            launchButton.innerHTML == ""
          ) {
            launchButton.innerHTML =
              "<span>" +
              launchButton.openLabel +
              "</span><span>" +
              launchButton.closeLabel +
              "</span>";
            launchButton.title = launchButton.openLabel;
            launchButton.style.opacity = 0;
          }
          launchButton.addEventListener("click", function(e) {
            e.preventDefault();
            var btn = e.target.classList.contains(self.uiPrefix + "-open-btn")
              ? e.target
              : e.target.closest("." + self.uiPrefix + "-open-btn");
            if (btn.classList.contains(self.uiPrefix + "-open"))
              self.close(btn.module);
            else {
              utils.initAudio();
              self.launch(btn.module);
            }
          });
        }
      },
  
      launch: function(moduleName, callback) {
        var self = this;
        var moduleDefined =
          typeof moduleName === "string" &&
          moduleName != "" &&
          moduleName != null;
        if (!moduleDefined && utils.isInArray(this.modules, "VIVR", "Name")) {
          moduleName = "VIVR";
          moduleDefined = true;
        }
        for (var i = 0; i < this.launchButtons.length; i++) {
          var btn = this.launchButtons[i];
          if ((moduleDefined && btn.module == moduleName) || !moduleDefined) {
            btn.classList.add("onv-open");
            btn.title = btn.closeLabel == null ? btn.title : btn.closeLabel;
          }
        }
        this.loadModules(moduleName, true, function() {
          if (typeof callback === "function") callback();
          self.getRoot().classList.remove("onv-hidden");
        });
      },
  
      close: function(moduleName) {
        var moduleDefined =
          typeof moduleName === "string" &&
          moduleName != "" &&
          moduleName != null;
        if (!moduleDefined && utils.isInArray(this.modules, "VIVR", "Name")) {
          moduleName = "VIVR";
          moduleDefined = true;
        }
        for (var i in this.modules) {
          if (
            (moduleDefined && this.modules[i].Name == moduleName) ||
            !moduleDefined
          ) {
            this[this.modules[i].Name].close();
            this[this.modules[i].Name].ui.moduleRoot.classList.add("onv-hidden");
            this.onModuleClosed(this.modules[i].Name);
          }
        }
        for (var i = 0; i < this.launchButtons.length; i++) {
          var btn = this.launchButtons[i];
          if ((moduleDefined && btn.module == moduleName) || !moduleDefined) {
            btn.classList.remove("onv-open");
            btn.title = btn.openLabel == null ? btn.title : btn.openLabel;
          }
        }
      },
  
      loadModules: function(moduleName, autoRun, callback) {
        if (this.ready) {
          var self = this;
          var moduleDefined =
            typeof moduleName === "string" &&
            moduleName != "" &&
            moduleName != null;
          if (!moduleDefined && utils.isInArray(this.modules, "VIVR", "Name")) {
            moduleName = "VIVR";
            moduleDefined = true;
          }
          if (moduleDefined) {
            var module = utils.getObjectFromArray(
              this.modules,
              moduleName,
              "Name"
            );
            if (module == null) {
              module = {
                Name: moduleName,
              };
              this.modules.push(module);
            }
          }
  
          for (var i in this.modules) {
            if (
              (moduleDefined && this.modules[i].Name == moduleName) ||
              !moduleDefined
            ) {
              var module = this.modules[i];
              log.debug("Onvida.loadModules(" + module.Name + ")");
              this.queueModuleAssets(module.Name);
            }
          }
  
          loader.loadQueueExecute(function(data) {
            self.initialModuleLoad = false;
            if (typeof self.onModulesLoaded === "function") {
              self.onModulesLoaded(data);
            }
            self.initModules(moduleName, autoRun, data, callback);
          }, true);
        }
      },
  
      queueModuleAssets: function(name) {
        if (!this.hasOwnProperty(name) || this[name] == null) {
          switch (name) {
            case "Chat":
          // Check for jQuery
              if (typeof ($) !== "function") {
                loader.loadQueueAdd(
              this.apiBase + "CommonContent/js._3rdParty.jquery.%5Ejquery.min.js",
              loader.FileTypes.JS
            );
              }
              loader.loadQueueAdd(
            this.apiBase + "CommonContent/js._3rdParty.jquery.jquery.signalR-2.4.0.js",
            loader.FileTypes.JS
          );
              loader.loadQueueAdd(
            this.apiBase + "signalr/hubs",
            loader.FileTypes.JS
          );
              loader.loadQueueAddCSS("Onvida-Chat.css");
          loader.loadQueueAddHTML("Onvida-Chat.html", this.getRoot());
          loader.loadQueueAdd(
            this.apiBase + "Content/js/3rdparty/twilio-common.min.js",
            loader.FileTypes.JS
          );
          loader.loadQueueAdd(
            this.apiBase + "Content/js/3rdparty/twilio-video.min.js",
            loader.FileTypes.JS
          );
          loader.loadQueueAdd(
            this.apiBase + "Content/js/3rdparty/twilio-chat.min.js",
            loader.FileTypes.JS
          );
          loader.loadQueueAddJS("lib/EventManager.js");
          loader.loadQueueAddJS("lib/ChatClientEnums.js");
          loader.loadQueueAddJS("lib/ChatClient.js");
          loader.loadQueueAddJS("lib/OnvidaChatHub.js");
          loader.loadQueueAddJS("lib/OnvidaChatClient.js");
          loader.loadQueueAddJS("lib/TwilioChatClient.js");
          loader.loadQueueAddJS("Onvida-Chat.js");
          break;
        case "VIVR":
          loader.loadQueueAddCSS("Onvida-VIVR.css");
          loader.loadQueueAddHTML("Onvida-VIVR.html", this.getRoot());
          loader.loadQueueAddJS("Onvida-VIVR.js");
          break;
          }
        }
      },
  
      initModules: function(moduleName, autoRun, data, callback) {
        var moduleDefined =
          typeof moduleName === "string" &&
          moduleName != "" &&
          moduleName != null;
        if (!moduleDefined && utils.isInArray(this.modules, "VIVR", "Name")) {
          moduleName = "VIVR";
          moduleDefined = true;
        }
        for (var i in this.modules) {
          if (
            (moduleDefined && this.modules[i].Name == moduleName) ||
            !moduleDefined
          ) {
            var module = this.modules[i];
            if (autoRun) {
              this[module.Name].init(module);
              this.onModuleOpened(module.Name);
            }
          }
        }
  
        if (typeof callback === "function") callback(data);
      },
    };
  
  if (!window.console)
    window.console = {
      log: function() {},
      info: function() {},
      warn: function() {},
      error: function() {},
      dir: function() {},
    };

  /* Logger */
  var log = {
    LogLevels: Object.freeze({
      OFF: 0,
      DEBUG: 1,
      INFO: 2,
      WARN: 3,
      ERROR: 4,
    }),
    logLevel: 0,

    log: function(message, level) {
      if (typeof message == "object") {
        console.log("ONV: Object " + JSON.stringify(message, null, "\t"));
      } else {
        message = "ONV: " + message;
        switch (level) {
          case this.LogLevels.DEBUG:
          default:
            console.log(message);
            break;
          case this.LogLevels.INFO:
            console.info(message);
            break;
          case this.LogLevels.WARN:
            console.warn(message);
            break;
          case this.LogLevels.ERROR:
            console.error(message);
            break;
        }
      }
    },

    debug: function(message, level) {
      if (this.logLevel != this.LogLevels.OFF) {
        if (typeof level == "undefined") {
          level = this.LogLevels.DEBUG;
        }
        if (level >= this.logLevel) {
          this.log(message, level);
        }
      }
    },

    info: function(message) {
      this.debug(message, this.LogLevels.INFO);
    },

    warn: function(message) {
      this.debug(message, this.LogLevels.WARN);
    },

    error: function(message, filename, lineno, colno) {
      var error;
      if (message instanceof ErrorEvent) {
        error = message;
      } else {
        error = {
          message: message,
          filename: filename,
          lineno: lineno,
          colno: colno,
        };
      }
      this.debug(error.message, this.LogLevels.ERROR);
      this.errorNotify(error);
    },

    errorNotify: function(error) {
      try {
        var context = utils.getContext();

        var unknownSrc =
          typeof error.filename == "undefined" ||
          error.filename == null ||
          error.filename == "";
        var sendEmail = false;
        if (
          unknownSrc ||
          error.filename.toLowerCase().indexOf(context.APIBase) != -1
        ) {
          sendEmail = true;
        }
        if (error.message == "Script error.") sendEmail = false;

        if (sendEmail) {
          if (error.message.indexOf("JSError/LogJSError") == -1) {
            var errSummary = unknownSrc
              ? error.message
              : error.message +
                ", " +
                utils.getPagePath(error.filename) +
                ", line " +
                error.lineno +
                ", col " +
                error.colno;
            Onvida.sendRequest(
              "JSError/LogJSError",
              {
                message: errSummary,
                details: JSON.stringify(context),
              },
              function(response) {
                log.debug("utils.errorNotify() - Success");
              },
              function(errorCode, message) {
                console.error(
                  "utils.errorNotify() - Failure(" + errorCode + "): " + message
                );
              }
            );
          }
        }
      } catch (e) {
        console.error(e);
      }
    },
  };

  /* Common Utilities */
  var utils = {
    audioPlayer: null,
    audioPath: "https://s3.amazonaws.com/QCentral_Common/",
    supportsTouch: false,
    currScriptSrc: document.currentScript ? document.currentScript.src : null,
    parseScript: function(srcName) {
      if (
        !this.currScriptSrc ||
        typeof Onvida.libBase == "undefined" ||
        Onvida.libBase == null
      ) {
        if (!this.currScriptSrc) {
          var embedScript = document.querySelector(
            'script[src*="' + srcName + '"]'
          );
          if (embedScript) this.currScriptSrc = embedScript.src;
        }
        if (this.currScriptSrc) {
          var scriptURL = this.getURL(this.currScriptSrc);
          var qs = this.getQS(this.currScriptSrc);
          var libBase = this.currScriptSrc.split("?")[0];
          this.parseVersion(libBase);
          libBase = libBase.substring(0, libBase.lastIndexOf("/"));
          Onvida.libBase = libBase.substring(0, libBase.lastIndexOf("/") + 1);
          Onvida.apiBase = "https://" + scriptURL.host + "/";
          Onvida.embedAccessKey = qs.key;
          Onvida.skin = qs.skin;
        }
      }
    },

    getURL: function(href) {
      try {
        return new URL(href);
      } catch (e) {
        var match = href.match(
          /^(https?\:)\/\/(([^:\/?#]*)(?:\:([0-9]+))?)([\/]{0,1}[^?#]*)(\?[^#]*|)(#.*|)$/
        );
        return (
          match && {
            href: href,
            protocol: match[1],
            host: match[2],
            hostname: match[3],
            port: match[4],
            pathname: match[5],
            search: match[6],
            hash: match[7],
          }
        );
      }
    },

    getServiceURL: function(url) {
      var serviceURL =
        url.indexOf("https:") == 0 || url.indexOf("http:") == 0
          ? url
          : Onvida.apiBase + url;
      serviceURL +=
        (serviceURL.indexOf("?") == -1 ? "?" : "&") +
        "sessionID=" +
        encodeURIComponent(Onvida.sessionID);
      serviceURL +=
        (serviceURL.indexOf("?") == -1 ? "?" : "&") +
        "key=" +
        encodeURIComponent(Onvida.embedAccessKey);
      return serviceURL;
    },

    parseVersion: function(url) {
      url = url.substring(0, url.lastIndexOf("/"));
      var urlParts = url.split("/");
      var versionPath = urlParts[urlParts.length - 2].toLowerCase();
      var regex = /latest|^(p|v)\d\.\d\.\d/gi;
      var vObj = {
        version: "latest",
        type: "Stable",
        major: Number.MAX_SAFE_INTEGER,
        minor: 0,
        patch: 0,
        hotfix: 0,
      };
      if (regex.test(versionPath)) {
        var versionParts = new Array();
        if (versionPath == "latest") {
          versionParts =
            Onvida.release == null ? versionParts : Onvida.release.split(".");
        } else {
          vObj.type = versionPath.charAt(0) == "v" ? "Stable" : "Pre-Release";
          versionParts = versionPath.substring(1).split(".");
        }
        if (versionParts.length > 0) {
          vObj.major = versionParts[0];
          vObj.minor = versionParts.length > 1 ? versionParts[1] : vObj.minor;
          vObj.patch = versionParts.length > 2 ? versionParts[2] : vObj.patch;
          vObj.hotfix = versionParts.length > 3 ? versionParts[3] : vObj.hotfix;
        }
        if (vObj.major != Number.MAX_SAFE_INTEGER) {
          vObj.version = [vObj.major, vObj.minor, vObj.patch, vObj.hotfix].join(
            "."
          );
        }
      }
      Onvida.release = vObj;
    },

    getEnumKey: function(enumType, value) {
      for (prop in enumType) {
        if (enumType[prop] == value) {
          return prop;
        }
      }
    },

    getClient: function(){
    	return Onvida.client != null
            ? Onvida.client
            : Onvida.embedAccessKey != null &&
              Onvida.embedAccessKey.split("-").length == 4
            ? Onvida.embedAccessKey.split("-")[0].toUpperCase()
            : "Unknown";
    },

    getContext: function(scriptSrc) {
      this.parseScript(scriptSrc);
      return {
        Client:
          this.getClient(),
        Environment:
          Onvida.env != null
            ? Onvida.env
            : Onvida.embedAccessKey != null &&
              Onvida.embedAccessKey.split("-").length == 4
            ? Onvida.embedAccessKey.split("-")[1].toUpperCase()
            : "Unknown",
        EmbedAccessKey: Onvida.embedAccessKey,
        SessionID: Onvida.sessionID,
        CurrentURL: document.URL,
        ScriptURL: this.currScriptSrc,
        APIBase: Onvida.apiBase,
        LibBase: Onvida.libBase,
        Vendor: navigator.vendor,
        Browser: navigator.appName,
        BrowserVersion: navigator.appVersion,
        UserAgent: navigator.userAgent,
        Platform: navigator.platform,
        Language: navigator.language,
        CookiesEnabled: navigator.cookieEnabled,
      };
    },

    eventDown: function() {
      return this.supportsTouch && this.isMobileDevice()
        ? "touchstart"
        : "mousedown";
    },
    eventMove: function() {
      return this.supportsTouch && this.isMobileDevice()
        ? "touchmove"
        : "mousemove";
    },
    eventUp: function() {
      return this.supportsTouch && this.isMobileDevice()
        ? "touchend"
        : "mouseup";
    },

    isWebRTCSupported: function() {
      var supported = false;
      [
        "RTCPeerConnection",
        "webkitRTCPeerConnection",
        "mozRTCPeerConnection",
        "RTCIceGatherer",
      ].forEach(function(item) {
        if (supported) {
          return;
        }

        if (item in window) {
          supported = true;
        }
      });
      return supported;
    },

    isMobileDevice: function() {
      return (
        typeof window.orientation !== "undefined" ||
        navigator.userAgent.indexOf("IEMobile") !== -1
      );
    },

    getIOSVersion: function() {
      if (!this.isIOS()) {
        return -1;
      }
      var v = navigator.appVersion.match(/OS (\d+)_(\d+)_?(\d+)?/);
      return [parseInt(v[1], 10), parseInt(v[2], 10), parseInt(v[3] || 0, 10)];
    },

    isIOS: function() {
      return /iPhone|iPad|iPod/i.test(navigator.userAgent);
    },

    isAndroid: function() {
      return /Android/i.test(navigator.userAgent);
    },

    isBrowser: function(name) {
      switch (name.toLowerCase()) {
        case "opera":
          return (
            (!!window.opr && !!opr.addons) ||
            !!window.opera ||
            navigator.userAgent.indexOf(" OPR/") >= 0
          );
        case "firefox":
          return typeof InstallTrigger !== "undefined";
        case "safari":
          return (
            /constructor/i.test(window.HTMLElement) ||
            (function(p) {
              return p.toString() === "[object SafariRemoteNotification]";
            })(
              !window["safari"] ||
                (typeof safari !== "undefined" && safari.pushNotification)
            )
          );
        case "msie":
          return /*@cc_on!@*/ false || !!document.documentMode;
        case "edge":
          return (
            !/*@cc_on!@*/ (false || !!document.documentMode) &&
            !!window.StyleMedia
          );
        case "chrome":
          return !!window.chrome && !!window.chrome.webstore;
      }
      return false;
    },

    getQS: function(url) {
      var qs;
      var qso = new Object();
      if (!url) {
        qs = location.search.substring(1).split("&");
      } else {
        if (url.indexOf("?") == -1) {
          qs = new Array();
        } else {
          qs = url.substring(url.indexOf("?") + 1).split("&");
        }
      }
      for (var i = 0; i < qs.length; i++) {
        var pair = qs[i].split("=");
        if (pair.length == 2) {
          qso[pair[0]] = decodeURIComponent(pair[1]);
        }
      }
      return qso;
    },

    getQSValue: function(param, url) {
      var qs = this.getQS(url);
      if (qs.hasOwnProperty(param)) {
        return qs.param;
      }
      return null;
    },

    createQS: function(params) {
      var pairs = new Array();
      for (var i in params) {
        if (Object.prototype.toString.call(params[i]) === "[object Array]") {
          pairs.push(encodeURIComponent(i) + "=" + params[i].join("+"));
        } else if (
          params[i] != null &&
          Object.prototype.toString.call(params[i]) === "[object Object]"
        ) {
          pairs.push(
            encodeURIComponent(i) +
              "=" +
              encodeURIComponent(JSON.stringify(params[i]))
          );
        } else if (params[i] != null) {
          pairs.push(
            encodeURIComponent(i) + "=" + encodeURIComponent(params[i])
          );
        }
      }
      return pairs.join("&");
    },

    initUIElements: function(module, uiClasses, ui) {
      if (typeof ui == "undefined" || ui == null) ui = {};
      ui.errors = new Array();
      var moduleCssQuery = "." + Onvida.uiPrefix + "-module-" + module;
      ui["moduleRoot"] = Onvida.root.querySelector(moduleCssQuery);
      if (typeof ui["moduleRoot"] == "undefined" || ui["moduleRoot"] == null) {
        Onvida.Log.warn("Missing Module Root DOM Element: " + moduleCssQuery);
        ui["moduleRoot"] = null;
        ui.errors.push("moduleRoot");
      } else {
        for (var i in uiClasses) {
          var cssName = uiClasses[i];
          var jsName = this.getJSName(cssName);
          var cssQuery =
            moduleCssQuery + " ." + Onvida.uiPrefix + "-" + cssName;
          ui[jsName] = Onvida.root.querySelector(cssQuery);
          if (typeof ui[jsName] != "undefined" && ui[jsName] != null) {
            if (
              cssName.split("-")[0] == "btn" &&
              typeof ui[jsName].addEventListener === "function"
            ) {
              var label = ui[jsName].querySelector("SPAN");
              if (label != null && label.innerText != "")
                ui[jsName].setAttribute("title", label.innerText);
              ui[jsName].handler = this.getHandlerName(cssName, "click");
            }
          } else {
            Onvida.Log.warn("Missing DOM Element: " + cssQuery);
            ui[jsName] = null;
            ui.errors.push(jsName);
          }
        }
      }
      return ui;
    },

    getJSName: function(cssClass) {
      var parts = cssClass.split("-");
      var jsName = parts[0].toLowerCase();
      for (var i = 1; i < parts.length; i++) {
        jsName += this.toInitCaps(parts[i]);
      }
      return jsName;
    },

    getHandlerName: function(cssClass, eventType) {
      return (
        this.getJSName("e-" + cssClass) + this.toInitCaps(eventType) + "Handler"
      );
    },

    toInitCaps: function(value) {
      if (typeof value === "string" && value.length > 0) {
        if (value.length == 1) return value.toUpperCase();
        return value.charAt(0).toUpperCase() + value.substring(1).toLowerCase();
      }
      return value;
    },

    getFirstNameLastInitial: function(fullName) {
      var nameParts = fullName.split(" ");
      var firstName = this.toInitCaps(nameParts[0]);
      var lastName = "";
      var lastInitial = "";
      if (nameParts.length > 1) {
        lastName = this.toInitCaps(nameParts[nameParts.length - 1]);
        lastInitial = " " + lastName.charAt(0) + ".";
      }
      return firstName + lastInitial;
    },

    isHTMLElement: function(elem) {
      return (
        typeof elem != "undefined" &&
        elem != null &&
        typeof elem.innerHTML === "string"
      );
    },

    getObjectFromArray: function(array, search, propName) {
      var index = this.getArrayIndex(array, search, propName);
      if (index == -1) {
        return null;
      } else {
        return array[index];
      }
    },

    isInArray: function(array, search, propName) {
      return this.getArrayIndex(array, search, propName) != -1;
    },

    getArrayIndex: function(array, search, propName) {
      for (var i = 0; i < array.length; i++) {
        if (propName != null) {
          if (array[i][propName] == search) {
            return i;
          }
        } else if (array[i] == search) {
          return i;
        }
      }
      return -1;
    },

    getMethods: function (obj) {
    	var methods = new Array();
    	for (var i in obj) {
    		if (typeof obj[i] === 'function')
    			methods.push(obj[i]);
    	}
    	return methods;
    },

    getElementsByClassName:
      document.getElementsByClassName ||
      function(cn) {
        var allT = document.getElementsByTagName("*"),
          allCN = [],
          i = 0,
          a;
        while ((a = allT[i++]))
          a.className == cn ? (allCN[allCN.length] = a) : null;
        return allCN;
      },

    getPageName: function(urlStr) {
      if (typeof urlStr === "string" && urlStr.length > 0) {
        var url = this.getURL(urlStr);
        var pageName = url.pathname.split("/");
        pageName = pageName[pageName.length - 1].toLowerCase();
        if (pageName == "") {
          pageName = "index.html";
        }
        return pageName;
      }
      return "";
    },

    getPagePath: function(urlStr) {
      if (typeof urlStr === "string" && urlStr.length > 0) {
        var url = this.getURL(urlStr);
        var pagePath = url.pathname.split("/");
        pagePath.splice(pagePath.length - 1, 1);
        pagePath.push(this.getPageName(urlStr));
        return pagePath.join("/");
      }
      return "";
    },

    extend: function(el, attribs) {
      if (typeof el == "undefined" || el == null) el = {};
      for (var x in attribs) el[x] = attribs[x];
      return el;
    },

    getCurrentDate: function() {
      var currentdate = new Date();
      return this.formatDate(currentdate);
    },

    getCurrentTime: function() {
      var currentdate = new Date();
      return this.formatTime(currentdate);
    },

    convertServerDate: function(serverDate) {
      if (!serverDate) return null;
      var dateFormat = /\/Date\(.*\)\//gi;
      if (dateFormat.test(serverDate))
        return new Date(
          parseInt(serverDate.replace("/Date(", "").replace(")/", ""))
        );
      else return new Date(serverDate);
    },

    formatDate: function(dateObj) {
      var date =
        dateObj.getMonth() +
        1 +
        "/" +
        dateObj.getDate() +
        "/" +
        dateObj.getFullYear();
      return date;
    },

    formatTime: function(dateObj, excludeSeconds) {
      var hours = dateObj.getHours();
      var minutes = dateObj.getMinutes();
      var seconds = dateObj.getSeconds();
      var isPM = hours >= 12;
      hours = hours == 0 ? 12 : hours > 12 ? hours - 12 : hours;
      minutes = minutes < 10 ? (minutes == 0 ? "00" : "0" + minutes) : minutes;
      seconds = seconds < 10 ? (seconds == 0 ? "00" : "0" + seconds) : seconds;
      var time =
        hours +
        ":" +
        minutes +
        (excludeSeconds ? "" : ":" + seconds) +
        (isPM ? " PM" : " AM");
      return time;
    },

    linkify: function(text, targetSelf) {
      var url;
      var linkedURL;
      var pre = '<a href="';
      var mid = '" target="' + (targetSelf ? "_self" : "_blank") + '">';
      var post = "</a>";
      var linkedText = text;
      var protocols = ["http://", "https://"];

      for (var i = 0; i < protocols.length; i++) {
        var start = 0;
        var end;
        while (text.indexOf(protocols[i], start) != -1) {
          start = text.indexOf(protocols[i], start);
          end = text.indexOf(" ", start);
          if (end == -1) {
            url = text.substring(start);
          } else {
            url = text.substring(start, end);
          }
          linkedURL = pre + url + mid + url + post;
          linkedText = linkedText.replace(url, linkedURL);
          start++;
        }
      }
      return linkedText;
    },

    stripHTML: function(text) {
      var doc = new DOMParser().parseFromString(text, "text/html");
      return doc.body.textContent || "";
    },

    copy: function(text) {
      if (window.clipboardData && window.clipboardData.setData) {
        // IE specific code path to prevent textarea being shown while dialog is visible.
        return clipboardData.setData("onvida-clipboard-text", text);
      } else if (
        document.queryCommandSupported &&
        document.queryCommandSupported("copy")
      ) {
        var textarea = document.createElement("textarea");
        textarea.setAttribute("readonly", true);
        textarea.setAttribute("contenteditable", true);
        textarea.style.position = "fixed"; // Prevent scrolling to bottom of page in MS Edge.
        textarea.textContent = text;
        document.body.appendChild(textarea);
        textarea.select();
        var range = document.createRange();
        range.selectNodeContents(textarea);
        var selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        textarea.setSelectionRange(0, textarea.value.length);
        try {
          result = document.execCommand("copy"); // Security exception may be thrown by some browsers.
          return result;
        } catch (ex) {
          return false;
        } finally {
          document.body.removeChild(textarea);
        }
      }
    },

    print: function(text) {
      var printWin = window.open(
        "",
        "",
        "left=0,top=0,width=800,height=800,toolbar=0,scrollbars=0,status=0"
      );
      var self = this;
      if (self.isIOS()) {
        var header =
          '<html><head><meta name="viewport" content="width=device-width"><meta name="viewport" content="initial-scale=1.0"><title>Chat Transcript</title><body style="margin:0;padding:0"><div style="padding:5px 10px;background:#CCCCCC;text-align:center"><button style="font-size:18px" onclick="window.print()">Print</button></div><pre style="padding:10px;white-space: pre-wrap;word-break: keep-all">';
        var footer = "</pre></body></html>";
        text = header + text + footer;
      }
      window.setTimeout(function() {
        printWin.document.write(text);
        printWin.document.close();
        printWin.focus();
        if (!self.isIOS()) {
          printWin.print();
          printWin.close();
        }
      }, 500);
    },

    email: function(subject, body, recipient) {
      subject =
        typeof subject == "undefined" || typeof subject !== "string"
          ? ""
          : subject.trim();
      body =
        typeof body == "undefined" || typeof body !== "string"
          ? ""
          : body.trim();
      recipient =
        typeof recipient == "undefined" || typeof recipient !== "string"
          ? ""
          : recipient.trim();
      window.location.href =
        "mailto:" +
        encodeURIComponent(recipient) +
        "?subject=" +
        encodeURIComponent(subject) +
        "&body=" +
        encodeURIComponent(body);
    },

    download: function(name, url, content, type) {
      var blob;
      var objectURL;
      var isSafari = /constructor/i.test(window.HTMLElement) || window.safari;
      var isChromeIOS = /CriOS\/[\d]+/.test(navigator.userAgent);
      var isBlob = typeof content != "undefined" && content != null;
      var link = document.createElementNS("http://www.w3.org/1999/xhtml", "a");

      var urlFactory = function() {
        return window.URL || window.webkitURL || window;
      };

      var revoke = function(objURL) {
        window.setTimeout(function() {
          urlFactory().revokeObjectURL(objURL);
        }, 40000);
      };

      type = typeof type === "string" ? type : "text/plain;charset=utf-8";

      if (isBlob) {
        blob = new Blob([content], { type: type });
        if (
          /^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(
            blob.type
          )
        ) {
          blob = new Blob([String.fromCharCode(0xfeff), blob], {
            type: blob.type,
          });
        }
        objectURL = urlFactory().createObjectURL(blob);
      }

      try {
        if (
          isBlob &&
          typeof navigator !== "undefined" &&
          navigator.msSaveOrOpenBlob
        ) {
          navigator.msSaveOrOpenBlob(blob, name);
          return;
        }

        if ("download" in link) {
          link.href = isBlob ? objectURL : url;
          link.target = "_blank";
          link.download = name;
          var event = new MouseEvent("click");
          link.dispatchEvent(event);
          if (isBlob) {
            revoke(objectURL);
          }
          return;
        } else if (!isBlob) {
          var elem = document.createElement("iframe");
          elem.src = url;
          elem.style.display = "none";
          var body = document.getElementsByTagName("body")[0];
          elem.onload = function() {
            setTimeout(function() {
              body.removeChild(elem);
            }, 1000);
          };
          body.appendChild(elem);
          return;
        }

        if (isBlob) {
          if (
            (isChromeIOS || (isSafari && type == "application/octet-stream")) &&
            window.FileReader
          ) {
            var reader = new FileReader();
            reader.onloadend = function() {
              var url = isChromeIOS
                ? reader.result
                : reader.result.replace(
                    /^data:[^;]*;/,
                    "data:attachment/file;"
                  );
              var popup = window.open(url, "_blank");
              if (!popup) window.location.href = url;
            };
            reader.readAsDataURL(blob);
            return;
          }

          if (!objectURL) {
            objectURL = urlFactory().createObjectURL(blob);
          }

          if (type == "application/octet-stream") {
            window.location.href = objectURL;
          } else {
            var opened = window.open(objectURL, "_blank");
            if (!opened) {
              window.location.href = objectURL;
            }
          }
          revoke(objectURL);
        }
      } catch (e) {}
    },

    getDownloadFileName: function(filePrefix, extension) {
      var timeStamp = new Date();
      var timeStampMonth = timeStamp.getMonth() + 1;
      timeStampMonth =
        timeStampMonth < 10 ? "0" + timeStampMonth : timeStampMonth;
      var timeStampDay =
        timeStamp.getDate() < 10
          ? "0" + timeStamp.getDate()
          : timeStamp.getDate();

      var fileName = filePrefix;
      fileName +=
        "_" +
        timeStamp.getFullYear() +
        "-" +
        timeStampMonth +
        "-" +
        timeStampDay;
      fileName += "." + extension;

      return fileName;
    },

    getFileExtension: function(filename) {
      var ext = filename.split("?")[0].split(".");
      ext = ext[ext.length - 1].toLowerCase();
      return ext;
    },

    initAudio: function() {
      this.audioPlay("common-init");
    },

    audioPlay: function(filename) {
      if (this.audioPlayer == null) this.audioPlayer = new Audio();
      var fileType = this.audioPlayer.canPlayType("audio/mp3")
        ? ".mp3"
        : this.audioPlayer.canPlayType("audio/ogg")
        ? ".ogg"
        : null;
      if (fileType != null) {
        this.audioPlayer.src = this.audioPath + filename + fileType;
        this.audioPlayer.play();
      }
    },
  };

  /* Asset Loader */
  var loader = {
    FileTypes: Object.freeze({
      TEXT: 0,
      HTML: 1,
      CSS: 2,
      JS: 3,
      XML: 4,
    }),
    batches: new Array(),

    // Determine Asset File Type by File Extension
    getFileType: function(url) {
      url = url.toLowerCase().split("?")[0];
      if (url.indexOf(".css") != -1) {
        return this.FileTypes.CSS;
      } else if (url.indexOf(".js") != -1) {
        return this.FileTypes.JS;
      } else if (url.indexOf(".htm") != -1) {
        return this.FileTypes.HTML;
      } else if (url.indexOf(".xml") != -1) {
        return this.FileTypes.XML;
      }
      return this.FileTypes.TEXT;
    },

    appendVersionToURL: function(url) {
      var version = "v=";
      if (
        typeof Onvida.release === "object" &&
        Onvida.release.hasOwnProperty("major")
      ) {
        if (Onvida.release.major != Number.MAX_SAFE_INTEGER) {
          var vObj = Onvida.release;
          version +=
            vObj.major +
            "-" +
            vObj.minor +
            "-" +
            vObj.patch +
            "-" +
            vObj.hotfix +
            "-";
        }
      }
      version += new Date().getDate();
      url += (url.indexOf("?") == -1 ? "?" : "&") + version;
      return url;
    },

    // Load Asset File
    loadAsset: function(url, type, selector, insertFirst, callback) {
      var self = this;
      var elem;
      var elemParent = utils.isHTMLElement(selector)
        ? selector
        : typeof selector === "string" && selector.trim() != ""
        ? document.querySelector(selector)
        : null;
      var elemOnload = function(response) {
        self.loadComplete(url, response);
        if (typeof callback === "function") callback(response);
      };
      switch (type) {
        case this.FileTypes.CSS:
          elem = document.createElement("link");
          elem.onload = elemOnload;
          elem.rel = "stylesheet";
          elem.type = "text/css";
          elem.href = url;
          if (elemParent == null) elemParent = document.head;
          elemParent.insertAdjacentElement(
            insertFirst ? "afterbegin" : "beforeend",
            elem
          );
          break;
        case this.FileTypes.JS:
          elem = document.createElement("script");
          elem.onload = elemOnload;
          elem.type = "text/javascript";
          elem.crossOrigin = "anonymous";
          elem.src = url;
          if (elemParent == null) elemParent = document.head;
          elemParent.insertAdjacentElement(
            insertFirst ? "afterbegin" : "beforeend",
            elem
          );
          break;
        case this.FileTypes.HTML:
          if (elemParent == null) elemParent = document.body;
          Onvida.sendRequest(url, null, function(response) {
            elem = document.createElement("div");
            elem.innerHTML = response.trim();
            if (insertFirst === "replace")
              elemParent.innerHTML = elem.innerHTML;
            else {
              if (elem.firstChild != null && elem.firstChild.nodeType == 1) {
                elemParent.insertAdjacentElement(
                  insertFirst ? "afterbegin" : "beforeend",
                  elem.firstChild
                );
              } else {
                elemParent.insertAdjacentText(
                  insertFirst ? "afterbegin" : "beforeend",
                  elem.innerText
                );
              }
            }
            elemOnload();
          });
          break;
        case this.FileTypes.XML:
        case this.FileTypes.TEXT:
        default:
          Onvida.sendRequest(url, null, function(response) {
            elemOnload(response);
          });
          break;
      }
    },

    loadCSS: function(url, selector, insertFirst, callback) {
      this.loadAsset(url, this.FileTypes.CSS, selector, insertFirst, callback);
    },

    loadJS: function(url, selector, insertFirst, callback) {
      this.loadAsset(url, this.FileTypes.JS, selector, insertFirst, callback);
    },

    loadHTML: function(url, selector, insertFirst, callback) {
      this.loadAsset(url, this.FileTypes.HTML, selector, insertFirst, callback);
    },

    loadXML: function(url, selector, insertFirst, callback) {
      this.loadAsset(url, this.FileTypes.XML, selector, insertFirst, callback);
    },

    loadTEXT: function(url, selector, insertFirst, callback) {
      this.loadAsset(url, this.FileTypes.TEXT, selector, insertFirst, callback);
    },

    // Add Asset to Load Queue
    loadQueueAdd: function(url, type, selector, batchID) {
      var batch = this.getBatch(batchID);
      this.batches[batch.batchID].queue.push({
        selector: selector,
        url: this.appendVersionToURL(url),
        type: typeof type == "undefined" ? this.getFileType(url) : type,
        loaded: false,
      });
    },

    loadQueueAddCSS: function(fileName, selector, batchID) {
      this.loadQueueAdd(
        Onvida.libBase + "css/" + fileName,
        this.FileTypes.CSS,
        selector,
        batchID
      );
    },

    loadQueueAddHTML: function(fileName, selector, batchID) {
      this.loadQueueAdd(
        Onvida.libBase + "html/" + fileName,
        this.FileTypes.HTML,
        selector,
        batchID
      );
    },

    loadQueueAddJS: function(fileName, selector, batchID) {
      this.loadQueueAdd(
        Onvida.libBase + "js/" + fileName,
        this.FileTypes.JS,
        selector,
        batchID
      );
    },

    newBatch: function(queue, sequential, callback) {
      var batchID =
        new Date().getTime() + "-" + Math.ceil(Math.random() * 10000);
      this.batches[batchID] = {
        batchID: batchID,
        queue: typeof queue == "undefined" ? new Array() : queue,
        sequential: sequential === true,
        processing: false,
        complete: false,
        callback: typeof callback === "function" ? callback : null,
      };
      return this.batches[batchID];
    },

    getBatch: function(batchID) {
      var batch = null;
      if (typeof batchID != "undefined" && this.batches.hasOwnProperty(batchID))
        batch = this.batches[batchID];
      if (batch == null) {
        for (var i in this.batches) {
          if (!this.batches[i].complete && !this.batches[i].processing) {
            batch = this.batches[i];
            break;
          }
        }
      }
      if (batch == null) {
        batch = this.newBatch();
      }
      return batch;
    },

    // Execute Load Queue
    loadQueueExecute: function(callback, sequential, batchID) {
      var batch = this.getBatch(batchID);
      if (batch.queue.length == 0) {
        if (typeof callback === "function") {
          callback();
        }
      } else {
        batch.sequential = sequential === true;
        batch.callback = typeof callback === "function" ? callback : null;
        batch.processing = true;
        this.batches[batch.batchID] = batch;
        log.debug(
          "loader.batchExecute(" +
            batch.batchID +
            ") = " +
            batch.queue.length +
            " Assets"
        );
        if (batch.sequential) this.loadQueueNext(batch.batchID);
        else {
          for (var i = 0; i < batch.queue.length; i++) {
            var url = batch.queue[i].url;
            var type = batch.queue[i].type;
            var selector = batch.queue[i].selector;
            log.debug(
              "loader.loadQueueExecute(" +
                utils.getEnumKey(this.FileTypes, type) +
                ") - " +
                url
            );
            this.loadAsset(url, type, selector);
          }
        }
      }
    },

    loadQueueNext: function(batchID) {
      var batch = this.getBatch(batchID);
      var i = utils.getArrayIndex(batch.queue, false, "loaded");
      if (i != -1) {
        var url = batch.queue[i].url;
        var type = batch.queue[i].type;
        var selector = batch.queue[i].selector;
        log.debug(
          "loader.loadQueueNext(" +
            utils.getEnumKey(this.FileTypes, type) +
            ") - " +
            url
        );
        this.loadAsset(url, type, selector);
      }
    },

    // Load Queue Handler
    loadComplete: function(url, data) {
      for (var b in this.batches) {
        var urlIndex = utils.getArrayIndex(this.batches[b].queue, url, "url");
        if (urlIndex != -1) {
          this.batches[b].queue[urlIndex].loaded = true;
          var allLoaded = true;
          for (var i = 0; i < this.batches[b].queue.length; i++) {
            allLoaded &= this.batches[b].queue[i].loaded;
          }
          log.info(
            "loader.loadComplete(" +
              utils.getEnumKey(
                this.FileTypes,
                this.batches[b].queue[urlIndex].type
              ) +
              ") - " +
              url
          );
          if (allLoaded) {
            log.debug("loader.batchComplete(" + b + ")");
            this.batches[b].processing = false;
            this.batches[b].complete = true;
            if (typeof this.batches[b].callback === "function") {
              this.batches[b].callback(data);
            }
          } else if (this.batches[b].sequential) {
            this.loadQueueNext(b);
          }
        }
      }
    },
  };


  // Error Logging Listener
  window.addEventListener("error", function(e) {
    log.error(e);
  });

  // Determine if device uses touch events
  window.addEventListener(
    "touchstart",
    function onFirstTouch() {
      Onvida.Utils.supportsTouch = true;
      // we only need to know once that a human touched the screen, so we can stop listening now
      window.removeEventListener("touchstart", onFirstTouch, false);
    },
    false
  );

  // Cross Frame Post Messaging Listener
  window.addEventListener(
    "message",
    function(message) {
      if (message.origin + "/" !== Onvida.apiBase) {
        //log.warn('Unrecognized post message origin: ' + (message.origin + '/') + ' != ' + (Onvida.apiBase));
        return;
      }
      log.debug(
        "Message (" +
          message.origin +
          "): " +
          (typeof message.data === "string"
            ? message.data
            : JSON.stringify(message.data))
      );
      var packet = JSON.parse(message.data);
      if (packet.hasOwnProperty("request")) {
        switch (packet.request) {
          case "sessionID":
            //store the sessionID and then continue loading the page
            Onvida.sessionID = packet.data;
            Onvida.getEmbedConfig(true);
            break;
        }
      }
    },
    false
  );

  var domReady = false;

  // Page Ready and Loaded Listeners
  var domContentLoaded = function() {
    if (document.readyState === "complete") {
      if (document.addEventListener) {
        document.removeEventListener(
          "readystatechange",
          domContentLoaded,
          false
        );
        document.removeEventListener(
          "DOMContentLoaded",
          domContentLoaded,
          false
        );
        domReady = true;
        Onvida.init();
      } else if (document.attachEvent) {
        document.detachEvent("onreadystatechange", domContentLoaded);
        domReady = true;
        Onvida.init();
      }
    }
  };

  if (document.readyState === "complete") {
    domReady = true;
    Onvida.init();
  } else if (document.addEventListener) {
    document.addEventListener("readystatechange", domContentLoaded, false);
    document.addEventListener("DOMContentLoaded", domContentLoaded, false);
  } else if (document.attachEvent)
    document.attachEvent("onreadystatechange", domContentLoaded);
})();