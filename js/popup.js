
var attempts = 0;

function init() {
  getTabInfo();
  getBookmarks();
  // if (tabUrl !== undefined) {
  //   attempts = 3;
  //   getBookmarks();
  // } else if (attempts < 3) {
  //   attempts++;
  //   setTimeout(function(){
  //     init();
  //   }, 100);
  // }
}

var tabTitle, tabUrl, favIconUrl;
var newFolderOnSave = false;

function getTabInfo() {

  //Get active tab title and URL
  //Append any selected text to title
  chrome.tabs.query({active: true, currentWindow: true}, function(tab){
      chrome.tabs.sendMessage(tab[0].id, {method: "getSelection"},
      function(response){
        if (response) {
          var selectedText = response.data;
        }
        favIconUrl = tab[0].favIconUrl;
        if (favIconUrl !== undefined) {
          $('.icon-title').text('').css('background-image', 'url('+favIconUrl+')');
        }
        tabUrl = tab[0].url;
        tabTitle = tab[0].title;

        $('.js-input-url').val(tabUrl);
        if (selectedText) {
          $('.js-input-title').val('"'+ selectedText +'" - ' + tabTitle);
        } else {
          $('.js-input-title').val(tabTitle);
        }
      });
  });

  //Bind save event
  //This should use an updated tabTitle and tabUrl value
  $('.js-save-btn').on('click', function(){
    var folderId = $(".js-select-folder").select2("val");
    tabTitle = $('.js-input-title').val();
    tabUrl = $('.js-input-url').val();
    if (newFolderOnSave == true) {
      var newFolderName = $('.js-input-new-folder').val();
      chrome.bookmarks.create({'title': newFolderName, 'parentId': folderId},
        function(newBookmarkFolder){
          folderId = newBookmarkFolder.id;
          if (updateOnSave == false) {
            chrome.bookmarks.create({'parentId': folderId, 'title': tabTitle, 'url': tabUrl });
          } else if (updateOnSave == true) {
            //Only title and url are supported for update function, so we'll delete then create
            chrome.bookmarks.remove(activeBookmark.id, function(){
              chrome.bookmarks.create({'parentId': folderId, 'title': tabTitle, 'url': tabUrl });
            });
          }
      });
    } else {
      if (updateOnSave == false) {
        chrome.bookmarks.create({'parentId': folderId, 'title': tabTitle, 'url': tabUrl });
      } else if (updateOnSave == true) {
        //Only title and url are supported for update function, so we'll delete then create
        chrome.bookmarks.remove(activeBookmark.id, function(){
          chrome.bookmarks.create({'parentId': folderId, 'title': tabTitle, 'url': tabUrl });
        });
      }
    }
    window.close();

  });

  $('.js-delete-btn').on('click', function(){
    chrome.bookmarks.remove(activeBookmark.id, function(){
      window.close();
    });
  });

  $('.js-new-folder-btn').on('click', function(){
    if (newFolderOnSave == false) {
      $('body').addClass('is-new-folder-mode');
      newFolderOnSave = true;
      $(this).text('Cancel');
      $('.js-input-new-folder').trigger('focus');
    } else {
      $('body').removeClass('is-new-folder-mode');
      newFolderOnSave = false;
      $(this).text('New Folder');
      $('html, body').css('height', '190px');
    }
  });

  $(document).keydown(function (e){
      if(e.keyCode == 13){
        if ($('.select2-container--focus').length > 0) {
          return;
        } else {
          $('.js-save-btn').trigger('click');
        }
      } else if (e.keyCode == 27) {
        if (select2open == true) {
          return;
        } else {
          window.close();
        }
      } else if (e.keyCode == 9) {
        setTimeout(function(e){
          if ($('.select2-container--focus').length > 0) {
            $('.js-select-folder').select2('open');
          }
        },1 );
      }
  })

  $(document).on('focus', 'input, select', function(e){
    $('.is-focused').removeClass('is-focused');
    if ($(this).closest('.input-group').length > 0) {
      $(this).closest('.input-group').addClass('is-focused');
    } else if ($(this).closest('.select2-container').length > 0) {
      $('.select2-group').addClass('is-focused');
    }

  });

}

var select2open = false;
var updateOnSave = false;
var activeBookmark = false;

