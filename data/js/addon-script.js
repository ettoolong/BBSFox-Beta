// Coding-style-guide
// https://github.com/mozilla/addon-sdk/wiki/Coding-style-guide

let {Cc, Ci} = require("chrome");
let {modelFor} = require("sdk/model/core");
let {viewFor} = require("sdk/view/core");

let self = require("sdk/self");
let data = self.data;
let tabs = require("sdk/tabs");
let windows = require("sdk/windows").browserWindows;
let tabUtils = require("sdk/tabs/utils");
let winUtils = require("sdk/window/utils");
let sp = require("sdk/simple-prefs");
let cm = require("sdk/context-menu");
let _ = require("sdk/l10n").get;
let system = require("sdk/system");
let aboutPage;

//let alertsService = Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
let notifications = require("sdk/notifications");
let soundService = Cc["@mozilla.org/sound;1"].createInstance(Ci.nsISound);

let bbsfoxAPI = require("./bbsfox-api.js");
let bbsfoxAbout = require("./bbsfox-about.js");
let bbsfoxBg = require("./bbsfox-bg.js");

// preferences page - start
sp.on("openPrefsTab", () => {
  // open XUL windows for preferences page.
  // need porting preferences page to pure HTML later.
  let wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
  let ww = Cc["@mozilla.org/embedcomp/window-watcher;1"].getService(Ci.nsIWindowWatcher);
  let existing = wm.getMostRecentWindow("bbsfox:options");
  if (existing) {
    try{
      existing.focus();
    }
    catch (e) {}
  }
  else {
    ww.openWindow(null, "chrome://bbsfox/content/options.xul", "_blank", "chrome,centerscreen,dialog=no", {wrappedJSObject: {}});
  }

  // TODO: Make options page with HTML
  // see: https://github.com/Noitidart/l10n/tree/html-options

  // open html page in dialog.
  // let optionsDlg = require(data.url("js/optionsDlg.js")).optionsDlg;
  // optionsDlg.open(data.url('html/options.xhtml'));

  // open html page in tab
  // tabs.open({
  //   url: 'chrome://bbsfox/content/options.html',
  //   onOpen: function(tab){
  //     //console.log('onOpen');
  //   },
  //   onReady: function(tab){
  //     //console.log('onReady');
  //   },
  //   onLoad: function(tab){
  //     console.log('onLoad');
  //     tab.title = 'test';
  //   }
  // });
});

sp.on("openUserManual", () => {
  tabs.open({
    url: "chrome://bbsfox/locale/help.html"
  });
});

sp.on("reportBug", () => {
  tabs.open({
    url: "https://github.com/ettoolong/BBSFox-E10S/issues"
  });
});
// preferences page - end

