self.on("context", function (node) {
  if(!unsafeWindow.bbsfox) {
    return false;
  }
  let allLinks = unsafeWindow.document.getElementsByTagName('a');
  return unsafeWindow.bbsfox.prefs.openAllLinkMenu && (allLinks.length > 0);
});

self.on("click", function(node, data) {
  self.postMessage();
});
