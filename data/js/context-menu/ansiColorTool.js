self.on("context", function (node) {
  if(!unsafeWindow.bbsfox) {
    return false;
  }
  return unsafeWindow.bbsfox.prefs.ansiColorToolMenu && !unsafeWindow.bbsfox.prefs.status.ansiColorToolOpened;
});

self.on("click", function(node, data) {
  unsafeWindow.bbsfox.overlaycmd.exec({command:"openAnsiColorTool"});
});
