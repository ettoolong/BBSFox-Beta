/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { utils: Cu, classes: Cc, interfaces: Ci } = Components;
const rootURI = __SCRIPT_URI_SPEC__.replace("bootstrap.js", "");
const COMMONJS_URI = "resource://gre/modules/commonjs";
const { require } = Cu.import(COMMONJS_URI + "/toolkit/require.js", {});
const { Bootstrap } = require(COMMONJS_URI + "/sdk/addon/bootstrap.js");
var { startup: startupBS, shutdown: shutdownBS, install, uninstall } = new Bootstrap(rootURI);
var enable = false;
var addonBaseUrl = null;

function unload() {
  let globalMM = Cc["@mozilla.org/globalmessagemanager;1"].getService(Ci.nsIMessageBroadcaster);
  globalMM.removeMessageListener("bbsfox@ettoolong:bbsfox-globalCommand", exec);
  globalMM.removeDelayedFrameScript(addonBaseUrl + "data/js/frame-script.js");
}

function exec(msg) {
  switch(msg.data.name) {
    case 'addonBaseUrl':
      return addonBaseUrl;
    case 'unload':
      if(enable) {
        enable = false;
        return unload();
      }
    default:
  }
}

//ref: https://github.com/mozilla/pdf.js/blob/master/extensions/firefox/bootstrap.js
var addonBaseUrl = null;
function startup(aData, aReason) {
  addonBaseUrl = aData.resourceURI.spec;
  enable = true;
  startupBS(aData, aReason);
  addonBaseUrl = aData.resourceURI.spec;
  let globalMM = Cc["@mozilla.org/globalmessagemanager;1"].getService(Ci.nsIFrameScriptLoader);
  globalMM.addMessageListener("bbsfox@ettoolong:bbsfox-globalCommand", exec);
  globalMM.loadFrameScript(addonBaseUrl + "data/js/frame-script.js", true);
}

function shutdown(aData, aReason) {
  shutdownBS(aData, aReason);
  if (aReason == APP_SHUTDOWN)
    return;
  let globalMM = Cc["@mozilla.org/globalmessagemanager;1"].getService(Ci.nsIMessageBroadcaster);
  globalMM.broadcastAsyncMessage("bbsfox@ettoolong:bbsfox-globalCommand");
  //globalMM.removeMessageListener("bbsfox@ettoolong:bbsfox-globalCommand", exec);
  //globalMM.removeDelayedFrameScript(addonBaseUrl + "data/js/frame-script.js");
}
