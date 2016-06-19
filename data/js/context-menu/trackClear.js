self.on("context", function (node) {
  if(!unsafeWindow.bbsfox) {
    return false;
  }

  if(unsafeWindow.bbsfox.prefs.keyWordTrackMenu) {
    let highlightWords = unsafeWindow.bbsfox.prefs.highlightWords_local;
    return (highlightWords.length > 0);
  }
  else {
    return false;
  }
});

self.on("click", function(node, data) {
  self.postMessage();
  //unsafeWindow.bbsfox.overlaycmd.exec({command:"previewPicture", pictureUrl:eventStatus.pictureUrl});
});
