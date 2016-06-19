self.on("context", function (node) {
  if(!unsafeWindow.bbsfox) {
    return false;
  }
  return unsafeWindow.bbsfox.prefs.switchBgDisplayMenu && unsafeWindow.bbsfox.prefs.enableBackground;
});

self.on("click", function(node, data) {
  self.postMessage();
});
