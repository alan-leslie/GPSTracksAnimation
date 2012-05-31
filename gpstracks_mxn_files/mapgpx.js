// arch-tag: e49e6bfd-ad54-4ef5-b434-f157b42a2c3c
//
// GPX utility functions for use with the GMaps API
//
// Copyright (c) 2005 Mike Kenney
// released under GPL
//var req_cache = new ReqCache();
function assert(x) {
    if (!x) {
        if (Error) alert("assertion failed: " + Error().stack);
        else alert("assertion failed");
    }
}

// Work-around for IE's lack of proper namespace support in their
// DOM interface.
var gpx_ns_prefix = "";
var gpx_ns1 = "http://www.topografix.com/GPX/1/1";
var gpx_ns0 = "http://www.topografix.com/GPX/1/0";
var gpx_ns = "";
if (document.getElementsByTagNameNS) {
    var gpxGetElements = function (node, name) {
            try {
                var retVal = node.getElementsByTagNameNS(gpx_ns, name);
		return retVal;
            } catch (e) {
                //alert(e.toString() + "\n" + e.stack);
                return null;
            }
        };
} else {
    var gpxGetElements = function (node, name) {
            return node.getElementsByTagName(gpx_ns_prefix + name);
        };
}

if (typeof Object.create !== 'function') {
    Object.create = function (o) {
        var F = function (o) {};
        F.prototype = o;
        return new F();
    };
};

var GPSTrackPoint = function (thePoint, startDateTime) {
        this.latitude = parseFloat(thePoint.getAttribute("lat"));
        this.longitude = parseFloat(thePoint.getAttribute("lon"));
	
	var timeElement = gpxGetElements(thePoint, "time");
	this.time = 0.0;
	
	if (timeElement.length && timeElement.length > 0) {
		this.time =  gpx_datetime(timeElement[0].firstChild.nodeValue);	
        }
	
	if(startDateTime === null){
		this.timeOffset = 0.0;
	} else {
		this.timeOffset = this.time.valueOf() - startDateTime.valueOf();
	}
	
        var elementArray = gpxGetElements(thePoint, "ele");
	this.elevation = 0.0;
	
	if (elementArray && elementArray.length > 0) {
		this.elevation = parseFloat(elementArray[0].firstChild.nodeValue);
	}
    };

var GPSTrackSegment = function (pts, startDateTime, prevSegmentEnd) {
        // TODO - generate a set of points at regular intervals
	this.prevSegmentEndOffset = prevSegmentEnd;
        this.points = new Array();
        var ptsLength = pts.length;
        for (var i = 0; i < ptsLength; ++i) {
            var thePoint = new GPSTrackPoint(pts[i], startDateTime);
            this.points.push(thePoint);
        }
    };

var GPSTrack = function (theFileName, theColour, onLoadValidFunction, onLoadErrorFunction) {
        var self = this;
        self.fileName = theFileName;
        self.colour = theColour;

        self.isFetched = false;
	self.onLoadValid = onLoadValidFunction;
	self.onLoadError = onLoadErrorFunction;

        self.theSegments = new Array();

        self.theBounds = new mxn.BoundingBox(0.0, 0.0, 0.0, 0.0);
        self.theWayPoints = new Object();
	self.elapsedTime = 0.0;
    };

GPSTrack.prototype.fetch = function (cback, err) {
    var self = this;
    // todo - just set it up so that it calls jquery ajax
    //~ var req = $.ajax({
    //~ url:	url,
    //~ cache: true,
    //~ dataType: "xml"})
    //~ .done(f_success)
    //~ .fail(f_error);
    //~ fetch_gpx(this.fileName, function(gpx, self){cback(gpx, self);}, err);
    var req_cache = new ReqCache();
	
    var theUrl = self.fileName;
	
	    if(theUrl.indexOf("openstreetmap") !== -1){
		  var splitUrl = theUrl.split("/");
		  var trackIdNumber =  splitUrl[splitUrl.length -1];
		  theUrl = "http://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20xml%20where%20url%3D%22http%3A%2F%2Fwww.openstreetmap.org%2Ftrace%2F" + trackIdNumber + "%2Fdata%22";
	    }

    fetch_gpx(req_cache, theUrl, self, this.setup.bind(this), err);
    this.isFetched = true; // this is useless I think 
    return this.isFetched;
};