let bbstabs = {
  tempFiles: [],
  eventMap: new Map(),
  urlCheck : /(^(telnet|ssh):\/\/)/i,
  os: system.platform,

  handleCoreCommand: function(message) {

    //must make sure command from BBS page.
    let data = message.data;
    switch (data.command) {
      case "updateTabIcon": {
        tabUtils.getTabForBrowser( message.target ).image = message.data.icon;
        break;
      }
      case "openNewTabs":
        this.openNewTabs(data.urls, data.ref, data.charset, data.loadInBg);
        break;
      case "resetStatusBar":
        this.resetStatusBar( message.target );
        break;
      case "updateEventPrefs": {
        tabUtils.getTabForBrowser( message.target ).eventPrefs = data.eventPrefs;
        break;
      }
      case "writePrefs":
        this.writePrefs(data.branchName, data.name, data.vtype, data.value);
        break;
      case "removeStatus": {
        //tabUtils.getTabForBrowser( message.target ).eventPrefs;
        let tab = tabUtils.getTabForBrowser( message.target );
        if(tab) {
         delete tab.eventPrefs;
         delete tab.eventStatus;
        }
        break;
      }
      case "frameScriptReady": {
        let xulTab = tabUtils.getTabForBrowser(message.target);
        if(xulTab.selected)
          bbstabs.setBBSCmd("setTabSelect", message.target );

        //console.log("handleCoreCommand: frameScriptReady");
        // //sendAsyncMessage("bbsfox@ettoolong:bbsfox-overlayEvent", {});
        // let id = tabUtils.getTabId(tabUtils.getTabForBrowser( message.target ));
        // message.target.messageManager.sendAsyncMessage("bbsfox@ettoolong:bbsfox-overlayEvent", {command:'updateId', id: id});
        break;
      }
      case "loadAutoLoginInfo":
        this.loadAutoLoginInfo(data.querys, message.target);
        break;
      case "openEasyReadingTab":
        this.openEasyReadingTab(data.htmlData, message.target);
        break;
      case "openFilepicker":
        this.openFilepicker(data, message.target);
        break;
      case "pushThreadDlg":
        this.pushThreadDlg(data, message.target);
        break;
      case "showNotifyMessage":
        this.showNotifyMessage(data, message.target);
        break;
      case "fireNotifySound":
        this.playNotifySound();
        break;
      default:
        break;
    }
  },

  resetStatusBar: function(target) {
    let xulTab = tabUtils.getTabForBrowser( target );
    let chromeWindow = tabUtils.getOwnerWindow(xulTab);
    let aDOMWindow = chromeWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
    aDOMWindow.XULBrowserWindow.setOverLink('');
  },

  loadAutoLoginInfo: function(querys, target) {
    let result = {};
    for(let query of querys){
      try{
        let logins = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager).findLogins({}, query.url, query.ds, null);
        if(logins.length) {
          result[query.protocol] = { userName: logins[0]["username"], password: logins[0]["password"] };
        } else {
          result[query.protocol] = { userName: '', password: '' };
        }
      }catch(ex){
        result[query.protocol] = { userName: '', password: '' };
      }
    }
    let key_entries;
    if(result.ssh) {
      key_entries = [];
    }
    this.setBBSCmdEx({command: "loginInfoReady", result: result, hostkeys: key_entries}, target);
  },

  openEasyReadingTab: function(htmlData, target) {
      let filetmp = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("TmpD", Ci.nsIFile);
      filetmp.append("easyreading.htm");
      filetmp.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0o666);
      let ostream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
      ostream.init(filetmp, -1, -1, 0);
      let converter = Cc["@mozilla.org/intl/converter-output-stream;1"].createInstance(Ci.nsIConverterOutputStream);
      converter.init(ostream, "UTF-8", 0, 0);
      converter.writeString(htmlData);
      converter.flush();
      converter.close();
      let tempURI = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService).newFileURI(filetmp).spec;
      this.openNewTabs([tempURI], null, "UTF-8", true);
      bbstabs.tempFiles.push(filetmp);
  },

  pushThreadDlg: function(data, target) {
    let xulTab = tabUtils.getTabForBrowser( target );
    let chromeWindow = tabUtils.getOwnerWindow(xulTab);
    let aDOMWindow = chromeWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);

    let EMURL = "chrome://bbsfox/content/pushThread.xul";
    let EMFEATURES = "chrome, dialog=yes, resizable=yes, modal=yes, centerscreen";
    let retVals = { exec: false, pushText: data.pushText, lineLength: data.lineLength};
    let retVals2 = [];
    aDOMWindow.openDialog(EMURL, "", EMFEATURES, retVals, retVals2);
    if(retVals.exec) {
      this.setBBSCmdEx({command:"sendPushThreadText",
                        sendText:retVals2,
                        temp:""
                      }, target);
    }
    else
    {
      this.setBBSCmdEx({command:"sendPushThreadText",
                        temp: retVals.pushText
                      }, target);
    }
  },

  showNotifyMessage: function(data, target){
    let msg = {
      iconURL: data.imageUrl,
      title: data.title,
      text: data.text,
      onClick: function () {
        //console.log(data);
      }
    };
    if(data.textClickable) {
      msg.onClick =function () {
        bbstabs.setTabFocus(target);
        if(data.replyString) {
          bbstabs.setBBSCmdEx({command:"sendText", text: data.replyString}, target);
        }
      }
    }
    notifications.notify(msg);
  },

  playNotifySound: function(){
    if(soundService) {
      soundService.beep();
    }
  },

  setTabFocus: function(target) {
    let xulTab = tabUtils.getTabForBrowser( target );
    tabUtils.activateTab(xulTab, tabUtils.getOwnerWindow(xulTab));
  },

  openFilepicker: function(data, target) {
    let xulTab = tabUtils.getTabForBrowser( target );
    let chromeWindow = tabUtils.getOwnerWindow(xulTab);
    let aDOMWindow = chromeWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);

    let title = data.title;
    let mode = data.mode;
    let extension = data.defaultExtension;
    let defaultStr = data.defaultString;
    let filters = data.appendFilters;
    let writeData = data.saveData;
    let convertUTF8 = data.convertUTF8;
    let utf8BOM = data.utf8BOM;
    let postCommand = data.postCommand;

    let nsIFilePicker = Ci.nsIFilePicker;
    let fileChooser = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
    fileChooser.init(aDOMWindow, title, mode);
    if(extension)
      fileChooser.defaultExtension = extension;
    if(defaultStr) {
      if(this.os === "darwin")
        fileChooser.defaultString = defaultStr + "." + extension;
      else
        fileChooser.defaultString = defaultStr;
    }
    for(let filter of filters)
      fileChooser.appendFilters(filter);

    fileChooser.open(function(result) {
      //returnOK        0
      //returnCancel    1
      //returnReplace   2
      if(result != nsIFilePicker.returnCancel) {
        if(mode == nsIFilePicker.modeSave) {
          // file is nsIFile, data is a string
          let foStream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
          if(fileChooser.file.exists()){
            fileChooser.file.remove(true);
          }
          fileChooser.file.create(fileChooser.file.NORMAL_FILE_TYPE, 0o666);
          foStream.init(fileChooser.file, 0x02 | 0x08 | 0x20, 0o666, null);
          if(convertUTF8) {
            if(utf8BOM)
              foStream.write("\u00EF\u00BB\u00BF", 3); //write UTF-8 BOM
            let converter = Cc["@mozilla.org/intl/converter-output-stream;1"].createInstance(Ci.nsIConverterOutputStream);
            converter.init(foStream, "UTF-8", 0, 0);
            converter.writeString(writeData);
            converter.close(); // this closes foStream
          } else {
            foStream.write(writeData, writeData.length);
            if (foStream instanceof Ci.nsISafeOutputStream)
              foStream.finish();
            else
              foStream.close();
          }
        } else if(mode == nsIFilePicker.modeOpen) {
          let fstream = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
          // Read data with 2-color DBCS char
          fstream.init(fileChooser.file, -1, -1, false);
          let bstream = Cc["@mozilla.org/binaryinputstream;1"].createInstance(Ci.nsIBinaryInputStream);
          bstream.setInputStream(fstream);
          let bytes = bstream.readBytes(bstream.available());
          if(postCommand) {
            this.setBBSCmdEx({command: postCommand, fileData: bytes}, target);
          }
          bstream.close();
          fstream.close();
        }
      }
    }.bind(this));
  },

  openNewTabs: function(urls, ref, charset, loadInBg) {
    //https://developer.mozilla.org/en-US/Add-ons/SDK/High-Level_APIs/tabs
    //TODO: check private-browsing use case.
    for(let url of urls) {
      tabs.open({
        url: url,
        inBackground: loadInBg
      });
    }
  },

  writePrefs: function(branchName, name, vtype, value) {
    let prefs = Cc["@mozilla.org/preferences-service;1"].
                 getService(Ci.nsIPrefService).
                 getBranch(branchName);
    if(vtype == Ci.nsIPrefBranch.PREF_BOOL) {
      prefs.getBoolPref(name, value);
    }
    else if(vtype == Ci.nsIPrefBranch.PREF_INT) {
      prefs.setIntPref(name, value);
    }
    else if(vtype == Ci.nsIPrefBranch.PREF_STRING) {
      let nsIString = Cc["@mozilla.org/supports-string;1"]
                       .createInstance(Ci.nsISupportsString);
      nsIString.data = value;
      prefs.setComplexValue(name, Ci.nsISupportsString, nsIString);
    }
  },

  setBBSCmdEx: function(commandSet, target) {
    if(!target) {
      let tab = tabs.activeTab;
      if(this.urlCheck.test(tab.url)) { // telnet:// or ssh://
        let xulTab = tabUtils.getTabForId(tab.id);
        target = tabUtils.getBrowserForTab(xulTab);
      }
    }
    if(target) {
      let browserMM = target.messageManager;
      browserMM.sendAsyncMessage("bbsfox@ettoolong:bbsfox-overlayCommand", commandSet);
    }
  },

  setBBSCmd: function(command, target) {
    if(!target) {
      let tab = tabs.activeTab;
      if(this.urlCheck.test(tab.url)) { // telnet:// or ssh://
        let xulTab = tabUtils.getTabForId(tab.id);
        target = tabUtils.getBrowserForTab(xulTab);
      }
    }
    if(target) {
      let browserMM = target.messageManager;
      browserMM.sendAsyncMessage("bbsfox@ettoolong:bbsfox-overlayCommand", {command: command});
    }
  },

  setItemVisible: function(doc, id, visible, checkHidden) {
    let menuitem = doc.getElementById(id);
    if(menuitem) {
      if(checkHidden)
        menuitem.hidden = (menuitem.hidden || !visible);
      else
        menuitem.hidden = !visible;
    }
  },

  handle_mouse_scroll: function (params) {
    let {event, tab, e10s} = params;
    let uri = tabUtils.getURI(tab);
    if(!this.urlCheck.test(uri)) {
      return;
    }

    //console.log(event.target);
    let eventPrefs = tab.eventPrefs;
    if(!eventPrefs) {
      return;
    }

    if(!tab.eventStatus) {
      tab.eventStatus = {doDOMMouseScroll: false};
    }
    let browser = e10s ? event.target.mCurrentBrowser : null;

    let actions = [["",""],
                   ["doArrowUp", "doArrowDown"],
                   ["doPageUp","doPageDown"],
                   ["prevousThread","nextThread"],
                   ["doHome","doEnd"]];

    let mouseWheelFunc = [eventPrefs.mouseWheelFunc1,
                          eventPrefs.mouseWheelFunc2,
                          eventPrefs.mouseWheelFunc3]

    let direction = event.detail < 0 ? 0 :1;

    if(mouseWheelFunc[0] || mouseWheelFunc[1] || mouseWheelFunc[2]) {

      let eventStatus = tab.eventStatus;
      //let action = actions
      let mouseButton;
      if(eventStatus.mouseRBtnDown)
        mouseButton = 1;
      else if(eventStatus.mouseLBtnDown)
        mouseButton = 2;
      else
        mouseButton = 0;

      let action = actions[mouseWheelFunc[mouseButton]][direction];
      if(action !== "") {
        this.setBBSCmd(action, browser);
        event.stopPropagation();
        event.preventDefault();

        if(eventStatus.mouseRBtnDown) {//prevent context menu popup
          eventStatus.doDOMMouseScroll = true;
        }
        if(eventStatus.mouseLBtnDown) {
          //TODO: fix this, tell content page skip this mouse click.
          if(eventPrefs.useMouseBrowsing) {
            this.setBBSCmd("skipMouseClick", browser);
          }
        }
      }
    }

  },

  mouse_scroll_e10s: function (event) {
    if(event.target.tagName!="tabbrowser" || event.target.getAttribute("id") != "content") {
      return;
    }
    let tab = event.target.mCurrentTab; //tabUtils.getTabForBrowser(event.target);
    //let uri = tabUtils.getURI(tab);
    this.handle_mouse_scroll({event: event, tab: tab, e10s:true});
  },

  mouse_scroll: function (event) {
    let tab = tabs.activeTab;
    let xulTab = tabUtils.getTabForId(tab.id); //xulTab = viewFor(tab);

    //tabUtils.getTabForBrowser( message.target ).eventPrefs = data.eventPrefs;
    //console.log(xulTab.eventPrefs);
    this.handle_mouse_scroll({event: event, tab: xulTab, e10s:false});
  },

  mouse_menu: function (event) {

    let tab = tabs.activeTab;
    let xulTab = tabUtils.getTabForId(tab.id);
    //let tab = event.target.mCurrentTab;
    let uri = tabUtils.getURI(xulTab);
    if(!this.urlCheck.test(uri))
      return;

    let eventPrefs = xulTab.eventPrefs;
    if(!eventPrefs)
      return;

    if(!xulTab.eventStatus)
      xulTab.eventStatus = {doDOMMouseScroll: false};
    let eventStatus = xulTab.eventStatus;

    let mouseWheelFunc2 = (eventPrefs.mouseWheelFunc2 != 0);
    if(mouseWheelFunc2) {

      if(eventStatus.doDOMMouseScroll) {
        event.stopPropagation();
        event.preventDefault();
        //eventStatus.doDOMMouseScroll = false;
      } else {
        if(this.os == "winnt") {
          //do nothing...
        } else if(eventStatus.mouseRBtnDown) {//if Linux or Mac, delay popup menu.
          event.stopPropagation();
          event.preventDefault();
          return;
        }
      }
    } else {
    }
  },

  mouse_down: function (event) {
    //if(event.target.tagName !== "tabbrowser")
    //  return;
    //let tab = event.target.mCurrentTab;
    let tab = tabs.activeTab;
    let xulTab = tabUtils.getTabForId(tab.id);

    if(!xulTab.eventStatus)
      xulTab.eventStatus = {doDOMMouseScroll: false};
    let eventStatus = xulTab.eventStatus;
    if(event.button==2) {
      eventStatus.mouseRBtnDown = true;
      eventStatus.doDOMMouseScroll = false;
    } else if(event.button==0) {
      eventStatus.mouseLBtnDown = true;
    }
  },

  mouse_up: function (event) {
    //if(event.target.tagName !== "tabbrowser")
    //  return;
    //let tab = event.target.mCurrentTab;

    let tab = tabs.activeTab;
    let xulTab = tabUtils.getTabForId(tab.id);
    if(!xulTab.eventStatus)
      xulTab.eventStatus = {doDOMMouseScroll: false};
    let eventStatus = xulTab.eventStatus;

    if(event.button==2)
      eventStatus.mouseRBtnDown = false;
    else if(event.button==0)
      eventStatus.mouseLBtnDown = false;

    let uri = tabUtils.getURI(xulTab);
    if(!this.urlCheck.test(uri))
      return;

    let eventPrefs = xulTab.eventPrefs;
    if(!eventPrefs)
      return;

    let mouseWheelFunc2 = (eventPrefs.mouseWheelFunc2 != 0);
    if(mouseWheelFunc2) {
      if(event.button==2) {
        if(this.os == "winnt") {
        //do nothing...
        } else {//if Linux or Mac, show popup menu.
          if(!eventStatus.doDOMMouseScroll) {
            let browser = event.target.mCurrentBrowser;
            this.setBBSCmdEx({command:"contextmenu",
                              screenX:event.screenX,
                              screenY:event.screenY,
                              clientX:event.clientX,
                              clientY:event.clientY}, browser);

          }
        }
      }
    }
  },

  key_press: function (event) {

    let tab = event.target.mCurrentTab;
    if(!tab) //why tab undefined
      return;
    let eventPrefs = tab.eventPrefs;
    if(!eventPrefs)
      return;

    let uri = tabUtils.getURI(tab);
    if(!this.urlCheck.test(uri))
      return;
    let browser = event.target.mCurrentBrowser;

    // if (!event.ctrlKey && !event.altKey && !event.shiftKey) {
    //   switch(event.keyCode) {
    //     case 33: //Page Up
    //       event.stopPropagation();
    //       event.preventDefault();
    //       owner.setBBSCmd("doPageUp");
    //       return;
    //     case 34: //Page Down
    //       event.stopPropagation();
    //       event.preventDefault();
    //       owner.setBBSCmd("doPageDown");
    //       return;
    //     case 38: //Arrow Up
    //       event.stopPropagation();
    //       event.preventDefault();
    //       owner.setBBSCmd("doArrowUp");
    //       return;
    //     case 40: //Arrow Down
    //       event.stopPropagation();
    //       event.preventDefault();
    //       owner.setBBSCmd("doArrowDown");
    //       return;
    //     default:
    //       break;
    //   }
    // }
    if(event.charCode){
      if(event.ctrlKey && !event.altKey && event.shiftKey && (event.charCode == 118 || event.charCode == 86) && eventPrefs.hokeyForPaste) { //Shift + ^V, do paste
        this.setBBSCmd("doPaste", browser);
        event.preventDefault();
        event.stopPropagation();
      }

      if (event.ctrlKey && !event.altKey && !event.shiftKey) {
        if((event.charCode==109 || event.charCode==77) && eventPrefs.hokeyForMouseBrowsing) {
          this.setBBSCmd("switchMouseBrowsing", browser);
          event.stopPropagation();
          event.preventDefault();
        }
        if(this.os != "darwin") {
          if((event.charCode==119 || event.charCode==87) && eventPrefs.hotkeyCtrlW == 1) {
            this.setBBSCmdEx({command:"sendCharCode", charCode:23}, browser);
            event.stopPropagation();
            event.preventDefault();
          } else if((event.charCode==98 || event.charCode==66) && eventPrefs.hotkeyCtrlB == 1) {
            this.setBBSCmdEx({command:"sendCharCode", charCode:20}, browser);
            event.stopPropagation();
            event.preventDefault();
          } else if((event.charCode==108 || event.charCode==76) && eventPrefs.hotkeyCtrlL == 1) {
            this.setBBSCmdEx({command:"sendCharCode", charCode:23}, browser);
            event.stopPropagation();
            event.preventDefault();
          } else if((event.charCode==116 || event.charCode==84) && eventPrefs.hotkeyCtrlT == 1) {
            this.setBBSCmdEx({command:"sendCharCode", charCode:20}, browser);
            event.stopPropagation();
            event.preventDefault();
          }
        }
      }
    }

  },

  bbsfoxContextMenuShowing: function(event) {
    let sortItem = event.target.getAttribute("sortItem");
    if(!sortItem) {
      //console.log('sort context menu items');
      let menuItems = event.target.childNodes;
      // sort items - start
      // only need do this once.
      let refNodes = {
        "context-copy": {},
        "context-selectall": {},
        "context-viewimage": {}
      };
      let moveNodes = {
        "bbsfox_menu-ansiCopy": null,
        "bbsfox_menu-openAllLink": null,
        "bbsfox_menu-viewimage": null
      };
      for(let menuItem of menuItems) {
        let id = menuItem.getAttribute("id");
        if(id) {
          if(refNodes[id]) {
            refNodes[id].self = menuItem;
            refNodes[id].next = menuItem.nextSibling;
            refNodes[id].label = menuItem.getAttribute("label");
            refNodes[id].accesskey = menuItem.getAttribute("accesskey");
          }
        }
        let value = menuItem.getAttribute("value");
        if(value && /^bbsfox_/.test(value)) {
          menuItem.setAttribute("id", value);
          moveNodes[value] = menuItem;
        }
      }
      //TODO: TypeError: Argument 1 of Node.insertBefore is not an object.
      if(moveNodes["bbsfox_menu-ansiCopy"] && moveNodes["bbsfox_menu-openAllLink"] && moveNodes["bbsfox_menu-viewimage"] ) {
        event.target.setAttribute("sortItem", "true");
        event.target.insertBefore(moveNodes["bbsfox_menu-ansiCopy"], refNodes["context-copy"].next);
        event.target.insertBefore(moveNodes["bbsfox_menu-openAllLink"], refNodes["context-selectall"].next);
        event.target.insertBefore(moveNodes["bbsfox_menu-viewimage"], refNodes["context-viewimage"].next);
        moveNodes["bbsfox_menu-viewimage"].setAttribute("label", refNodes["context-viewimage"].label);
        moveNodes["bbsfox_menu-viewimage"].setAttribute("accesskey", refNodes["context-viewimage"].accesskey);
      }
      // sort items - end
    }
    //context-paste
    //previousSibling
    let tab = tabs.activeTab;
    let tabId = tab.id;
    let xulTab = tabUtils.getTabForId(tabId);
    if(this.urlCheck.test(tab.url)) {
      let eventPrefs = xulTab.eventPrefs;
      if(eventPrefs) {
        //console.log(event.target);
        let doc = event.target.ownerDocument;
        if(!this.contextLink)
          this.setItemVisible(doc, "context-paste", true); //TODO: don't display, if click on link

        // this.setItemVisible(doc, "context-back", false);
        // this.setItemVisible(doc, "context-forward", false);
        // this.setItemVisible(doc, "context-reload", false);
        // this.setItemVisible(doc, "context-stop", false);
        this.setItemVisible(doc, "context-navigation", false);
        this.setItemVisible(doc, "context-sep-navigation", false);

        this.setItemVisible(doc, "context-viewimage", false);
        this.setItemVisible(doc, "context-viewbgimage", false);
        this.setItemVisible(doc, "context-sep-viewbgimage", false);

        this.setItemVisible(doc, "context-viewpartialsource-selection", false);
        this.setItemVisible(doc, "context-viewpartialsource-mathml", false);

        if(eventPrefs.hideBookMarkLink) {
          this.setItemVisible(doc, "context-bookmarklink", false);
        }
        if(eventPrefs.hideSendLink) {
          this.setItemVisible(doc, "context-sendlink", false);
        }
        if(eventPrefs.hideSendPage) {
          this.setItemVisible(doc, "context-sendpage", false);
          this.setItemVisible(doc, "context-sharepage", false);
        }
        if(eventPrefs.hideViewInfo) {
          this.setItemVisible(doc, "context-sep-viewsource", false);
          this.setItemVisible(doc, "context-viewinfo", false);
        }
        if(eventPrefs.hideInspect) {
          this.setItemVisible(doc, "inspect-separator", false);
          this.setItemVisible(doc, "context-inspect", false);
        }
      }
    }
    bbstabs.resetFocus = true;
  },

  bbsfoxContextMenuShown: function(event) {
    let menuItems = event.target.childNodes;
    let item = null;
    let separator = null;
    let oneVisible = false;
    for(let menuItem of menuItems) {
      let id = menuItem.getAttribute("id");
      let className = menuItem.getAttribute("class");
      if(id === "context-paste") {
        menuItem.disabled = false;
      }
      if(className === "addon-context-menu-separator") {
        if(!item) {
          separator = item = menuItem;
        }
      }
    }
    if(item) {
      while(item.nextSibling) {
        item = item.nextSibling;
        let className = item.getAttribute("class");
        if(className === "addon-context-menu-separator") {
          separator = item;
          oneVisible = false;
          //console.log("separator start");
        }
        else if(!item.hidden) {
          //console.log(item);
          oneVisible = true;
        }
      }
      if(!oneVisible) {
        separator.hidden = true;
      }
    }
  },

  bbsfoxContextMenuHidden: function(event) {
    if(event.target.getAttribute("id") === "contentAreaContextMenu") {
      if(!bbstabs.selectionText && bbstabs.resetFocus) {
        bbstabs.setBBSCmd("setInputAreaFocus");
      }
    }
  },

  tabAttrModified: function(event) {
    //let tabId = tabUtils.getTabId(event.target);
    let tabBrowser = tabUtils.getBrowserForTab(event.target);
    let browserMM = tabBrowser.messageManager;
    browserMM.sendAsyncMessage("bbsfox@ettoolong:bbsfox-overlayEvent", {command:"update"});
    /*
    let xulTab = tabUtils.getTabForBrowser( tabBrowser );
    let chromeWindow = tabUtils.getOwnerWindow(xulTab);
    let aDOMWindow = chromeWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
    let useRemoteTabs = chromeWindow.QueryInterface(Ci.nsIInterfaceRequestor)
     .getInterface(Ci.nsIWebNavigation).QueryInterface(Ci.nsILoadContext).useRemoteTabs;
    */
  },

  init: function() {
    this.eventMap.set("DOMMouseScroll-E10S", this.mouse_scroll_e10s.bind(this));
    this.eventMap.set("DOMMouseScroll", this.mouse_scroll.bind(this));
    this.eventMap.set("contextmenu", this.mouse_menu.bind(this));
    this.eventMap.set("mousedown", this.mouse_down.bind(this));
    this.eventMap.set("mouseup", this.mouse_up.bind(this));
    this.eventMap.set("keypress", this.key_press.bind(this));

    this.eventMap.set("caContextMenu-ps", this.bbsfoxContextMenuShowing.bind(this));
    this.eventMap.set("caContextMenu-ps2", this.bbsfoxContextMenuShown.bind(this));
    this.eventMap.set("caContextMenu-ph", this.bbsfoxContextMenuHidden.bind(this));

    this.eventMap.set("tabAttrModified", this.tabAttrModified.bind(this));
    this.eventMap.set("handleCoreCommand", this.handleCoreCommand.bind(this));
  },

  onWinOpen: function(chromeWindow) {
    let useRemoteTabs = chromeWindow.QueryInterface(Ci.nsIInterfaceRequestor)
     .getInterface(Ci.nsIWebNavigation).QueryInterface(Ci.nsILoadContext).useRemoteTabs;
    //console.log('useRemoteTabs = ' + useRemoteTabs);

    let chromeBrowser = chromeWindow.gBrowser; //chromeBrowser undefined????
    if(chromeBrowser) {
      chromeWindow.BBSFox_API = bbsfoxAPI;
      if(useRemoteTabs)
        chromeWindow.addEventListener("DOMMouseScroll", this.eventMap.get("DOMMouseScroll-E10S"), true);
      else
        chromeWindow.addEventListener("DOMMouseScroll", this.eventMap.get("DOMMouseScroll"), true);

      chromeBrowser.addEventListener("contextmenu", this.eventMap.get("contextmenu"), true);
      chromeBrowser.addEventListener("mousedown", this.eventMap.get("mousedown"), true);
      chromeBrowser.addEventListener("mouseup", this.eventMap.get("mouseup"), true);
      chromeBrowser.addEventListener("keypress", this.eventMap.get("keypress"), true);
      chromeBrowser.tabContainer.addEventListener("TabAttrModified", this.eventMap.get("tabAttrModified"), true);

      let aDOMWindow = chromeWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
      aDOMWindow.messageManager.loadFrameScript("chrome://bbsfox/content/bbsfox_frame_script.js", true);
      aDOMWindow.messageManager.addMessageListener("bbsfox@ettoolong:bbsfox-coreCommand",  this.eventMap.get("handleCoreCommand") );

      let contentAreaContextMenu = aDOMWindow.document.getElementById("contentAreaContextMenu");

      if(contentAreaContextMenu) {
        contentAreaContextMenu.addEventListener("popupshowing", this.eventMap.get("caContextMenu-ps"), false);
        contentAreaContextMenu.addEventListener("popupshown", this.eventMap.get("caContextMenu-ps2"), false);
        contentAreaContextMenu.addEventListener("popuphidden", this.eventMap.get("caContextMenu-ph"), false);
      }
    }
  },

  onWinClose: function(chromeWindow) {
    let useRemoteTabs = chromeWindow.QueryInterface(Ci.nsIInterfaceRequestor)
     .getInterface(Ci.nsIWebNavigation).QueryInterface(Ci.nsILoadContext).useRemoteTabs;

    let chromeBrowser = chromeWindow.gBrowser;
    if(chromeBrowser) {
      delete chromeWindow.BBSFox_API;
      if(useRemoteTabs)
        chromeWindow.removeEventListener("DOMMouseScroll", this.eventMap.get("DOMMouseScroll-E10S"), true);
      else
        chromeWindow.removeEventListener("DOMMouseScroll", this.eventMap.get("DOMMouseScroll"), true);

      chromeBrowser.removeEventListener("contextmenu", this.eventMap.get("contextmenu"), true);
      chromeBrowser.removeEventListener("mousedown", this.eventMap.get("mousedown"), true);
      chromeBrowser.removeEventListener("mouseup", this.eventMap.get("mouseup"), true);
      chromeBrowser.removeEventListener("keypress", this.eventMap.get("keypress"), true);
      chromeBrowser.tabContainer.removeEventListener("TabAttrModified", this.eventMap.get("tabAttrModified"), true);

      let aDOMWindow = chromeWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
      aDOMWindow.messageManager.removeMessageListener("bbsfox@ettoolong:bbsfox-coreCommand",  this.eventMap.get("handleCoreCommand") );
      aDOMWindow.messageManager.removeDelayedFrameScript("chrome://bbsfox/content/bbsfox_frame_script.js");

      let contentAreaContextMenu = aDOMWindow.document.getElementById("contentAreaContextMenu");

      if(contentAreaContextMenu) {
        contentAreaContextMenu.removeEventListener("popupshowing", this.eventMap.get("caContextMenu-ps"), false);
        contentAreaContextMenu.removeEventListener("popupshown", this.eventMap.get("caContextMenu-ps2"), false);
        contentAreaContextMenu.removeEventListener("popuphidden", this.eventMap.get("caContextMenu-ph"), false);
      }
    }
  },

  onTabOpen: function(tab) {
    tab.on("activate", tab => {
      Cc["@mozilla.org/globalmessagemanager;1"].getService(Ci.nsIMessageBroadcaster)
        .broadcastAsyncMessage("bbsfox@ettoolong:bbsfox-overlayCommand", {command: "setTabUnselect"});
      let tabId = tab.id;
      let xulTab = tabUtils.getTabForId(tabId);
      let tabBrowser = tabUtils.getBrowserForTab(xulTab);
      bbstabs.setBBSCmd("setTabSelect", tabBrowser );
    });
  },

  /*
  getContentScript: function(prefName, command) {
    let action = "";
    if(!command) {
      action = "  self.postMessage(data);";
    }
    else {
      action = "  unsafeWindow.bbsfox.overlaycmd.exec({command:'" + command +"'});";
    }
    let cs = [
      "self.on('context', function (node) {",
      "  if(!unsafeWindow.bbsfox) {",
      "    return false;",
      "  }",
      "  return unsafeWindow.bbsfox.prefs." + prefName + ";",
      "});",
      "self.on('click', function(node, data) {",
      action,
      "});"
    ];
    return cs.join("");
  }*/

};

