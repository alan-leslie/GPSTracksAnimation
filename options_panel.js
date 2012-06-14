	function initOptionsPanel(){
                $("#intro").dialog({
                    autoOpen: false,
                    modal: true,
                    width: 450
                });
                $("#source_code").dialog({
                    autoOpen: false,
                    modal: true,
                    width: 400
                });
                $("#add_empty").dialog({
                    autoOpen: false,
                    modal: true
                });
                $("#add_already_exists").dialog({
                    autoOpen: false,
                    modal: true
                });
                $("#no_gps_data").dialog({
                    autoOpen: false,
                    modal: true
                });
                $("#no_file").dialog({
                    autoOpen: false,
                    modal: true
                });
		
		$('#IncrementButton').bind("click", function () {
                    if (!showIncrement) {
                        if ($("#playPauseButton").attr("class") == pauseClass) {
                            $("#playPauseButton").click();
                        }
                    }
                    showIncrement = true;
                });
                $('#FullTrackButton').bind("click", function () {
                    if (showIncrement) {
                        if ($("#playPauseButton").attr("class") == pauseClass) {
                            $("#playPauseButton").click();
                        }
                    }
                    showIncrement = false;
                });
	}
	
	// removes items from listBox identified by sourceID
        // assumes that multi select is possible
        function listbox_remove(sourceID) {
            var listBox = document.getElementById(sourceID);
            var removedItems = new Array();

            //iterate through each option of the listbox
            for (var count = listBox.options.length - 1; count >= 0; count--) {
                //if the option is selected, delete the option
                if (listBox.options[count].selected == true) {
                    var itemText = listBox.options[count].text;
                    removedItems.push(count);

                    try {
                        listBox.remove(count, null);
                    } catch (error) {
                        listBox.remove(count);
                    }
                }
            }

            // rebuild the tracks
            var newTracks = new Array();
            var tracksLength = tracks.length;
            var removedItemsLength = removedItems.length;
            for (var i = 0; i < tracksLength; ++i) {
                var matchFound = false;
                for (var j = 0; j < removedItemsLength; ++j) {
                    if (j === i) {
                        matchFound = true;
                    }
                }
                if (!matchFound) {
                    newTracks.push(tracks[i]);
                }
            }
            tracks = newTracks;

            var lsLength = listBox.length;

            // mobile list box is showing up as dropdown 
            // select last option to make sure that an option is shown
            if (lsLength > 0) {
                if (isMobile === true) {
                    var itemSelector = '#lsbox :nth-child(' + lsLength + ')';
                    $(itemSelector).attr('selected', 'selected');
                }
            }

            var newTracksLength = tracks.length;
            longestTimeOffset = 0.0;
            for (var k = 0; k < newTracksLength; ++k) {
                longestTimeOffset = Math.max(longestTimeOffset, tracks[k].elapsedTime);
            }

            sliderTimeIncrement = longestTimeOffset / 100;

            isSetup = false;
            reset();
            set_elapsed_time_display();
        }

        // complete adding the track to the list box and list of tracks
        // called when GPX data is successfully fetched for track
        function completeAdd(theTrack) {
            tracks.push(theTrack);
            longestTimeOffset = 0.0;

            var tracksLength = tracks.length;
            for (var i = 0; i < tracksLength; ++i) {
                longestTimeOffset = Math.max(longestTimeOffset, tracks[i].elapsedTime);
            }

            sliderTimeIncrement = longestTimeOffset / 100;

            var listBox = document.getElementById('lsbox');
            var listBoxItem = document.createElement("option");

            var displayText = theTrack.fileName;
            if (displayText.indexOf("openstreetmap") !== -1) {
                var splitUrl = displayText.split("/");
                var trackIdNumber = splitUrl[splitUrl.length - 1];
                displayText = "OSM-" + trackIdNumber;
            }

            if (isMobile === true) {
                var colourName = getColourName(theTrack.colour);
                displayText = "(" + colourName + ") " + displayText;
            }

            listBoxItem.value = theTrack.fileName;
            listBoxItem.text = displayText;
            listBox.add(listBoxItem, null);
            var lsLength = listBox.length;

            // todo - using this selector is silly
            // should use jquery from the start (to create option etc).
            if (lsLength > 0) {
                var itemSelector = '#lsbox :nth-child(' + lsLength + ')';
                // mobile list box is showing up as dropdown 
                // select last option to make sure that an option is shown
                if (isMobile === true) {
                    $(itemSelector).attr('selected', 'selected');
                } else {
                    $(itemSelector).css({
                        'background': theTrack.colour
                    });
                    var foregroundColour = getForegroundColour(theTrack.colour);
                    $(itemSelector).css({
                        'color': foregroundColour
                    });
                }
            }

            isSetup = false;
            set_elapsed_time_display();
            $("#btnAddItem").attr("disabled", false);
        }
	
	function get_available_colour(trackIndex) {
                var colors = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#00ffff", "#ff00ff", "#000000", "#ffffff"];
                var n = colors.length;
                var theColour = colors[colourIndex % n];
                ++colourIndex;
                return theColour;
         }

        // get a colour that contrasts with the background colour
        function getForegroundColour(backgroundColour) {
            if (backgroundColour === "#ff0000" || backgroundColour === "#0000ff" || backgroundColour === "#000000") {
                return '#ffffff';
            }

            return '#000000';
        }

        function getColourName(colour) {
            if (colour === "#ff0000") {
                return 'red';
            }

            if (colour === "#00ff00") {
                return 'green';
            }

            if (colour === "#0000ff") {
                return 'blue';
            }

            if (colour === "#ffff00") {
                return 'yellow';
            }

            if (colour === "#00ffff") {
                return 'cyan';
            }

            if (colour === "#ff00ff") {
                return 'magenta';
            }

            if (colour === "#000000") {
                return 'black';
            }

            if (colour === "#ffffff") {
                return 'white';
            }
        }

        function errorAdd(itemText) {
            $("#no_gps_data").dialog('open');
            resetAddButton();
        }

        function fileNotFoundError() {
            $("#no_file").dialog('open');
            resetAddButton();
        }

        function resetAddButton() {
            $("#btnAddItem").attr("disabled", false);
        }

        function help_button() {
            // todo - need style set correctly
            $("#intro").dialog('open');
        }

        function credits_button() {
            // todo - need style set correctly
            $("#source_code").dialog('open');
        }

        // initital attempt to add item to list box
        // note that if the file has valid GPX data completeAdd is called
        function addNewListItem(newItem) {
            var listBox = document.getElementById('lsbox');
            var itemValue = document.getElementById('txtValue');
            if (newItem) {
                itemValue.value = newItem;
                itemValue.text = newItem;
            }

            if (itemValue.value == '') {
                $("#add_empty").dialog('open');
                itemValue.focus();
                return false;
            }

            if (isOptionAlreadyExist(listBox, itemValue.value)) {
                $("#add_already_exists").dialog('open');
                itemValue.focus();
                return false;
            }

            var trackIndex = tracks.length;
            var trackColour = get_available_colour(trackIndex);
            var theTrace = new GPSTrack(itemValue.value, trackColour, completeAdd, errorAdd);
            var fetched = theTrace.fetch(null, fileNotFoundError);

            $("#btnAddItem").attr("disabled", true);
            return true;
        }

        function isOptionAlreadyExist(listBox, value) {
            var exists = false;
            for (var x = 0; x < listBox.options.length; x++) {
                if (listBox.options[x].value == value || listBox.options[x].text == value) {
                    exists = true;
                    break;
                }
            }
            return exists;
        }