GPSTrack.prototype.setup = function (gpx) {
    var theXMLSegments = gpxGetElements(gpx, "trkseg");
    var segsLength = theXMLSegments.length;
    var isValid = false;
    var previousSegmentEnd = 0.0;
	
    for (var i = 0; i < segsLength; ++i) {
        var pts = gpxGetElements(theXMLSegments[i], "trkpt");
        var ptsLength = pts.length;
	    
	if(ptsLength > 0){
		if(!isValid){
			isValid = true;
		}
	}
	
	if(ptsLength > 0){
		var timeElement =  gpxGetElements(pts[0], "time");
		var segmentStartDateTime = 0.0;

		if (timeElement.length && timeElement.length > 0) {
			segmentStartDateTime =  gpx_datetime(timeElement[0].firstChild.nodeValue);	
		} 
		
		var theSegment = new GPSTrackSegment(pts, segmentStartDateTime, previousSegmentEnd);
		var segmentEnd = theSegment.points[ptsLength - 1].timeOffset
		this.theSegments.push(theSegment);
		
		this.elapsedTime = this.elapsedTime + segmentEnd;
		previousSegmentEnd = previousSegmentEnd + segmentEnd;
	}
    }
	
    if(isValid){
 	    if(this.onLoadValid){
		    this.onLoadValid(this);
	    }
    } else {
	    if(this.onLoadError){
		    this.onLoadError(this.fileName);
	    }
	    
	    return;
    }
    
    this.theWayPoints = gpxGetElements(gpx, "wpt");
    var xmlBounds = get_bounds(gpx);

    if (!xmlBounds) {
        xmlBounds = this.getBoundsFromSegments();
    }

    this.theBounds.sw = new mxn.LatLonPoint(xmlBounds.minY, xmlBounds.minX);
    this.theBounds.ne = new mxn.LatLonPoint(xmlBounds.maxY, xmlBounds.maxX);
};

GPSTrack.prototype.getBoundsFromSegments = function () {
    var firstPoint = this.theSegments[0].points[0];
    var theMinLon = firstPoint.longitude;
    var theMaxLon = firstPoint.longitude;
    var theMinLat = firstPoint.latitude;
    var theMaxLat = firstPoint.latitude;

    var segsLength = this.theSegments.length;
    for (var i = 0; i < segsLength; ++i) {
        var pts = this.theSegments[i].points;
        var ptsLength = pts.length;

        for (var j = 0; j < ptsLength; ++j) {
            var point = pts[j];

            theMinLon = Math.min(theMinLon, point.longitude);
            theMaxLon = Math.max(theMaxLon, point.longitude);
            theMinLat = Math.min(theMinLat, point.latitude);
            theMaxLat = Math.max(theMaxLat, point.latitude);
        }
    }

    var theBounds = {
        minX: theMinLon,
        maxX: theMaxLon,
        minY: theMinLat,
        maxY: theMaxLat
    };

    return theBounds;
};

GPSTrack.prototype.display = function (map, forceDisplay, start, end, icon) {
    plot_these_segments(map, 3, this.colour, 3, this.theSegments, forceDisplay, start, end);
    plot_points(this.theWayPoints, map, icon);
};

/**
 * Asynchronously fetch the GPX file from the specified URL,
 * The GPX DOM is passed to the callback when the operation
 * is complete.
 *
 * @param  url    URL for the GPX file
 * @param  cback  callback function
 * @param  err    error handler function
 */
var parser = function (s) {
            return $.parseXML(s); //GXml.parse(s);
};
	
function parse_gpx(resp) {
        var doc;
        if (resp.documentElement) doc = resp;
        else doc = parser(resp);
        // Try to find the GPX namespace prefix (IE sucks)
        var attrs = doc.documentElement.attributes;
        for (var i = 0; i < attrs.length; i++) {
            if (attrs[i].nodeValue == gpx_ns) {
                var name = attrs[i].nodeName;
                if (name == "xmlns") gpx_ns_prefix = "";
                else gpx_ns_prefix = name.substr(6) + ":";
            }
        }

        return doc;
    };
    