windows.on("open" ,  win => {
  bbstabs.onWinOpen( viewFor(win) );
});

tabs.on("open", tab => {
  bbstabs.onTabOpen(tab);
});

//context-menu-item-ansiCopy
cm.Item({
  label: _("cm_ansiCopy"),
  context: cm.SelectionContext(),
  contentScriptFile: data.url("js/context-menu/ansiCopy.js"),
  data: "bbsfox_menu-ansiCopy"
});

//context-menu-item-openAllLink
cm.Item({
  label: _("cm_openAllLink"),
  contentScriptFile: data.url("js/context-menu/openAllLink.js"),
  data: "bbsfox_menu-openAllLink",
  onMessage: () => {
    bbstabs.setBBSCmd("doOpenAllLink");
  }
});

//bbsfox_menu-viewimage
cm.Item({
  label: _("cm_viewimage"),
  contentScriptFile: data.url("js/context-menu/viewImage.js"),
  data: "bbsfox_menu-viewimage",
  onMessage: () => {
    bbstabs.openNewTabs([bbstabs.imageSrc], null, "UTF-8", false);
  }
});

//context-menu-item-previewPicture
cm.Item({
  label: _("cm_previewPicture"),
  context: cm.PredicateContext(function(context){
    bbstabs.contextLink = context.linkURL;
    bbstabs.selectionText = context.selectionText;
    bbstabs.imageSrc = context.srcURL;
    //console.log(cmItemPreviewPicture);
    //let cmitems = winUtils.getMostRecentBrowserWindow().document.querySelectorAll(".addon-context-menu-item[value='bbsfox_menu-previewPicture']");
    return (context.linkURL && !(context.linkURL.search(/\.(bmp|gif|jpe?g|png)$/i) === -1));
  }),
  contentScriptFile: data.url("js/context-menu/previewPicture.js"),
  data: "bbsfox_menu-previewPicture",
  onMessage: () => {
    bbstabs.setBBSCmdEx({command:"previewPicture", pictureUrl: bbstabs.contextLink});
  }
});

