            function set_elapsed_time_display() {
                var currentPos = 0.0;
                if (end) {
                    currentPos = end;
                }

                var displayValue = currentPos / 1000;
                var displayOffset = longestTimeOffset / 1000;
                var displayText = displayValue + "/" + displayOffset;
                $("#amount").val(displayText);
            }
	    
	    function initControlPanel(){
	    $("#playSlider").slider({
                    value: 0,
                    min: 0,
                    max: 100,
                    step: 1,
                    slide: function (event, ui) {
                        if ($("#playPauseButton").attr("class") == pauseClass) {
                            $("#playPauseButton").click();
                        }
                        var prevEnd = end;
                        var sliderValue = ui.value;
                        end = (longestTimeOffset * ui.value) / 100;

                        if (prevEnd && prevEnd > end) {
                            goingBackwards = true;
                        }
                        if (start > end) {
                            if (showIncrement === true) {
                                start = (longestTimeOffset * (ui.value - 1.0)) / 100;
                            } else {
                                start = 0.0;
                            }
                            goingBackwards = true;
                        }
                        set_elapsed_time_display();
                        showtracks();
                        start = end;
                    }
                });
                $("#amount").val($("#playSlider").slider("value"));
                //~ $('#playSlider').attr('class', sliderClass);
                $('#playPauseButton').bind("click", function () {
                    if ($(this).attr("class") == playClass) {
                        $(this).attr("class", pauseClass);
                        if (speed_mult == 0) {
                            end = longestTimeOffset;
                            $("#playSlider").slider("value", 100.0);
                            set_elapsed_time_display();
                            $(this).attr("class", playClass);
                            if (end === 0.0 && longestTimeOffset === 0.0) {
                                forceDisplay = true;
                            }
                        }
                        showtracks();
                    } else {
                        if (fcancel) {
                            fcancel();
                        }
                        $(this).attr("class", playClass);
                    }
                });
                $('#playPauseButton').attr('class', playClass);

                $('#stopButton').bind("click", function () {
                    if (fcancel) {
                        fcancel();
                    }
                    reset();
                    set_elapsed_time_display();
                });
                $('#stopButton').attr('class', stopClass);
	}