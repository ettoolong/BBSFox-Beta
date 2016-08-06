// reference: Working with multiprocess Firefox
// https://developer.mozilla.org/en-US/Add-ons/Working_with_multiprocess_Firefox

//console.log('global frame-script.js');
const { utils: Cu, classes: Cc, interfaces: Ci, manager: Cm, results: Cr } = Components;

let regTelnet = Cm.QueryInterface(Ci.nsIComponentRegistrar)
             .isContractIDRegistered("@mozilla.org/network/protocol;1?name=telnet") ? false : true;

let regSsh = Cm.QueryInterface(Ci.nsIComponentRegistrar)
             .isContractIDRegistered("@mozilla.org/network/protocol;1?name=ssh") ? false : true;

function regAll() {
  let createFactory = function () {
      // Register/unregister a constructor as a component.
      let Factory = {
        QueryInterface: function QueryInterface(iid){
          if (iid.equals(Ci.nsIFactory))
            return this;
          else
            throw Cr.NS_ERROR_NO_INTERFACE;
        },

        _targetConstructor: null,

        register: function register(targetConstructor) {
          this._targetConstructor = targetConstructor;
          let proto = targetConstructor.prototype;
          let registrar = Cm.QueryInterface(Ci.nsIComponentRegistrar);
          if(registrar.isContractIDRegistered(proto.contractID) ) {
          } else {
            registrar.registerFactory(proto.classID, proto.classDescription, proto.contractID, this);
          }
        },

        unregister: function unregister() {
          let proto = this._targetConstructor.prototype;
          let registrar = Cm.QueryInterface(Ci.nsIComponentRegistrar);
          registrar.unregisterFactory(proto.classID, this);
          this._targetConstructor = null;
        },

        // nsIFactory
        createInstance: function createInstance(aOuter, iid) {
          if (aOuter !== null)
            throw Cr.NS_ERROR_NO_AGGREGATION;
          return (new (this._targetConstructor)).QueryInterface(iid);
        },

        // nsIFactory
        lockFactory: function lockFactory(lock) {
          // No longer used as of gecko 1.7.
          throw Cr.NS_ERROR_NOT_IMPLEMENTED;
        }
      };
      return Factory;
  };

  let addonBaseUrl = sendSyncMessage("bbsfox@ettoolong:bbsfox-globalCommand", {name:'addonBaseUrl'}).toString();
  if(addonBaseUrl) {
    Cu.import(addonBaseUrl + "chrome/content/protocols/install_telnet_protocol.js");
    let factory = createFactory();
    factory.register(TelnetProtocol);
    let telnetSrv = Cc['@mozilla.org/network/protocol;1?name=telnet'].getService(Ci.nsIProtocolHandler).wrappedJSObject;
    telnetSrv.setFactory(factory);
  }
  if(addonBaseUrl) {
    Cu.import(addonBaseUrl + "chrome/content/protocols/install_ssh_protocol.js");
    let factory = createFactory();
    factory.register(SshProtocol);
    let sshSrv = Cc['@mozilla.org/network/protocol;1?name=ssh'].getService(Ci.nsIProtocolHandler).wrappedJSObject;
    sshSrv.setFactory(factory);
  }
}

function unregAll() {
  let telnetComponent = Cc['@mozilla.org/network/protocol;1?name=telnet'];
  if(telnetComponent) {
    let telnetSrv = telnetComponent.getService(Ci.nsIProtocolHandler).wrappedJSObject;
    let telnetFactory = telnetSrv.getFactory();
    if(telnetFactory) {
      telnetSrv.setFactory(null);
      telnetFactory.unregister();
    }
  }
  let sshComponent = Cc['@mozilla.org/network/protocol;1?name=ssh'];
  if(sshComponent) {
    let sshSrv = sshComponent.getService(Ci.nsIProtocolHandler).wrappedJSObject;
    let sshFactory = sshSrv.getFactory();
    if(sshFactory) {
      sshSrv.setFactory(null);
      sshFactory.unregister();
    }
  }
}

if(regTelnet || regSsh) {
  regAll();
}

addMessageListener("bbsfox@ettoolong:bbsfox-globalCommand", function(message) {
  unregAll();
  sendSyncMessage("bbsfox@ettoolong:bbsfox-globalCommand", {name:'unload'});
});