//context-menu-item-embeddedPlayer
cm.Item({
  label: _("cm_embeddedPlayer"),
  context: cm.PredicateContext(function(context){
    bbstabs.contextLink = context.linkURL;
    let vtRegex = /(https?:\/\/(?:www|m)\.youtube\.com\/watch\?.*v=([A-Za-z0-9._%-]*)|https?:\/\/youtu\.be\/([A-Za-z0-9._%-]*))/i;
    let vtRegex2 = /(http:\/\/www\.ustream\.tv\/(channel|channel-popup)\/([A-Za-z0-9._%-]*))/i;
    let vtRegex3 = /(http:\/\/www\.ustream\.tv\/recorded\/([0-9]{5,10}))/i;
    return (context.linkURL && ( vtRegex.test(context.linkURL) || vtRegex2.test(context.linkURL) || vtRegex3.test(context.linkURL)));
  }),
  contentScriptFile: data.url("js/context-menu/embeddedPlayer.js"),
  data: "bbsfox_menu-embeddedPlayer",
  onMessage: () => {
    bbstabs.setBBSCmdEx({command:"openPlayerWindowEx", videoUrl: bbstabs.contextLink});
  }
});

//context-menu-item-ansiColorTool
cm.Item({
  label: _("cm_ansiColorTool"),
  context: cm.PredicateContext(function(context){
    return !context.selectionText;
  }),
  contentScriptFile: data.url("js/context-menu/ansiColorTool.js"),
  data: "bbsfox_menu-ansiColorTool"
});

