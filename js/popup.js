

document.addEventListener('DOMContentLoaded', function () {
  init();
});

function init() {
  getActiveTab();
  getBookmarks();
  initEvents();
}

var tabTitle, tabUrl, favIconUrl, selectedText;
var newFolderOnSave = false;

function getActiveTab() {

  //Get active tab title and URL
  //Append any selected text to title
  chrome.tabs.query( { active: true, currentWindow: true }, function(tab){

    // This receives a message from the window with any selected text on-page
    // A long-winded hack in order to make this functionality possible
    chrome.tabs.sendMessage(tab[0].id, {method: "getSelection"}, function(response){

      if (response) {
        selectedText = response.data;
      }

      //Find favicon url, which is an element of Chrome's tab API
      //Set it to background image of icon
      favIconUrl = tab[0].favIconUrl;
      if (favIconUrl !== undefined) {
        $('.icon-title').text('').css('background-image', 'url('+favIconUrl+')');
      }

      //Find url and title, also Chrome tab API
      tabUrl = tab[0].url;
      tabTitle = tab[0].title;

      //Set input values
      $('.js-input-url').val(tabUrl);
      //If there's selected text, prepend it to beginning of title in quotes
      if (selectedText) {
        $('.js-input-title').val('"'+ selectedText +'" - ' + tabTitle);
      } else {
        $('.js-input-title').val(tabTitle);
      }

    }); // eo tabs.sendMessage
  }); // eo tabs.query

} //eo getActiveTab

var select2open = false;
var updateOnSave = false;
var activeBookmark = false;
var allFolders = new Array();

function getBookmarks(){

  $(document).on('click', '.js-use-this-folder', function(e){
    e.preventDefault();
    $('.js-select-folder').select2("val", $(this).data('id'));
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
    chrome.bookmarks.getTree(function (bookmarkTreeNode) {

        // console.log("All Bookmarks Object:", bookmarkTreeNode[0]);
        var bookmarksObj = bookmarkTreeNode[0];
        getBookmarksWithin(bookmarksObj);

        function getBookmarksWithin(folderObj) {
          try {
            var folderTitle = folderObj.title;
            var folderChildren = folderObj.children;

            //If folder exists (might be empty)
            if (folderChildren) {
              addFolderOption(folderObj);

              // If folder has children
              if (folderChildren.length && folderChildren.length > 0) {
                for (var c = 0; c < folderChildren.length; c++) {
                  getBookmarksWithin(folderChildren[c]);
                }
              }
            }
            //else, this is a bookmark, and which we should check against current URL
            else {
              var bookmarkUrl = folderObj.url;
              if ( bookmarkUrl == tabUrl || bookmarkUrl.split('#')[0] == tabUrl.split('#')[0] ) {
                //Check for hash differences, which Google doesn't do.
                activeBookmark = folderObj;
                updateOnSave = true;
                $('.save-btn').val('Update');
                $('.popup-body').addClass('is-update-mode');
              }
            }
          }
          catch(e) {
            error(e);
          }

        } //eo getBookmarksWithin

        function addFolderOption(folderObj){
          var folderTitle = folderObj.title;

          if (folderTitle !== "") {
            var folderId = parseInt(folderObj.id);

            if (folderObj.dateGroupModified) {
              //Only want to sort modifiable folders
              allFolders[allFolders.length] = folderObj;
            }

            var option = $('<option>');
            option.text( decodeEntities(folderTitle) );
            option.attr('value', folderId);

            $('.js-select-folder').append(option);
          }

        }//eo addFolderOption


        $('.js-select-folder').select2({
          escapeMarkup: function (text) {
            return text;
          }
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

          function compare(a,b) {
            return  b.dateGroupModified - a.dateGroupModified;
          }

          if (allFolders) {
            //Add buttons for recently-saved folders
            //TODO: this should be adjused to use the first one if activeBookmark is true
            allFolders.sort(compare);
            // console.log(allFolders);

            //except not for the first one.
            for (var f = 1; f < 4; f++) {
              var button = $('<button class="js-use-this-folder recent-folder-btn">');
              button.attr('data-id', parseInt(allFolders[f].id));
              button.text(allFolders[f].title);
              $('.js-recent-folders').append(button);
            }

          }

          if (activeBookmark !== false) {
            $('.js-input-title').val(activeBookmark.title);
            $('.js-select-folder').select2('val', activeBookmark.parentId);
          } else {
            $('.js-select-folder').select2('val', allFolders[0].id);
          }

        });//eo select2 init

  }//eo chrome.bookmarks.getTree
}//eo getBookmarks()


function initEvents() {

  //Bind save event
  //This should use an updated tabTitle and tabUrl value
  $('.js-save-btn').on('click', function(){
    var folderId = $(".js-select-folder").select2("val");
    tabTitle = $('.js-input-title').val();
    tabUrl = $('.js-input-url').val();

    //If we're saving this to an existing folder
    if (newFolderOnSave == false) {
      if (updateOnSave == false) {
        chrome.bookmarks.create({'parentId': folderId, 'title': tabTitle, 'url': tabUrl });
      }
      if (updateOnSave == true) {
        chrome.bookmarks.move(activeBookmark.id, {'parentId': folderId} );
      }
    }

    //If we're saving it to a new folder
    else if (newFolderOnSave == true) {
      var newFolderName = $('.js-input-new-folder').val();

      //Create the folder, and save the bookmark within the callback
      chrome.bookmarks.create({'title': newFolderName, 'parentId': folderId},
        function(newBookmarkFolder){
          folderId = newBookmarkFolder.id;
          //Afterwards, we'll save it to the new folder.
          //How we save it depends on whether we're moving it or saving a brand new bookmark
          if (updateOnSave == false) {
            chrome.bookmarks.create({'parentId': folderId, 'title': tabTitle, 'url': tabUrl });
          } else if (updateOnSave == true) {
            //Only title and url are supported for update function, so we'll delete then create
            chrome.bookmarks.move(activeBookmark.id, {'parentId': folderId} );
          }
      });
    }

    //All set
    window.close();

  });

  $('.js-delete-btn').on('click', function(){
    chrome.bookmarks.remove(activeBookmark.id, function(){
      //All set
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
      // Enter Key
      if(e.keyCode == 13){
        if ($('.select2-container--focus').length > 0) {
          return;
        } else {
          $('.js-save-btn').trigger('click');
        }
      // Escape Key
      } else if (e.keyCode == 27) {
        if (select2open == true) {
          return;
        } else {
          window.close();
        }
      // Tab Key
      // Needed to add some extra support for select2 menu to open
      } else if (e.keyCode == 9) {
        setTimeout(function(e){
          if ($('.select2-container--focus').length > 0) {
            $('.js-select-folder').select2('open');
          }
        },1 );
      }
  })

  //Manages focus states to support special styling
  $(document).on('focus', 'input, select', function(e){
    $('.is-focused').removeClass('is-focused');
    if ($(this).closest('.input-group').length > 0) {
      $(this).closest('.input-group').addClass('is-focused');
    } else if ($(this).closest('.select2-container').length > 0) {
      $('.select2-group').addClass('is-focused');
    }
  });

} //eo initEvents

function error(e) {
  console.log('This is an error from the Bookmark Pro extenstion. Please report it to jeff@jeffvlahos.com', e);
}

//Helper Functions
var decodeEntities = (function() {
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
