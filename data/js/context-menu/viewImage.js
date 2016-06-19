self.on("context", function (node) {
  if(!unsafeWindow.bbsfox) {
    return false;
  }
  return unsafeWindow.bbsfox.prefs.status.mouseOnPicWindow;
});

self.on("click", function(node, data) {
  self.postMessage();
});