//context-menu-item-screenKeyboard
cm.Item({
  label: _("cm_screenKeyboard"),
  context: cm.PredicateContext(function(context){
    return !context.selectionText;
  }),
  contentScriptFile: data.url("js/context-menu/screenKeyboard.js"),
  data: "bbsfox_menu-screenKeyboard"
});

//context-menu-item-addTrack
cm.Item({
  label: _("cm_addTrack"),
  context: cm.SelectionContext(),
  contentScriptFile: data.url("js/context-menu/trackAdd.js"),
  data: "bbsfox_menu-addTrack"
});
cm.Item({
  label: _("cm_delTrack"),
  context: cm.SelectionContext(),
  contentScriptFile: data.url("js/context-menu/trackDel.js"),
  data: "bbsfox_menu-delTrack"
});
cm.Item({
  label: _("cm_clearTrack"),
  contentScriptFile: data.url("js/context-menu/trackClear.js"),
  data: "bbsfox_menu-clearTrack"
});

//context-menu-item-mouseBrowsing
cm.Item({
  label: _("cm_mouseBrowsing"),
  context: cm.PredicateContext(function(context){
    return !context.selectionText;
  }),
  contentScriptFile: data.url("js/context-menu/mouseBrowsing.js"),
  data: "bbsfox_menu-mouseBrowsing"
});

