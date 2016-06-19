"use strict";

const tabs = require("sdk/tabs");
const tabUtils = require("sdk/tabs/utils");

const bbsfoxAPI = {
  setBBSCmd: function(command){
    bbsfoxAPI.setBBSCmdEx({command: command});
  },
  setBBSCmdEx: function(commandSet){
    let tab = tabs.activeTab;
    let xulTab = tabUtils.getTabForId(tab.id);
    let target = tabUtils.getBrowserForTab(xulTab);
    let browserMM = target.messageManager;
    browserMM.sendAsyncMessage("bbsfox@ettoolong:bbsfox-overlayCommand", commandSet);
  }
};

exports.bbsfoxAPI = bbsfoxAPI;
