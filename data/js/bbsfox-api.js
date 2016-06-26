"use strict";

const tabs = require("sdk/tabs");
const tabUtils = require("sdk/tabs/utils");

const apiKeys = [
  'checkFireGestureKey', 'doPageUp', 'doPageDown',
  'doEnd','doHome','doArrowLeft',
  'doArrowUp','doArrowRight','doArrowDown',
  'doCopy','doCopyAnsi','doPaste',
  'doSelectAll','doOpenAllLink','switchMouseBrowsing',
  'switchBgDisplay','easyReading','pushThread',
  'openThreadUrl','changeColorTable','doDownloadPost',
  'doLoadFile','switchSymbolInput','switchAnsiColorTool',
  'openPlayerWindowEx','minimizeEmbeddedPlayer','previewPicture',
  'closePictureViewer','closeEmbeddedPlayer','sendCodeStr'
];

const bbsfoxAPI = {
  setBBSCmd: function(command){
    bbsfoxAPI.setBBSCmdEx({command: command});
  },
  setBBSCmdEx: function(commandSet){
    if(commandSet.command && apiKeys.indexOf(commandSet.command) !== -1 ) { //only allow command that list in apiKeys
      let tab = tabs.activeTab;
      let xulTab = tabUtils.getTabForId(tab.id);
      let target = tabUtils.getBrowserForTab(xulTab);
      let browserMM = target.messageManager;
      browserMM.sendAsyncMessage("bbsfox@ettoolong:bbsfox-overlayCommand", commandSet);
    }
  }
};

exports.bbsfoxAPI = bbsfoxAPI;