//context-menu-item-switchBgDisplay
cm.Item({
  label: _("cm_switchBgDisplay"),
  context: cm.PredicateContext(function(context){
    return !context.selectionText;
  }),
  contentScriptFile: data.url("js/context-menu/switchBgDisplay.js"),
  data: "bbsfox_menu-BgDisplay"
});

//context-menu-item-easyRead
cm.Item({
  label: _("cm_easyRead"),
  context: cm.PredicateContext(function(context){
    return !context.selectionText;
  }),
  contentScriptFile: data.url("js/context-menu/easyRead.js"),
  data: "bbsfox_menu-easyRead"
});

//context-menu-item-pushThread
cm.Item({
  label: _("cm_pushThread"),
  context: cm.PredicateContext(function(context){
    return !context.selectionText;
  }),
  contentScriptFile: data.url("js/context-menu/pushThread.js"),
  data: "bbsfox_menu-pushThread"
});

//context-menu-item-openThreadUrl
cm.Item({
  label: _("cm_openThreadUrl"),
  context: cm.PredicateContext(function(context){
    return !context.selectionText;
  }),
  contentScriptFile: data.url("js/context-menu/openThreadUrl.js"),
  data: "bbsfox_menu-openThreadUrl"
});

//context-menu-item-changeColorTable
cm.Item({
  label: _("cm_changeColorTable"),
  context: cm.PredicateContext(function(context){
    return !context.selectionText;
  }),
  contentScriptFile: data.url("js/context-menu/changeColorTable.js"),
  data: "bbsfox_menu-changeColorTable"
});

