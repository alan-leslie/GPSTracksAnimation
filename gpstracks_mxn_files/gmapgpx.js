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
var gpx_ns = "http://www.topografix.com/GPX/1/1";
if (document.getElementsByTagNameNS) {
    var gpxGetElements = function (node, name) {
            try {
                return node.getElementsByTagNameNS(gpx_ns, name);
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
	
	if (typeof elementArray === "object") {
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
	
	var timeElement = gpxGetElements(pts[0], "time");
	var segmentStartDateTime = 0.0;

	if (timeElement.length && timeElement.length > 0) {
		segmentStartDateTime =  gpx_datetime(timeElement[0].firstChild.nodeValue);	
        } 
	
	var theSegment = new GPSTrackSegment(pts, segmentStartDateTime, previousSegmentEnd);
	var segmentEnd = theSegment.points[ptsLength - 1].timeOffset
        this.theSegments.push(theSegment);
	
	var pointsLength = theSegment.points.length;
	if(pointsLength > 0){
		this.elapsedTime = this.elapsedTime + segmentEnd;
	}
	
	previousSegmentEnd = previousSegmentEnd + segmentEnd;
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

//~ GPSTrack.prototype.animate = function (map, colors, speed_mult, maxZ) {
    //~ var fcancel;
    //~ var segs = this.theSegments;
    //~ var segLength = segs.length;
    //~ var segnum = 0;
    //~ var n = colors.length;

    //~ function animation() {
        //~ fcancel = animate_this_segment(segs[segnum], map, {
            //~ 'scale': speed_mult,
            //~ 'skip': 2,
            //~ 'color': colors[segnum % n],
   	    //~ 'zcolor': maxZ,
            //~ 'fdone': function () {
                //~ segnum++;
                //~ if (segnum < segs.length) animation();
                //~ else alert("Animation done");
            //~ }
        //~ });
    //~ }

    //~ animation();
    //~ return fcancel;
//~ };

GPSTrack.prototype.display = function (map, colors, start, end, icon) {
    plot_these_segments(map, 3, this.colour, 3, this.theSegments, start, end);
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
                        var attrs = doc.documentElement.attributes;
                        for(var i = 0;i < attrs.length;i++) {
                            if(attrs[i].nodeValue == gpx_ns) {
                                var name = attrs[i].nodeName;
                                if(name == "xmlns")
                                    gpx_ns_prefix = "";
                                else
                                    gpx_ns_prefix = name.substr(6) + ":";
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
function plot_this_pointlist(pts, map, lw, lineColor, start, end, thisSegmentStart) {
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
	    if(end !== 0.0){
	     if(!end || (theTimeOffset > start && theTimeOffset < end)){
		     var thePoint = new mxn.LatLonPoint(pts[i].latitude, pts[i].longitude);
		     //~ var prevPoint = new mxn.LatLonPoint(pts[i - 1].latitude, pts[i -1].longitude);

		    //~ showPoint(thePoint, prevPoint, lineColor);
		     thePoints.push(thePoint);		     
	     }
     }
        //~ polyPts.push(new mxn.LatLonPoint(pts[i].latitude, pts[i].longitude));
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

function plot_these_segments(map, lw, colour, limit, segs, start, end) {
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
	
         if(end !== 0.0){	    
	if(!end || (end > segmentStart && start < segmentEnd)){
		if (pts.length > limit) {
		    plot_this_pointlist(pts, map, lw, colour, start, end, segmentStart);
		}
        }
}
    }
}
/**
 * Plot a series of track segments as a polyline
 *
 * @param     gpx     top-level GPX DOM node
 * @param     map     GMap object
 * @param     lw      line width (optional: default 2)
 * @param     colors  array of color strings, one for each
 *                     segment (optional: default ['#0000aa']).
 * @param     limit   minimum segment length (optional: default 2)
 */
function plot_segments(gpx, map, lw, colors, limit) {
    if (!lw) lw = 2;
    if (!colors) colors = ["#0000aa"];
    if (!limit) limit = 2;

    var n = colors.length;
    var segs = gpxGetElements(gpx, "trkseg");
    for (var j = 0; j < segs.length; j++) {
        var pts = gpxGetElements(segs[j], "trkpt");
        if (pts.length > limit) {
            plot_pointlist(pts, map, lw, colors[j % n]);
        }
    }
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
function plot_pointlist(pts, map, lw, lineColor) {
    var lw = 2;
    var colors = ['#0000aa'];
    var limit = 2;

    if (!lw) lw = 2;
    if (!lineColor) lineColor = "#0000aa";

    var polyPts = [];

    for (var i = 0; i < pts.length; i++) {
        polyPts.push(new mxn.LatLonPoint(parseFloat(pts[i].getAttribute("lat")), parseFloat(pts[i].getAttribute("lon"))))
    }

    var poly = new mxn.Polyline(polyPts);

    //~ placemark = new Polyline(points);
    poly.addData({
        color: lineColor,
        width: lw //, 
        //~ opacity: theme.lineOpacity, 
        //~ closed: isPolygon, 
        //~ fillColor: theme.fillColor,
        //~ fillOpacity: theme.fillOpacity
    });

    map.addPolyline(poly);

    //map.addOverlay(new GPolyline(poly, color, lw, 0.9));
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
 
//~ function animate_this_segment(seg, map, desc) {
    //~ var scale = desc.scale || 1;
    //~ var skip = desc.skip || 0;
    //~ var color = desc.color || "#ff0000";
    //~ var fstep = desc.fstep;
    //~ var fdone = desc.fdone;
    //~ var npan = desc.npan || 4;
    //~ var zcolor = desc.zcolor || 0;

    // Package-up a function and some state variables. The function
    // updates the map to show the current trackpoint and returns
    // the number of milliseconds until the next trackpoint is reached.
    //~ function make_handler() {
        //~ var pts = seg.points; //gpxGetElements(seg, "trkpt");
        //~ var ptsLength = pts.length;
        //~ var ptnum = skip;
        //~ var lastpt = null;
        //~ var nextT = null;
        //~ var redraw = function () {
                //~ try {
                    //~ pt = new GPoint(parseFloat(pts[ptnum].getAttribute("lon")),
                    //~ parseFloat(pts[ptnum].getAttribute("lat")));
                    //~ pt = new mxn.LatLonPoint(pts[ptnum].latitude, pts[ptnum].longitude);
                    //~ if(zcolor) {
                    //~ var node = gpxGetElements(pts[ptnum], "ele")[0];
                    //~ var elev = parseFloat(node.firstChild.nodeValue);
                    //~ var z = elev/zcolor;
                    //~ if(z < 0)
                    //~ z = 0.;
                    //~ else if(z > 1.)
                    //~ z = 1.;
                    //~ var rgb = hsv2rgb(z*359, 0.9, 0.9);
                    //~ color = rgb.toString();
                    //~ }
                //~ } catch (e) {
                    //~ return 0;
                //~ }

                //~ var T;
                //~ if (nextT) {
                    //~ T = nextT;
                //~ } else {
                    //~ T = gpx_datetime(gpxGetElements(pts[ptnum], "time")[0].firstChild.nodeValue);
                    //~ T = pts[ptnum].time;
                //~ }

                // TODO - recenter map?
                //~ if((ptnum%npan) == 0)
                //~ map.recenterOrPanToLatLng(pt);
                //~ if (lastpt) {
			//~ showPoint(pt, lastpt, color);
                    //map.addOverlay(new GPolyline([lastpt, pt], color, 3, 0.9));
                    //~ var polyPts = [];
                    //~ polyPts.push(lastpt);
                    //~ polyPts.push(pt);

                    //~ var poly = new mxn.Polyline(polyPts);

                    //~ placemark = new Polyline(points);
                    //~ poly.addData({
                        //~ color: color,
                        //~ width: 3 //, 
                        //~ opacity: theme.lineOpacity, 
                        //~ closed: isPolygon, 
                        //~ fillColor: theme.fillColor,
                        //~ fillOpacity: theme.fillOpacity
                    //~ });

                    //~ map.addPolyline(poly);

                    // 	var point = new GLatLng(pt.lat, pt.lon); //you need a lat lng for the marker
                    //    map.addOverlay(new GMarker(point, {icon:beericon})); // takes the vars from beericon and the lat lng from point and pushes it to the map
                    // map.addOverlay(new GMarker(point)); // takes the vars from beericon and the lat lng from point and pushes it to the map
                    //~ if (fstep) fstep(T, lastpt, pt);
                //~ }

                //~ ptnum++;
                //~ lastpt = pt;

                //~ if (ptnum >= pts.length) {
                    //~ return 0;
                //~ } else {
                    //~ nextT = pts[ptnum].time;
                    //~ nextT = gpx_datetime(gpxGetElements(pts[ptnum], "time")[0].firstChild.nodeValue);
                    //~ return nextT.valueOf() - T.valueOf();
                //~ }
            //~ }

        //~ return redraw;
    //~ }


    //~ var handler = make_handler();
    //~ var timeout_id = null;

    // Schedule the redraws with a scaled time interval.
    //~ function go() {
        //~ var dt = handler();
        //~ if (dt > 0) timeout_id = setTimeout(go, dt / scale);
        //~ else if (fdone) setTimeout(fdone, 500);
    //~ }

    //~ go();

    //~ // Return a function which can be used to stop the animation
    //~ return function () {
        //~ clearTimeout(timeout_id);
        //~ alert("Animation canceled");
    //~ };
//~ }


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
function animate_segment(seg, map, desc) {
    var scale = desc.scale || 1;
    var skip = desc.skip || 0;
    var color = desc.color || "#ff0000";
    var fstep = desc.fstep;
    var fdone = desc.fdone;
    var npan = desc.npan || 4;
    var zcolor = desc.zcolor || 0;

    // Package-up a function and some state variables. The function
    // updates the map to show the current trackpoint and returns
    // the number of milliseconds until the next trackpoint is reached.
    function make_handler() {
        var pts = gpxGetElements(seg, "trkpt");
        var ptsLength = pts.length;
        var ptnum = skip;
        var lastpt = null;
        var nextT = null;
        var redraw = function () {
                try {
                    //~ pt = new GPoint(parseFloat(pts[ptnum].getAttribute("lon")),
                    //~ parseFloat(pts[ptnum].getAttribute("lat")));
                    pt = new mxn.LatLonPoint(parseFloat(pts[ptnum].getAttribute("lat")), parseFloat(pts[ptnum].getAttribute("lon")));
                    if (zcolor) {
                        var node = gpxGetElements(pts[ptnum], "ele")[0];
                        var elev = parseFloat(node.firstChild.nodeValue);
                        var z = elev / zcolor;
                        if (z < 0) z = 0.;
                        else if (z > 1.) z = 1.;
                        var rgb = hsv2rgb(z * 359, 0.9, 0.9);
                        color = rgb.toString();
                    }
                } catch (e) {
                    return 0;
                }

                var T;
                if (nextT) T = nextT;
                else T = gpx_datetime(gpxGetElements(pts[ptnum], "time")[0].firstChild.nodeValue);

                // TODO - recenter map?
                //~ if((ptnum%npan) == 0)
                //~ map.recenterOrPanToLatLng(pt);
                if (lastpt) {
                    //map.addOverlay(new GPolyline([lastpt, pt], color, 3, 0.9));
                    var polyPts = [];
                    polyPts.push(lastpt);
                    polyPts.push(pt);

                    var poly = new mxn.Polyline(polyPts);

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

                    // 	var point = new GLatLng(pt.lat, pt.lon); //you need a lat lng for the marker
                    //    map.addOverlay(new GMarker(point, {icon:beericon})); // takes the vars from beericon and the lat lng from point and pushes it to the map
                    // map.addOverlay(new GMarker(point)); // takes the vars from beericon and the lat lng from point and pushes it to the map
                    if (fstep) fstep(T, lastpt, pt);
                }

                ptnum++;
                lastpt = pt;

                if (ptnum >= pts.length) {
                    return 0;
                } else {
                    nextT = gpx_datetime(gpxGetElements(pts[ptnum], "time")[0].firstChild.nodeValue);
                    return nextT.valueOf() - T.valueOf();
                }
            }

        return redraw;
    }


    var handler = make_handler();
    var timeout_id = null;

    // Schedule the redraws with a scaled time interval.
    function go() {
        var dt = handler();
        if (dt > 0) timeout_id = setTimeout(go, dt / scale);
        else if (fdone) setTimeout(fdone, 500);
    }

    go();

    // Return a function which can be used to stop the animation
    return function () {
        clearTimeout(timeout_id);
        alert("Animation canceled");
    };
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


/**
 * Plot a series of GPX points as markers. These points may be waypoints,
 * route-points, or track-points (not recommended because there tend to
 * be large numbers of track points). The point node is processed with the 
 * supplied stylesheet to create the HTML for the associated Info Window.
 *
 * @param     pts     list (Array) of GPX points
 * @param     map     GMap object
 * @param     xslurl  URL of XSL stylesheet
 * @param     icon    GIcon for each marker (optional)
 */
//~ function plot_points_xsl(pts, map, xslurl, icon) {

//~ function create_marker(p, m_icon, xml, xslt) {
//~ var m = new GMarker(p, m_icon);
//~ GEvent.addListener(m, "click", function() {
//~ try {
//~ var html = xsltProcess(xml, xslt);
//~ m.openInfoWindowHtml(html);
//~ } catch(error) {
//~ var div = document.createElement("div");
//~ xslt.transformToHtml(xml, div);
//~ m.openInfoWindow(div);
//~ }
//~ });

//~ return m;
//~ }

//~ if(!icon) {
//~ icon = new GIcon();
//~ icon.image = "http://labs.google.com/ridefinder/images/mm_20_red.png";
//~ icon.shadow = "http://labs.google.com/ridefinder/images/mm_20_shadow.png";
//~ icon.iconSize = new GSize(12, 20);
//~ icon.shadowSize = new GSize(22, 20);
//~ icon.iconAnchor = new GPoint(6, 20);
//~ icon.infoWindowAnchor = new GPoint(5, 1);
//~ }



//~ var xslt_factory;
//~ try {
//~ var __x = xsltProcess;
//~ xsltdebug__ = true;
//~ logging__ = false;
//~ xslt_factory = function(x) { return x; };
//~ } catch(error) {
//~ xslt_factory = GXslt.create;
//~ }

//~ var get_gpoint = function(gpx_pt) {
//~ return new mxn.LatLonPoint(parseFloat(gpx_pt.getAttribute("lat")),
//~ parseFloat(gpx_pt.getAttribute("lon")));
//~ };
//~ /*
//~ * Asynchronously download the XSLT stylesheet and use it to create and
//~ * cache a GXslt object which will then be passed to create_marker function
//~ * for use in the marker 'click' event handler.
//~ */
//~ req_cache.fetch(xslurl,
//~ function(xslt) {
//~ for(var i = 0;i < pts.length;i++) {
//~ var marker = create_marker(get_gpoint(pts[i]), 
//~ icon, pts[i], xslt);
//~ map.addMarker(marker);
//~ }
//~ },
//~ null,
//~ function(resp) {
//~ if(resp.documentElement)
//~ return xslt_factory(resp);
//~ else
//~ return xslt_factory($.parseXML(resp));    //GXml.parse(resp));
//~ });
//~ }
/**
 * Return the bounding box which encloses a set of GPoints.
 *
 * @param  points  array of GPoint objects
 * @return         a GBounds instance
 */
function bounding_box(points) {
    var maxlat = -90;
    var minlat = 90;
    var maxlon = -180;
    var minlon = 180;

    for (var i = 0; i < points.length; i++) {
        if (points[i].x > maxlon) maxlon = points[i].x;
        else if (points[i].x < minlon) minlon = points[i].x;

        if (points[i].y > maxlat) maxlat = points[i].y;
        else if (points[i].y < minlat) minlat = points[i].y;
    }

    var theBounds = {
        minX: minlon,
        maxX: maxlon,
        minY: minlat,
        maxY: maxlat
    };

    //return new GBounds(minlon, maxlat, maxlon, minlat);
    return theBounds;
}

/**
 * Create a GPX string from a list of GPoints. The points will be
 * treated as "route points" if 'route' is 1, otherwise they will be
 * treated as "waypoints".
 *
 * @param  points  array of GPoint objects
 * @param  route   if 1, create a route, otherwise waypoints
 * @return         a string containing the GPX file contents
 */
//~ function make_gpx(points, route) {
//~ var type;
//~ var strings = [];

//~ function start_tag(name, attrs, empty) {
//~ var strings = [];

//~ strings.push("<" + name );
//~ for(var name in attrs) {
//~ strings.push(" " + name + "='" + attrs[name] + "' ");
//~ }

//~ if(empty) {
//~ strings.push("/>");
//~ } else {
//~ strings.push(">");
//~ }

//~ return strings.join("");
//~ }

//~ function end_tag(name) {
//~ return "</" + name + ">";
//~ }

//~ function xml_escape(s) {
//~ return s.replace(/&/g, "&amp;")
//~ .replace(/</g, "&lt;")
//~ .replace(/>/g, "&gt;");
//~ }

//~ var bounds = bounding_box(points);

//~ strings.push("<?xml version='1.0' ?>");
//~ strings.push(start_tag("gpx", {"version" : "1.1",
//~ "creator" : "gmapgpx.js",
//~ "xmlns:xsi" : "http://www.w3.org/2001/XMLSchema-instance",
//~ "xsi:schemaLocation" : "http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd",
//~ "xmlns" : "http://www.topografix.com/GPX/1/1"}, 0));
//~ strings.push(start_tag("metadata", null, 0));
//~ strings.push(start_tag("desc", null, 0));
//~ try {
//~ strings.push(encodeURI(window.location.href));
//~ } catch(e) {
//~ strings.push(escape(window.location.href));
//~ }
//~ strings.push(end_tag("desc"));
//~ strings.push(start_tag("bounds", {"maxlat" : bounds.maxY.toFixed(6),
//~ "maxlon" : bounds.maxX.toFixed(6),
//~ "minlat" : bounds.minY.toFixed(6),
//~ "minlon" : bounds.minX.toFixed(6)}, true));
//~ strings.push(end_tag("metadata"));

//~ if(route) {
//~ strings.push(start_tag("rte", null, 0));
//~ type = "rtept";
//~ } else {
//~ type = "wpt";
//~ }

//~ for(var i = 0; i < points.length;i++) {
//~ strings.push(start_tag(type, {'lat' : points[i].y.toFixed(6),
//~ 'lon' : points[i].x.toFixed(6)}, 0));
//~ try {
//~ strings.push(start_tag("ele"));
//~ strings.push(points[i].parasite["ele"].toFixed(2));
//~ strings.push(end_tag("ele"));
//~ strings.push(start_tag("name"));
//~ strings.push(xml_escape(points[i].parasite["name"]));
//~ strings.push(end_tag("name"));
//~ strings.push(start_tag("desc"));
//~ strings.push(xml_escape(points[i].parasite["desc"]));
//~ strings.push(end_tag("desc"));
//~ } catch(e) {
//~ strings.push(start_tag("name"));
//~ strings.push("GMAP" + i);
//~ strings.push(end_tag("name"));
//~ }
//~ strings.push(end_tag(type));
//~ }

//~ if(route)
//~ strings.push(end_tag("rte"));
//~ strings.push(end_tag("gpx"));
//~ return strings.join("\n");
//~ }
/**
 * Create a GPX XML document from a list of GPoints. The points will be
 * treated as "route points" if 'route' is true, otherwise they will be
 * treated as "waypoints". The function requires the Sarissa Javascript
 * package for cross-browser XML document creation. This function is
 * for the future when browsers properly support loading XML into a
 * popup window.
 *
 * @param  points  array of GPoint objects
 * @param  route   if true, create a route, otherwise waypoints
 * @return         an XML document containing the GPX file contents
 */
//~ function make_gpx_doc(points, route) {
//~ if(!Sarissa.getDomDocument)
//~ return null;

//~ var bounds = bounding_box(points);
//~ var doc = Sarissa.getDomDocument("http://www.topografix.com/GPX/1/1", "gpx");
//~ var gpx = doc.documentElement;
//~ gpx.setAttribute("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance");
//~ gpx.setAttribute("xsi:schemaLocation", 
//~ "http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd");
//~ var node = doc.createElement("metadata");
//~ var sub = doc.createElement("desc");
//~ sub.appendChild(doc.createTextNode(window.location.href));
//~ node.appendChild(sub);
//~ sub = doc.createElement("bounds");
//~ sub.setAttribute("maxlat", bounds.maxY.toFixed(6));
//~ sub.setAttribute("maxlon", bounds.maxX.toFixed(6));
//~ sub.setAttribute("minlat", bounds.minY.toFixed(6));
//~ sub.setAttribute("minlon", bounds.minX.toFixed(6));
//~ node.appendChild(sub);
//~ gpx.appendChild(node);

//~ var type;
//~ if(route) {
//~ node = gpx.appendChild(doc.createElement("rte"));
//~ type = "rtept";
//~ } else {
//~ node = gpx;
//~ type = "wpt";
//~ }

//~ var subelems = ["ele", "name", "desc"];
//~ for(var i = 0; i < points.length;i++) {
//~ var pnode = doc.createElement(type);
//~ pnode.setAttribute("lat", points[i].y.toFixed(6));
//~ pnode.setAttribute("lon", points[i].x.toFixed(6));
//~ try {
//~ for(var j = 0;j < subelems.length;j++) {
//~ sub = doc.createElement(subelems[j]);
//~ sub.appendChild(doc.createTextNode(points[i].parasite[subelems[j]]));
//~ pnode.appendChild(sub);
//~ }
//~ } catch(e) {
//~ sub = doc.createElement("name");
//~ sub.appendChild(doc.createTextNode("GMAP" + i));
//~ pnode.appendChild(sub);
//~ }
//~ node.appendChild(pnode);
//~ }

//~ return doc;
//~ }