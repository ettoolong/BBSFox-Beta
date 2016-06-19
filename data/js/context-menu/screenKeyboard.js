self.on("context", function (node) {
  if(!unsafeWindow.bbsfox) {
    return false;
  }
  return unsafeWindow.bbsfox.prefs.screenKeyboardMenu && !unsafeWindow.bbsfox.prefs.status.screenKeyboardOpened;
});

self.on("click", function(node, data) {
  unsafeWindow.bbsfox.overlaycmd.exec({command:"openSymbolInput"});
});