//context-menu-item-downloadPost
cm.Menu({
  label: _("cm_downloadPost"),
  context: cm.PredicateContext(function(context){
    return !context.selectionText;
  }),
  contentScriptFile: data.url("js/context-menu/downloadPost.js"),
  data: "bbsfox_menu-downloadPost",
  items: [
    cm.Item({ label: _("cm_downText"), data: "bbsfox_menu-downloadText" }),
    cm.Item({ label: _("cm_downAnsi"), data: "bbsfox_menu-downloadAnsi" }),
    cm.Item({ label: _("cm_downHtml"), data: "bbsfox_menu-downloadHtml" })
  ],
  onMessage: data => {
    let mode = 0;
    if(data === "bbsfox_menu-downloadText") mode = 0;
    else if(data === "bbsfox_menu-downloadAnsi") mode = 1;
    else if(data === "bbsfox_menu-downloadHtml") mode = 2;
    bbstabs.setBBSCmdEx({command:"doDownloadPost", downloadColor: mode});
  }
});

//context-menu-item-loadFile
cm.Item({
  label: _("cm_loadFile"),
  context: cm.PredicateContext(function(context){
    return !context.selectionText;
  }),
  contentScriptFile: data.url("js/context-menu/loadFile.js"),
  data: "bbsfox_menu-fileIo"
});

