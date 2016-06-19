// reference: Working with multiprocess Firefox
// https://developer.mozilla.org/en-US/Add-ons/Working_with_multiprocess_Firefox

//console.log('global frame-script.js');

var regTelnet = Components.manager.QueryInterface(Components.interfaces.nsIComponentRegistrar)
             .isContractIDRegistered('@mozilla.org/network/protocol;1?name=telnet') ? false : true;

var regSsh = Components.manager.QueryInterface(Components.interfaces.nsIComponentRegistrar)
             .isContractIDRegistered('@mozilla.org/network/protocol;1?name=ssh') ? false : true;

// var regAbout = Components.manager.QueryInterface(Components.interfaces.nsIComponentRegistrar)
//              .isContractIDRegistered('@mozilla.org/network/protocol/about;1?what=bbsfox') ? false : true;

function setProtocol( enable ) {

  let createFactory = function () {
      // Register/unregister a constructor as a component.
      let Factory = {
        QueryInterface: function QueryInterface(iid){
          if (iid.equals(Components.interfaces.nsIFactory))
            return this;
          else
            throw Components.results.NS_ERROR_NO_INTERFACE;
        },

        _targetConstructor: null,

        register: function register(targetConstructor) {
          this._targetConstructor = targetConstructor;
          var proto = targetConstructor.prototype;
          var registrar = Components.manager.QueryInterface(Components.interfaces.nsIComponentRegistrar);
          if(registrar.isContractIDRegistered(proto.contractID) ) {

          } else {
            registrar.registerFactory(proto.classID, proto.classDescription, proto.contractID, this);
          }
        },

        unregister: function unregister() {
          var proto = this._targetConstructor.prototype;
          var registrar = Components.manager.QueryInterface(Components.interfaces.nsIComponentRegistrar);
          registrar.unregisterFactory(proto.classID, this);
          this._targetConstructor = null;
        },

        // nsIFactory
        createInstance: function createInstance(aOuter, iid) {
          if (aOuter !== null)
            throw Components.results.NS_ERROR_NO_AGGREGATION;
          return (new (this._targetConstructor)).QueryInterface(iid);
        },

        // nsIFactory
        lockFactory: function lockFactory(lock) {
          // No longer used as of gecko 1.7.
          throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
        }
      };
      return Factory;
  };

  if(enable) {
    Components.utils.import("chrome://bbsfox/content/protocols/install_telnet_protocol.js");
    createFactory().register(TelnetProtocol);

    Components.utils.import("chrome://bbsfox/content/protocols/install_ssh_protocol.js");
    createFactory().register(SshProtocol);
  } else {
    //how to unregister protocol?
  }

//   if(regAbout) {
//     Components.utils.import("resource://bbsfox/install_about_page.js");
//     createFactory().register(BBSFoxAboutPage);
//   }

  {
    //TODO: need fix, if bbsfoxBg directory not exists!
    Components.utils.import("resource://gre/modules/osfile.jsm");
    let ios = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
    let resource = ios.getProtocolHandler("resource").QueryInterface(Components.interfaces.nsIResProtocolHandler);
    let dir = OS.Path.join(OS.Constants.Path.profileDir, 'bbsfoxBg');
    try{
      OS.File.makeDir(dir);
    } catch(ex) {

    }
    let alias = ios.newURI( OS.Path.toFileURI( OS.Path.join(OS.Constants.Path.profileDir, 'bbsfoxBg', 'bbsfox') ), null, null);
    resource.setSubstitution("bbsfox2", alias);
  }

}

if(regSsh || regTelnet) {
  setProtocol(true);
}

// addMessageListener("bbsfox@ettoolong:bbsfox-globalCommand",
//   function(message) {
//     //TODO: unregister protocol
//   }
// );
