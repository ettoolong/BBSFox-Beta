/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla.
 *
 * The Initial Developer of the Original Code is IBM Corporation.
 * Portions created by IBM Corporation are Copyright (C) 2004
 * IBM Corporation. All Rights Reserved.
 *
 * Contributor(s):
 *   Darin Fisher <darin@meer.net>
 *   Doron Rosenberg <doronr@us.ibm.com>
 *   Ett Chung <ettoolong@hotmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
const {classes: Cc, interfaces: Ci, results: Cr, ID: Cid } = Components;
var EXPORTED_SYMBOLS = ["TelnetProtocol"];

// Telnet protocol related
const kSCHEME              = "telnet";
const kPROTOCOL_NAME       = "Telnet Protocol";
const kPROTOCOL_CONTRACTID = "@mozilla.org/network/protocol;1?name=" + kSCHEME;
const kPROTOCOL_CID        = Cid("5FAF83FD-708D-45c0-988B-C7404FB25376");

// Mozilla defined
const kSTANDARDURL_CONTRACTID = "@mozilla.org/network/standard-url;1";
const kIOSERVICE_CONTRACTID   = "@mozilla.org/network/io-service;1";

const nsISupports        = Ci.nsISupports;
const nsIObserver        = Ci.nsIObserver;
const nsIIOService       = Ci.nsIIOService;
const nsIProtocolHandler = Ci.nsIProtocolHandler;
const nsIStandardURL     = Ci.nsIStandardURL;
const nsIURI             = Ci.nsIURI;

function TelnetProtocol() {
  this.regFactory = null;
  this.wrappedJSObject = this;
}

TelnetProtocol.prototype = {
  classDescription: kPROTOCOL_NAME,
  classID:          kPROTOCOL_CID,
  contractID:       kPROTOCOL_CONTRACTID,
  QueryInterface: function QueryInterface(iid){
    if (iid.equals(nsIProtocolHandler))
      return this;
    else
      throw Cr.NS_ERROR_NO_INTERFACE;
  },
  scheme: kSCHEME,
  protocolFlags: nsIProtocolHandler.URI_NORELATIVE |
                 nsIProtocolHandler.URI_NOAUTH |
                 nsIProtocolHandler.URI_LOADABLE_BY_ANYONE,

  allowPort: function(port, scheme) {
    return false
  },

  setFactory: function(factory) {
    this.regFactory = factory;
  },

  getFactory: function(factory) {
    return this.regFactory;
  },

  newURI: function(spec, charset, baseURI) {
    let cls = Cc[kSTANDARDURL_CONTRACTID];
    let url = cls.createInstance(nsIStandardURL);
    url.init(nsIStandardURL.URLTYPE_AUTHORITY, 23, spec, charset, baseURI);
    return url.QueryInterface(nsIURI);
  },

  newChannel: function(aURI, aSecurity_or_aLoadInfo) {
    // create dummy nsIURI and nsIChannel instances
    let ios = Cc[kIOSERVICE_CONTRACTID].getService(nsIIOService);
    let uri = ios.newURI("chrome://bbsfox/content/telnet.html", null, null);
    return ios.newChannelFromURIWithLoadInfo(uri, aSecurity_or_aLoadInfo);
  }
};