//context-menu-item-addToBlacklist
cm.Item({
  label: _("cm_addToBlacklist"),
  context: cm.SelectionContext(),
  contentScriptFile: [
    data.url("js/stringutil.js"),
    data.url("js/context-menu/blacklistAdd.js")
  ],
  data: "bbsfox_menu-addToBlacklist"
});

//context-menu-item-removeFromBlacklist
cm.Item({
  label: _("cm_removeFromBlacklist"),
  context: cm.SelectionContext(),
  contentScriptFile: [
    data.url("js/stringutil.js"),
    data.url("js/context-menu/blacklistDel.js")
  ],
  data: "bbsfox_menu-removeFromBlacklist"
});

//
function initDefaultPrefs () {
  let bbsfoxPrefs = require("chrome://bbsfox/content/bbsfoxPrefs.js").bbsfoxPrefs;
  //default site setting
  let defaultPrefs = Cc["@mozilla.org/preferences-service;1"].
                      getService(Ci.nsIPrefService).
                      getDefaultBranch("extensions.bbsfox2.");
  for(let i in bbsfoxPrefs.sitePrefs) {
    let value = bbsfoxPrefs.sitePrefs[i];
    if( typeof value === "boolean") {
      defaultPrefs.setBoolPref("host_default." + i, value);
    }
    else if( typeof value === "number") {
      defaultPrefs.setIntPref("host_default." + i, value);
    }
    else if( typeof value === "string"){
      let nsIString = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
      nsIString.data = value;
      defaultPrefs.setComplexValue("host_default." + i, Ci.nsISupportsString, nsIString);
    }
  }

  //global setting
  let globalPrefs = Cc["@mozilla.org/preferences-service;1"].
               getService(Ci.nsIPrefService).
               getDefaultBranch("extensions.");

  for(let i in bbsfoxPrefs.globalPrefs) {
    let value = bbsfoxPrefs.globalPrefs[i];
    if( typeof value === "boolean") {
      globalPrefs.setBoolPref(i, value);
    }
    else if( typeof value === "number") {
      globalPrefs.setIntPref(i, value);
    }
    else if( typeof value === "string"){
      let nsIString = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
      nsIString.data = value;
      globalPrefs.setComplexValue(i, Ci.nsISupportsString, nsIString);
    }
  }
}

exports.main = function (options, callbacks) {
  initDefaultPrefs();
  bbstabs.init();

  // Init event listener - start
  // 1. Listen open event that windows open before addon startup
  // 2. Listen open event that tabs open before addon startup
  // addon sdk bug :(  see: https://bugzil.la/1196577
  let allWindows = winUtils.windows(null, {includePrivate:true});
  for (let chromeWindow of allWindows) {
    if(winUtils.isBrowser(chromeWindow)) {
      bbstabs.onWinOpen( chromeWindow );
      let openedTabs = tabUtils.getTabs( chromeWindow );
      for(let openedTab of openedTabs) {
        //console.log(openedTabs[i]);
        bbstabs.onTabOpen( modelFor(openedTab) );
      }
    }
  }
  // Init event listener - end

  if (options.loadReason === "install" || options.loadReason === "startup") {
    //TODO: set default pref value
  }
  if (options.loadReason === "install" || options.loadReason === "upgrade") {
    //TODO: show version info
    //TODO: update pref value, remove unused pref
  }

  aboutPage = new bbsfoxAbout.Page();
  bbsfoxBg.mount();

  Cc["@mozilla.org/globalmessagemanager;1"].getService(Ci.nsIMessageBroadcaster)
    .broadcastAsyncMessage("bbsfox@ettoolong:bbsfox-addonCommand", {command: options.loadReason});
};

exports.onUnload = function (reason) {
  if (reason !== "shutdown"){

    // remove all event listener - start
    let allWindows = winUtils.windows(null, {includePrivate:true});
    for (let chromeWindow of allWindows) {
      if(winUtils.isBrowser(chromeWindow)) {
        bbstabs.onWinClose( chromeWindow );
      }
    }
    // remove all event listener - end

    // unregister about:bbsfox page
    aboutPage.unregister();
    bbsfoxBg.unmount();

    // notify all telnet page
    Cc["@mozilla.org/globalmessagemanager;1"].getService(Ci.nsIMessageBroadcaster)
      .broadcastAsyncMessage("bbsfox@ettoolong:bbsfox-addonCommand", {command: reason});

    // close preference dialog - start
    let wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
    let ww = Cc["@mozilla.org/embedcomp/window-watcher;1"].getService(Ci.nsIWindowWatcher);
    let existing = wm.getMostRecentWindow("bbsfox:options");
    if (existing){
      try{
        existing.close();
      }
      catch (e) {}
    }
    // close preference dialog - end
  }

  // cleanup tempFiles - start
  for(let file of bbstabs.tempFiles) {
    file.remove(true);
  }
  // cleanup tempFiles - end
};