function fetch_gpx(req_cache, url, callbackObject, cback, err) {
    // Use a processing function to insure that an XML DOM is
    // passed to the callback even if the content-type was
    // text/plain.
    var parser = function(s) {
                     return  $.parseXML(s);   //GXml.parse(s);
                 };
    req_cache.fetch(url,
		    callbackObject,
                    function(xml) {
                        if(!xml)
                            alert("Document contains no data: " + url);
                        else
                            cback(xml);
                    },
                    err,
                    function(resp) {
                        var doc;
                        if(resp.documentElement)
                            doc = resp;
                        else
                            doc = $.parseXML(resp); 
                        // Try to find the GPX namespace prefix (IE sucks)
			var gpxElements = doc.getElementsByTagName("gpx");
			    
			if(gpxElements){
			var gpxLength = gpxElements.length;
                        //~ var attrs = doc.documentElement.attributes;
                        var attrs = gpxElements[0].attributes;
			    for(var i = 0;i < attrs.length;i++) {
                            if(attrs[i].nodeValue == gpx_ns1) {
				gpx_ns = gpx_ns1;
                                var name = attrs[i].nodeName;
                                if(name == "xmlns")
                                    gpx_ns_prefix = "";
                                else
                                    gpx_ns_prefix = name.substr(6) + ":";
                            }
			    if(attrs[i].nodeValue == gpx_ns0) {
				gpx_ns = gpx_ns0;
				var name = attrs[i].nodeName;
                                if(name == "xmlns")
                                    gpx_ns_prefix = "";
                                else
                                    gpx_ns_prefix = name.substr(6) + ":";
                            }
                        }
		}

                        return doc;
                    });
}

/**
 * Return the bounds of a GPX file.
 *
 * @param  gpx  top-level GPX DOM node
 * @return      a GBounds object
 */
function get_bounds(gpx) {
    var bounds = gpxGetElements(gpx, "bounds")[0];
    var theBounds;

    if (bounds) {
        theBounds = {
            minX: parseFloat(bounds.getAttribute("minlon")),
            maxX: parseFloat(bounds.getAttribute("maxlon")),
            minY: parseFloat(bounds.getAttribute("minlat")),
            maxY: parseFloat(bounds.getAttribute("maxlat"))
        };
    }

    return theBounds;
}

/**
 * Convert a GPX datetime string into a JS Date object
 * 
 * @param  input  GPX timestamp string (YYYY-MM-DDTHH:MM:SSZ)
 * @return        a Date object
 */
function gpx_datetime(input) {
    var dts = new String(input).slice(0, -1); // chop the trailing 'Z'
    var dt = dts.split("T");
    var ymd = dt[0].split("-");
    var hms = dt[1].split(":");

    return new Date(ymd[0], ymd[1], ymd[2], hms[0], hms[1], hms[2]);
}

/**
 * Plot a polyline connecting a list of GPX "points". These can be track-points,
 * waypoints, or route-points -- from the DOM standpoint, they are all the
 * same. Techically, this will handle a list of any DOM nodes that have the
 * attributes "lat" and "lon"
 *
 * @param     pts     list (Array) of GPX points
 * @param     map     GMap object
 * @param     lw      line width (optional: default 2)
 * @param     color   line color (optional: default #0000aa)
 */
function plot_this_pointlist(pts, map, lw, lineColor, forceDisplay, start, end, thisSegmentStart) {
    //~ var lw = 2;
    //~ var colors = ['#0000aa'];
    //~ var limit = 2;

    //~ if (!lw) lw = 2;
    //~ if (!lineColor) lineColor = "#0000aa";

    //~ var polyPts = [];
	if(!start) start = 0.0;
	var thePoints = new Array();

    for (var i = 0; i < pts.length; i++) {
	     var theTimeOffset = thisSegmentStart + pts[i].timeOffset;
	    	var shouldDisplay = forceDisplay;
	    
		if(!forceDisplay){
			if(end !== 0.0){	    
				if(!end || (theTimeOffset > start && theTimeOffset < end)){
					shouldDisplay = true;
				}
			}
		}
	
	    if(shouldDisplay){
		     var thePoint = new mxn.LatLonPoint(pts[i].latitude, pts[i].longitude);
		     //~ var prevPoint = new mxn.LatLonPoint(pts[i - 1].latitude, pts[i -1].longitude);

		    //~ showPoint(thePoint, prevPoint, lineColor);
		     thePoints.push(thePoint);		     
	     }
     }
    
    if(thePoints.length > 1){
	    showPoints(thePoints, lineColor);
    }

    //~ var poly = new mxn.Polyline(polyPts);

    //~ placemark = new Polyline(points);
    //~ poly.addData({
        //~ color: lineColor,
        //~ width: lw //, 
        //~ opacity: theme.lineOpacity, 
        //~ closed: isPolygon, 
        //~ fillColor: theme.fillColor,
        //~ fillOpacity: theme.fillOpacity
    //~ });

    //~ map.addPolyline(poly);

    //map.addOverlay(new GPolyline(poly, color, lw, 0.9));
}