function getBookmarks(){

  //Get recently-saved bookmarks in order to find recently-saved-to folders
  var recentParents = new Array();
  chrome.bookmarks.getRecent(15, function(bookmarks){
    var i;
    var count = 0;
    for (i = 0; i < bookmarks.length; i++) {
      if (!isInArray(parseInt(bookmarks[i].parentId), recentParents) ) {
        if (count < 4) {
          count++;
          recentParents[recentParents.length] = parseInt(bookmarks[i].parentId);
          if (i > 0) {
            chrome.bookmarks.get(bookmarks[i].parentId, function(parent){
              var button = $('<button class="js-use-this-folder recent-folder-btn">');
              button.attr('data-id', parseInt(parent[0].id));
              button.text(parent[0].title);
              $('.js-recent-folders').prepend(button);
            });
          }
        }
      }
    }
    $(document).on('click', '.js-use-this-folder', function(e){
      e.preventDefault();
      $('.js-select-folder').select2("val", $(this).data('id'));
    });
  });


  var bookmarksBarId;
  //Get bookmarks and create dropdown menu
  chrome.bookmarks.getTree(
    function(bookmarkTreeNode){
      bookmarksBarId = bookmarkTreeNode[0].children[0].id;
      getBookmarkFoldersWithin(bookmarksBarId);
  });

  function getBookmarkFoldersWithin(bookmarksBarId) {
    //Get bookmarks and create dropdown menu
    chrome.bookmarks.getSubTree( bookmarksBarId,
      function(bookmarkTreeNode){
        var bookmarkItems = bookmarkTreeNode[0].children;
        var i;
        var optGroup = $('<optgroup label="Bookmarks Bar">');

        for (i = 0; i < bookmarkItems.length; i++ ) {
          var item = bookmarkItems[i];

          //If item has children, process it as a folder
          if (item.children) {
            var parent = item;
            var option = $('<option>');
            option.text( decodeEntities(parent.title) );
            option.attr('value', parent.id);
            if (parseInt(parent.id) == parseInt(recentParents[0])) {
              option.attr('selected', 'selected');
            }
            optGroup.append(option);

            var x;
            var hasFolders = false;
            for (x = 0; x < parent.children.length; x++ ) {
              var child = parent.children[x];
              if (child.children) {
                if (hasFolders == false) {
                  var dOptGroup = $('<optgroup label="'+ parent.title +'">');
                  hasFolders = true;
                }
                var dOption = $('<option>');
                dOption.text( decodeEntities(child.title) );
                dOption.attr('value', child.id);
                if (parseInt(child.id) == parseInt(recentParents[0])) {
                  dOption.attr('selected', 'selected');
                }
                dOptGroup.append(dOption);
              } else if ( child.url == tabUrl || child.url.split('#')[0] == tabUrl.split('#')[0] ) {
                //Check for hash differences, which Google doesn't do.
                activeBookmark = child;
                updateOnSave = true;
                $('.save-btn').val('Update');
                $('.popup-body').addClass('is-update-mode');
              }
            }
            $('.js-select-folder').append(dOptGroup);

          }
        } //eo for loop bookmarkItems

        var bookmarksBarOption = $('<option>');
        bookmarksBarOption.attr('value', 1).text("Bookmarks Bar");

        $('.js-select-folder').prepend(optGroup);
        $('.js-select-folder').prepend(bookmarksBarOption);

        $('.js-select-folder').select2({
          escapeMarkup: function (text) { return text; }
          })
          .on("select2:open", function () {
            select2open = true;
           $('html, body').css('height', '365px');
           $('.select2-search__field').attr('placeholder', 'Search for a folder...');
          })
          .on("select2:close", function () {
           $('html, body').css('height', '190px');
           setTimeout(function(){
            select2open = false;
           },100);
          });

        if (activeBookmark !== false) {
          $('.js-input-title').val(activeBookmark.title);
          $('.js-select-folder').select2('val', activeBookmark.parentId);
        }
    });
  }

}//eo getBookmarks()


function isInArray(value, array) {
  return array.indexOf(value) > -1;
}

var decodeEntities = (function() {
  // this prevents any overhead from creating the object each time
  var element = document.createElement('div');

  function decodeHTMLEntities (str) {
    if(str && typeof str === 'string') {
      // strip script/html tags
      str = str.replace(/<script[^>]*>([\S\s]*?)<\/script>/gmi, '');
      str = str.replace(/<\/?\w(?:[^"'>]|"[^"]*"|'[^']*')*>/gmi, '');
      element.innerHTML = str;
      str = element.textContent;
      element.textContent = '';
    }

    return str;
  }

  return decodeHTMLEntities;
})();

document.addEventListener('DOMContentLoaded', function () {
  init();
});
