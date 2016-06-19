function AnsiFile(ansiColor) {
    this.ansi = ansiColor;
    this.listener = ansiColor.listener;
}

AnsiFile.prototype = {
    doPasteFileData: function(data) {
        //TODO: remove clipboard operation, paste data directly
        //FIXME: load file with different charset
        var text = this.ansi.convertStringToUTF8(data);
        //this.ansi.ansiClipboard(text);
        this.ansi.paste(text);
    },

    savePage: function(saveMode) {
        //FIXME: save file with different charset
            var downloadArticle = this.listener.robot.downloadArticle;
            var _this = this;
            downloadArticle.finishCallback(function(data) {
                _this.saveFile(data, saveMode);
            });
            downloadArticle.startDownloadEx(saveMode);
    },

    openTab: function() {
    	//TODO: need modify for E10S
      var downloadArticle = this.listener.robot.downloadArticle;
      var _this = this;
      downloadArticle.finishCallback(function(data) {
        //_this.openNewTab(data);
        //console.log(data);
        bbsfox.sendCoreCommand({command: "openEasyReadingTab", htmlData: data});
      });
      downloadArticle.startDownloadEx(2);
    },

    loadFile: function() {
      var nsIFilePicker = Components.interfaces.nsIFilePicker;
      bbsfox.sendCoreCommand({command: "openFilepicker",
                              title: null,
                              mode: nsIFilePicker.modeOpen,
                              appendFilters: [nsIFilePicker.filterAll],
                              postCommand: "doPasteFileData"});
    },

    saveFile: function(data, saveMode) {
      var nsIFilePicker = Components.interfaces.nsIFilePicker;
      var defaultExtension = '';
      var defaultString = '';
      var appendFilters = [];
      var convertUTF8 = false;
      var utf8BOM = false;

      if(saveMode == 0)
      {
        if(this.listener.prefs.deleteSpaceWhenCopy)
          data = data.replace(/[ \t\f]+$/gm,'');
        convertUTF8 = true;
        utf8BOM = true;
        defaultExtension = 'txt';
        defaultString = 'newtext';
        appendFilters.push(nsIFilePicker.filterAll);
      }
      else if(saveMode == 1)
      {
        defaultExtension = 'ans';
        defaultString = 'newansi';
        appendFilters.push(nsIFilePicker.filterAll);
      }
      else //if(saveMode == 2)
      {
        convertUTF8 = true;
        defaultExtension = 'html';
        defaultString = 'newhtml';
        appendFilters.push(nsIFilePicker.filterHTML);
      }

      bbsfox.sendCoreCommand({command: "openFilepicker",
                              title: null,
                              mode: nsIFilePicker.modeSave,
                              defaultExtension:defaultExtension,
                              defaultString: defaultString,
                              appendFilters: appendFilters,
                              saveData: data,
                              convertUTF8: convertUTF8,
                              utf8BOM: utf8BOM});
    }
};