/**
 * Plot a series of routes as a polyline with a marker for
 * each route point
 *
 * @param     gpx     top-level GPX DOM node
 * @param     map     GMap object
 * @param     lw      line width (optional: default 2)
 * @param     xsl     URL of XSL stylesheet to convert the route
 *                    point info into HTML
 */
/* function plot_routes(gpx, map, lw, xsl) {
 *     if(!lw)
 *         lw = 2;
 *     var colors = ["#ff0000", "#00ff00", "#0000ff"];
 * 
 *     var n = colors.length;
 *     var routes = gpxGetElements(gpx, "rte");
 *     for(var j = 0;j < routes.length;j++) {
 *         var pts = gpxGetElements(routes[j], "rtept");
 *         plot_pointlist(pts, map, lw, colors[j%n]);
 *         if(xsl)
 *             plot_points_xsl(pts, map, xsl);
 *         else
 *             plot_points(pts, map);
 *     }
 * }
 */

function plot_these_segments(map, lw, colour, limit, segs, forceDisplay, start, end) {
    if (!lw) lw = 2;
    if (!colour) colour = ["#0000aa"];
    if (!limit) limit = 2;
    if (!start) start = 0.0;

    for (var i = 0; i < segs.length; ++i) {
	var pts = segs[i].points; 
	var ptsLength = pts.length;
	var lastTimeOffset =  pts[ptsLength -1].timeOffset;
	var segmentStart = segs[i].prevSegmentEndOffset;
	var segmentEnd = segmentStart + lastTimeOffset;
	var shouldDisplay = forceDisplay;
	    
	if(!forceDisplay){
		if(end !== 0.0){	    
			if(!end || (end > segmentStart && start < segmentEnd)){
				shouldDisplay = true;
			}
		}
	}
	
	if(shouldDisplay){	    
		if (pts.length > limit) {
		    plot_this_pointlist(pts, map, lw, colour, forceDisplay, start, end, segmentStart);
		}
        }
    }
}

/**
 * Animate a GPX track segment in real-time (uses the elapsed time
 * between each track point to set animation interval). The scale
 * argument can be used to speed-up the animation (i.e. setting
 * scale to N will run the animation at N times the real-time rate).
 *
 * @param     seg     GPX trkseg DOM node
 * @param     map     GMap object
 * @param     desc    animation descriptor Object with the following
 *                    attributes:
 *                      scale  =  time interval scale factor
 *                      skip   =  number of initial trackpoints to skip
 *                      color  =  line color
 *                      zcolor =  if != 0, color the line based on Z (elevation). The
 *                                value of zcolor is the maximum elevation. In this
 *                                case the 'color' attribute is ignored.
 *                      fstep  =  callback function for each time step
 *                      fdone  =  callbcak function when animation is complete
 *                      npan   =  "pan" the map every npan points
 * @return            a function taking no arguments which can be called to
 *                    cancel the animation.
 */
                     //map.addOverlay(new GPolyline([lastpt, pt], color, 3, 0.9));
 function showPoints(thePoints, color){
	//~ var polyPts = [];
	    //~ polyPts.push(prevPoint);
	    //~ polyPts.push(thePoint);

	    var poly = new mxn.Polyline(thePoints);

	    //~ placemark = new Polyline(points);
	    poly.addData({
		color: color,
		width: 3 //, 
		//~ opacity: theme.lineOpacity, 
		//~ closed: isPolygon, 
		//~ fillColor: theme.fillColor,
		//~ fillOpacity: theme.fillOpacity
	    });

	    map.addPolyline(poly);
 }
 
