// arch-tag: e811a872-33f7-463a-b023-0d2d5e4cbc4f
//
// Copyright (c) 2005 Mike Kenney
// released under GPL

// Implement a proper conditional-GET for XMLHttpRequest as this feature
// appears to be broken in both major browsers. Mozilla always re-fetches
// the document and IE always gets the document from the cache.
//
// To use, simply instantiate an object, the constructor needs to be passed
// a factory function for an XMLHttpRequest object:
//
//    var cache = new ReqCache(function() { return GXmlHttp.create(); });
//
// The only method you really need after that is cache.fetch():
//
//    cache.fetch(url, function(proc_contents) { ...}, 
//                     function(req) { ...},
//                     function(contents) {...});
//
// The first argument is the URL string, the second argument is a function
// which is passed the (possibly processed) contents of the request. The third 
// argument is an error-callback, this function is called if the server returns 
// a status code other than 200 or 304 and is passed the XMLHttpRequest object. 
// The fourth argument is a processing function and is passed the "contents" of
// the request. The output of this function (if present) is what is actually
// stored in the cache and passed to the first callback.
//
// Note that the "contents" is normally an XML DOM Document but may be a string 
// (if the mime-type of the response was not text/xml). .
//
function ReqCache() {
	var callbackObject;
	var req;
	var cache;
	var theProc;
	var theCallback;
	var theError;
	var theUrl;
	
	//~ var jqxhr = $.ajax(
                     //~ url:		"example.html",
		     //~ cache: true,
	             //~ dataType: "xml")
    //~ .done(function() { alert("success"); })
    //~ .fail(function() { alert("error"); })
    //~ .always(function() { alert("complete"); });

    
    // TODO probably want some of these functions to be private
    
    
    // Mozilla throws an exeception for non-existent headers...
    function get_header(req, name) {
        try {
            return req.getResponseHeader(name);
        } catch(e) {
            return "";
        }
    }

    //this.reqfactory = reqfactory;
    this.entries = new Array();
    this.access = 0;
    this.hits = 0;

    this.addEntry = function(props, key) {
        var obj = new Array();
        for(var pkey in props) {
            obj[pkey] = props[pkey];
        }
        this.entries[key] = obj;
    };

    this.getEntry = function(key) {
        return this.entries[key];
    };

    this.flush = function(oldest) {
        if(!oldest) {
	    this.entries = new Array();
            return;
        }

        for(var key in this.entries) {
            if((this.entries[key].ctime - oldest) < 0)
                delete this.entries[key];
        }
    };

    this.stats = function() {
        return [this.access, this.hits, this.entries.length];
    }

    this.fetch = function(url, cbackObject, cback, err, f_proc) {
	    theProc = f_proc;
	    theCallback = cback;
	    callbackObject = cbackObject;
	    theError = err;
	    theUrl = url;
	    
	    // TODO this needs to be replaced by the jquery ajax call
	    
        //var req = this.reqfactory();
	 	req = $.ajax({
                     url:	url,
		     cache: true,
	             dataType: "xml"})
    .done(f_success)
    .fail(f_error);
    //.always(function() { alert("complete"); });
        //~ var e = this.getEntry(url);
        cache = this;

        //~ if(!f_proc)
	    //~ f_proc = function(x) { return x; };

        //~ req.open("GET", url, true);
        //~ if(e) {
            //~ if(e.modtime)
                //~ req.setRequestHeader("If-Modified-Since", e.modtime);
            //~ if(e.etag)
                //~ req.setRequestHeader("If-None-Match", e.etag);
        //~ }
	
  //  jqxhr.getResponseHeader();
 
        //req.send(null); 
    };
    
            f_success = function() {
//	    jqxhr.responseXML and/or responseText when the underlying request responded with xml and/or text, respectively
                cache.access++;
                if(req.status == 304) {
                    cache.hits++;
                    theCallback(e.content);
                } else if(req.status == 200) {
                    var content;
                    if(req.responseXML && req.responseXML.documentElement)
                        content = theProc(req.responseXML);
                    else
                        content = theProc(req.responseText);
                    var ctl = get_header(req, "Cache-Control");
                    if(ctl != "no-cache") {
                        cache.addEntry({"modtime" : get_header(req, "Last-Modified"),
                                        "etag" : get_header(req, "ETag"),
                                        "ctime" : new Date(),
                                        "content" : content}, theUrl);
                    }
                    theCallback(content);
	    };
    };
    
    	// No onreadystatechange mechanism is provided, however, since success, error, complete and statusCode cover all conceivable requirements.
        //~ f_success = function() {
//	    jqxhr.responseXML and/or responseText when the underlying request responded with xml and/or text, respectively
                //~ cache.access++;
                //~ if(req.status == 304) {
                    //~ cache.hits++;
                    //~ theCallback(e.content);
                //~ } else 
		//~ if(req.status == 200) {
                    //~ var content;
                    //~ if(req.responseXML && req.responseXML.documentElement)
			//~ content = $.parseXML(req.responseXML);
                        //~ //content = theProc(req.responseXML);
                    //~ else
                        //~ content = theProc(req.responseText);
                    //~ var ctl = get_header(req, "Cache-Control");
                    //~ if(ctl != "no-cache") {
                        //~ cache.addEntry({"modtime" : get_header(req, "Last-Modified"),
                                        //~ "etag" : get_header(req, "ETag"),
                                        //~ "ctime" : new Date(),
                                        //~ "content" : content}, theUrl);
                    //~ }
                    //~ theCallback(content);
	    //~ };
    //~ };
		    
	f_error = function(){
                    if(theError)
                        theError(req);
                    else
                        alert("GET " + theUrl + " returns: " + req.statusText);
                };
}