/**
 * Create an array of GPoints from a set of GPX elements. The elements may
 * be track-points, route-points, or waypoints.
 *
 * @param  ele  array of GPX DOM elements
 * @return      array of GPoints
 */
function get_points(ele) {
    var pts = [];

    for (var i = 0; i < ele.length; i++) {
        pts.push(new mxn.LatLonPoint(parseFloat(ele[i].getAttribute("lat")), parseFloat(ele[i].getAttribute("lon"))));
    }

    return pts;
}

/**
 * Plot a series of GPX waypoints as markers.If the point has a link associated 
 * with it, use this to construct the HTML for an Info Window.
 *
 * @param     gpx     top-level GPX DOM node
 * @param     map     GMap object
 * @param     xsl     optional XSL stylesheet URL, if present, use
 *                    it to convert the waypoint info to HTML.
 * @param     icon    optional GIcon for each marker
 *
 */
function plot_waypoints(gpx, map, xsl, icon) {
    //~ if(xsl)
    //~ plot_points_xsl(gpxGetElements(gpx, "wpt"), map, xsl, icon);
    //~ else
    plot_points(gpxGetElements(gpx, "wpt"), map, icon);
}


/**
 * Plot a series of GPX waypoints as markers.If the point has a link associated 
 * with it, use this to construct the HTML for an Info Window.
 *
 * @param     rte     GPX rte (route) DOM node
 * @param     map     GMap object
 * @param     xsl     optional XSL stylesheet URL, if present, use
 *                    it to convert the waypoint info to HTML.
 * @param     icon    optional GIcon for each marker
 */
//~ function plot_routepoints(rte, map, xsl, icon) {
//~ if(xsl)
//~ plot_points_xsl(gpxGetElements(rte, "rtept"), map, xsl, icon);
//~ else
//~ plot_points(gpxGetElements(rte, "rtept"), map, icon);
//~ }
/**
 * Plot a series of GPX points as markers. These points may be waypoints,
 * route-points, or track-points (not recommended because there tend to
 * be large numbers of track points). If the point has a link associated 
 * with it, use this to construct the HTML for an Info Window.
 *
 * @param     pts     list (Array) of GPX points
 * @param     map     GMap object
 * @param     icon    GIcon for each marker (optional)
 */
function plot_points(pts, map, icon) {

    function make_handler(marker, html) {
        return function () {
            marker.openInfoWindowHtml(html);
        }
    }

    //~ if(!icon) {
    //~ icon = new GIcon();
    //~ icon.image = "http://labs.google.com/ridefinder/images/mm_20_red.png";
    //~ icon.shadow = "http://labs.google.com/ridefinder/images/mm_20_shadow.png";
    //~ icon.iconSize = new GSize(12, 20);
    //~ icon.shadowSize = new GSize(22, 20);
    //~ icon.iconAnchor = new GPoint(6, 20);
    //~ icon.infoWindowAnchor = new GPoint(5, 1);
    //~ }
    for (var i = 0; i < pts.length; i++) {

        var marker = new mxn.Marker(new mxn.LatLonPoint(parseFloat(pts[i].getAttribute("lat")), parseFloat(pts[i].getAttribute("lon")))); //, icon);
        var links = gpxGetElements(pts[i], "link");
        var desc = gpxGetElements(pts[i], "desc")[0];
        var html = [];
        var options = {
            icon: "./timemap/images/red-circle.png",
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        };
        marker.addData(options);

        //~ if(desc) {
        //~ html.push("<p class='desc'>" + desc + "</p>");
        //~ }

        //~ for(var j = 0;j < links.length;j++) {
        //~ var url = links[j].getAttribute("href");
        //~ var tnode = gpxGetElements(links[j], "text")[0];
        //~ var text;
        //~ if(tnode) {
        //~ text = GXml.value(tnode);
        //~ } else {
        //~ text = url;
        //~ }
        //~ html.push("<a href='" + url + "' target='_new'>" + text + "</a>");
        //~ }


        //~ if(html.length > 0) {
        //~ GEvent.addListener(marker, "click", make_handler(marker, html.join("")));
        //~ }
        map.addMarker(marker);
    }
}
