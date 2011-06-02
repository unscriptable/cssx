/**
 * Copyright (c) 2010 unscriptable.com
 */

/*jslint browser:true, on:true, sub:true */

(function (doc) {
"use strict";

/*
 * RequireJS css! plugin
 * This plugin will load and wait for css files.  This could be handy when
 * loading css files as part of a layer or as a way to apply a run-time theme.
 * Most browsers do not support the load event handler of the link element.
 * Therefore, we have to use other means to detect when a css file loads.
 * (The HTML5 spec states that the LINK element should have a load event, but
 * not even Chrome 8 or FF4b7 have it, yet.
 * http://www.w3.org/TR/html5/semantics.html#the-link-element)
 *
 * This plugin tries to use the load event and a universal work-around when
 * it is invoked the first time.  If the load event works, it is used on
 * every successive load.  Therefore, browsers that support the load event will
 * just work (i.e. no need for hacks!).  FYI, Feature-detecting the load
 * event is tricky since most browsers have a non-functional onload property.
 *
 * The universal work-around watches a stylesheet until its rules are
 * available (not null or undefined).  There are nuances, of course, between
 * the various browsers.  The isLinkReady function accounts for these.
 *
 * Note: it appears that all browsers load @import'ed stylesheets before
 * fully processing the rest of the importing stylesheet. Therefore, we
 * don't need to find and wait for any @import rules explicitly.
 *
 * Note #2: for Opera compatibility, stylesheets must have at least one rule.
 * AFAIK, there's no way to tell the difference between an empty sheet and
 * one that isn't finished loading in Opera (XD or same-domain).
 *
 * Options:
 *      !nowait - does not wait for the stylesheet to be parsed, just loads it
 *
 * Global configuration options:
 *
 * cssDeferLoad: Boolean. You can also instruct this plugin to not wait
 * for css resources. They'll get loaded asap, but other code won't wait
 * for them. This is just like using the !nowait option on every css file.
 *
 * cssWatchPeriod: if direct load-detection techniques fail, this option
 * determines the msec to wait between brute-force checks for rules. The
 * default is 50 msec.
 *
 * You may specify an alternate file extension:
 *      require('css!myproj/component.less') // --> myproj/component.less
 *      require('css!myproj/component.scss') // --> myproj/component.scss
 *
 * When using alternative file extensions, be sure to serve the files from
 * the server with the correct mime type (text/css) or some browsers won't
 * parse them, causing an error in the plugin.
 *
 * usage:
 *      require(['css!myproj/comp']); // load and wait for myproj/comp.css
 *      define(['css!some/folder/file'], {}); // wait for some/folder/file.css
 *      require(['css!myWidget!nowait']);
 *
 * Tested in:
 *      Firefox 1.5, 2.0, 3.0, 3.5, 3.6, and 4.0b6
 *      Safari 3.0.4, 3.2.1, 5.0
 *      Chrome 7 (8+ is partly b0rked)
 *      Opera 9.52, 10.63, and Opera 11.00
 *      IE 6, 7, and 8
 *      Netscape 7.2 (WTF? SRSLY!)
 * Does not work in Safari 2.x :(
 * In Chrome 8+, there's no way to wait for cross-domain (XD) stylesheets.
 * See comments in the code below.
 * TODO: figure out how to be forward-compatible when browsers support HTML5's
 *  load handler without breaking IE and Opera
*/


	var
		// compressibility shortcuts
		onreadystatechange = 'onreadystatechange',
		onload = 'onload',
		createElement = 'createElement',
		// failed is true if RequireJS threw an exception
		failed = false,
		undef, importDepthError = {},
		insertedSheets = {},
		features = {
			// true if the onload event handler works
			// "event-link-onload" : false
		},
		// find the head element and set it to it's standard property if nec.
		head = doc.head || (doc.head = doc.getElementsByTagName('head')[0]);

	function absoluteUrl(base, url) {
		if(!url || url.indexOf(":") > 0){
			return url;
		}
		// in IE we do this trick to get the absolute URL
		var lastUrl;
		url = ((base || location.toString()).replace(/[^\/]*$/,'') + url).replace(/\/\.\//g,'/');
		while(lastUrl != url){
			lastUrl = url;
			url = url.replace(/\/[^\/]+\/\.\.\//g, '/');
		}
		return url;
	}
	function has (feature) {
		return features[feature];
	}

	// failure detection
	// we need to watch for onError when using RequireJS so we can shut off
	// our setTimeouts when it encounters an error.
	if (require.onError) {
		require.onError = (function (orig) {
			return function () {
				failed = true;
				orig.apply(this, arguments);
			}
		})(require.onError);
	}

	/***** load-detection functions *****/

	function loadHandler (params, cb) {
		// We're using 'readystatechange' because IE and Opera happily support both
		var link = params.link;
		link[onreadystatechange] = link[onload] = function () {
			if (!link.readyState || link.readyState == 'complete') {
				features["event-link-onload"] = true;
				cleanup(params);
				cb();
			}
		};
	}

	function nameWithExt (name, defaultExt) {
		return name.lastIndexOf('.') <= name.lastIndexOf('/') ?
			name + '.' + defaultExt : name;
	}

	function parseSuffixes (name) {
		// creates a dual-structure: both an array and a hashmap
		// suffixes[0] is the actual name
		var parts = name.split('!'),
			suf, i = 1, pair;
		while ((suf = parts[i++])) { // double-parens to avoid jslint griping
			pair = suf.split('=', 2);
			parts[pair[0]] = pair.length == 2 ? pair[1] : true;
		}
		return parts;
	}

	function createLink (doc, optHref) {
		var link = doc[createElement]('link');
		link.rel = "stylesheet";
		link.type = "text/css";
		if (optHref) {
			link.href = optHref;
		}
		return link;
	}

	// Chrome 8 hax0rs!
	// This is an ugly hack needed by Chrome 8+ which no longer waits for rules
	// to be applied to the document before exposing them to javascript.
	// Unfortunately, this routine will never fire for XD stylsheets since
	// Chrome will also throw an exception if attempting to access the rules
	// of an XD stylesheet.  Therefore, there's no way to detect the load
	// event of XD stylesheets until Google fixes this, preferably with a
	// functional load event!  As a work-around, use ready() before rendering
	// widgets / components that need the css to be ready.
	var testEl;
	function styleIsApplied () {
		if (!testEl) {
			testEl = document[createElement]('div');
			testEl.id = '_cssx_load_test';
			testEl.style.cssText = 'position:absolute;top:-999px;left:-999px;';
			doc.body.appendChild(testEl);
		}
		return doc.defaultView.getComputedStyle(testEl, null).marginTop == '-5px';
	}

	function isLinkReady (link) {
		// This routine is a bit fragile: browser vendors seem oblivious to
		// the need to know precisely when stylesheets load.  Therefore, we need
		// to continually test beta browsers until they all support the LINK load
		// event like IE and Opera.
		var sheet, rules, ready = false;
		try {
			// webkit's and IE's sheet is null until the sheet is loaded
			sheet = link.sheet || link.styleSheet;
			if(sheet){
				// mozilla's sheet throws an exception if trying to access xd rules
				rules = sheet.cssRules || sheet.rules;
				// webkit's xd sheet returns rules == null
				// opera's sheet always returns rules, but length is zero until loaded
				// friggin IE doesn't count @import rules as rules, but IE should
				// never hit this routine anyways.
				ready = rules ?
					rules.length > 0 : // || (sheet.imports && sheet.imports.length > 0) :
					rules !== undef;
				// thanks, Chrome 8, for this lovely hack
				if (ready && navigator.userAgent.indexOf('Chrome') >= 0) {
					sheet.insertRule('#_cssx_load_test{margin-top:-5px;}', 0);
					ready = styleIsApplied();
					sheet.deleteRule(0);
				}
			}
		}
		catch (ex) {
			// 1000 means FF loaded an xd stylesheet
			// other browsers just throw a security error here (IE uses the phrase 'Access is denied')
			ready = (ex.code == 1000) || (ex.message.match(/security|denied/i));
		}
		return ready;
	}

	function ssWatcher (params, cb) {
		// watches a stylesheet for loading signs.
		if (isLinkReady(params.link)) {
			cleanup(params);
			cb();
		}
		else if (!failed) {
			setTimeout(function () { ssWatcher(params, cb); }, params.wait);
		}
	}

	function loadDetector (params, cb) {
		// It would be nice to use onload everywhere, but the onload handler
		// only works in IE and Opera.
		// Detecting it cross-browser is completely impossible, too, since
		// THE BROWSERS ARE LIARS! DON'T TELL ME YOU HAVE AN ONLOAD PROPERTY
		// IF IT DOESN'T DO ANYTHING!
		var loaded;
		function cbOnce () {
			if (!loaded) {
				loaded = true;
				cb();
			}
		}
		loadHandler(params, cbOnce);
		if (!has("event-link-onload")) ssWatcher(params, cbOnce);
	}

	function cleanup (params) {
		var link = params.link;
		link[onreadystatechange] = link[onload] = null;
	}

	/***** finally! the actual plugin *****/

	var plugin = {

			//prefix: 'css',

			'load': function (resourceDef, require, callback, config) {
				var resources = resourceDef.split(","),
					loadingCount = resources.length,

				// all detector functions must ensure that this function only gets
				// called once per stylesheet!
					loaded = 
				function () {
					// load/error handler may have executed before stylesheet is
					// fully parsed / processed in Opera, so use setTimeout.
					// Opera will process before the it next enters the event loop
					// (so 0 msec is enough time).
					if(--loadingCount == 0){
						// TODO: move this setTimeout to loadHandler
						var onCssLoaded = function () {
							//document.head.insertBefore(link, link.nextSibling);
							function loadOnce(sheet, baseUrl){
								// sheet.href is the standard way to access to absolute URL if it isn't IE,
								// but IE9 completely calculates the sheet.href incorrectly when 
								// @import occurs from a style sheet with a different base URI than the page
								try{
									var href = sheet.ownerRule && sheet.removeImport && // removeImport indicates it is IE
										sheet.ownerRule.href;
								}catch(e){
									// certain IE setups will fail to access ownerRule.href, but sheet.href is valid
								}
								href = absoluteUrl(baseUrl, sheet.correctHref || sheet.href); 
								console.log("href" + href);
								var existingSheet = href && insertedSheets[href]; 
								if(existingSheet){
									var sheetToDelete;
									if(existingSheet != sheet){
										var existingElement = existingSheet.ownerElement;
										if(existingElement.compareDocumentPosition ? 
												existingElement.compareDocumentPosition(link) != 2 :
												existingElement.sourceIndex <= link.sourceIndex){
											// this new sheet is after (or current), so we kill this one
											sheetToDelete = sheet;
										}else{
											// the other sheet is after, so delete it
											sheetToDelete = existingSheet;
										}
										//sheetToDelete.disabled = true;
										var owner = sheetToDelete.ownerNode || !sheetToDelete.parentStyleSheet && sheetToDelete.owningElement;
										if(owner){
											// it is top level <link>, remove the node (disabling doesn't work properly in IE, but node removal works everywhere)
											owner.parentNode.removeChild(owner); 
										}else{
											// disabling is the only way to remove an imported stylesheet in firefox; it doesn't work in IE and WebKit
											sheetToDelete.disabled = true;
											// removing the rule is only way to remove an imported stylesheet in IE and WebKit
											owner = sheetToDelete.ownerRule || sheetToDelete;
											console.log("deleting " + sheetToDelete.href + " from " + sheetToDelete.parentStyleSheet.href);
											var removeImport = existingSheet.removeImport;
											if(removeImport){
												sheetToDelete.cssText ="";
											}else{
											try{
												var parentStyleSheet = owner.parentStyleSheet;
												var parentRules = parentStyleSheet.imports || parentStyleSheet.rules || parentStyleSheet.cssRules;
												for(var i = 0; i < parentRules.length; i++){
													// find the index of the owner rule that we want to delete
													if(parentRules[i] == owner){
														parentStyleSheet[removeImport ? "removeImport" : "deleteRule"](i);
														break;
													}
												}
												return true;
											}catch(e){
												// opera fails on deleteRule for imports, but the disabled works, so we can continue
												console.log(e);
											}
											}
										}
									}
								}else{
									/*var recoverFromFailedLoad = function(){
										// this is an initial attempt at fixing/correcting for IE's 2 level depth maximum on @import
										var parentStyleSheet = sheet.parentStyleSheet.parentStyleSheet;
										parentStyleSheet.addImport(href);
										sheet = parentStyleSheet.imports[0];
										console.log("retrying")
										// TODO: this should cancel out
										setTimeout(function(){
											loadOnce(sheet, baseUrl);
										}, 10);
									};
									if("cssText" in sheet && !sheet.cssText){ // In IE 8 and earlier, sheets that are 3 levels deep are disabled //"cssText" in sheet && !sheet.cssText){
										// not ready yet, keep trying later
										debugger;
										throw importDepthError;
										recoverFromFailedLoad();
										return;
									}*/
									if(href){
										insertedSheets[href] = sheet;
										sheet.ownerElement = link;
									}
									// now recurse into @import's to check to make sure each of those is only loaded once 
									try{
										var importRules = sheet.imports || sheet.rules || sheet.cssRules;
										importRules.length;
									}catch(e){
										// In IE, sheets that are 3 levels deep throw an error here
										debugger;
										var parentStyleSheet = sheet.parentStyleSheet.parentStyleSheet;
										parentStyleSheet.addImport(href, 0); // TODO: right index here
										sheet = parentStyleSheet.imports[0];
										console.log("retrying")
										// TODO: this should cancel out
										setTimeout(function(){
											loadOnce(sheet, baseUrl);
										}, 10);
										return;
									}
									
									for(var i = 0; i < importRules.length; i++){
										var rule = importRules[i];
										if(rule.href){
										/*if(rule.href && rule.parentStyleSheet){
											//	rule.imports && rule.imports.length; // accessing the imports should throw an error in IE if we are too many levels deep
											if("cssText" in rule && !rule.cssText){
												console.log("retrying " + rule.href);
												(function(sheet){
													setTimeout(function(){
														console.log("in retry" + sheet.href);
														loadOnce(sheet, href);
													}, 400);
												})(rule);
											}else{*/
												//try{
													if(loadOnce(rule.styleSheet || rule, href)){
														i--; // deleted, so go back in index
													}
												/*}catch(e){
													if(e){ // e.message.match(/storage/)
														var subImports = rule.imports;
														for(var j = 0; j < subImports.length; j++){
															sheet.addImport(subImports[j].href, i);
														}
														i--;
													}
												}*/
										}
									}
								}
							}
							function computeImportUrls(sheet, baseUrl){
								var computedUrls = []
								// IE miscalculates .href properties, so we calculate them by parsing
								sheet.cssText.replace(/@import url\( ([^ ]+) \)/g, function(t, url){
										// we have to actually parse the cssText because IE's href property is totally wrong
										computedUrls.push(absoluteUrl(baseUrl, url));
									});
								return computedUrls;
							}
							function flattenImports(){
								// IE doesn't support deeply nested @imports, so we flatten them.
								//	IE needs imports rearranged and then to go through on a later turn.
								// This function is a big pile of IE fixes
								var flatteningOccurred, sheet = link.styleSheet;
								if(sheet.processed){
									return;
								}
								console.log("sheet css " + sheet.cssText);
								if(!sheet.computedUrls){
									// we have to do in a pre-loop or else IE's messes up on it's ownerRule's order
									sheet.computedUrls = computeImportUrls(sheet, absoluteUrl(location.toString(), sheet.href));
								}
								for(var i = 0; i < sheet.imports.length; i++){
									var importedSheet = sheet.imports[i];
									console.log("importedSheet " + importedSheet.href + " = " + importedSheet.cssText)
									if(!importedSheet.cssText && !importedSheet.loaded){ // empty means it is not loaded yet, try again later
										console.log("import not loaded, deferring until later")
										setTimeout(flattenImports, 50);
										return;
									}
									importedSheet.loaded = true;
									var correctHref = importedSheet.correctHref = sheet.computedUrls[i];
									
									var childHrefs = computeImportUrls(importedSheet, correctHref);
									// Deep in an IE stylesheet
									for(var j = 0; j < importedSheet.imports.length; j++){
										// TODO: Think we can just stay in place and remove
										var subImport = importedSheet.imports[j];
										if(!subImport.correctHref){
											flatteningOccurred = true;
											link.onload = flattenImports;
											console.log(importedSheet.imports.length);
											var childHref = childHrefs[j];
											console.log("importedSheet.href " + importedSheet.href + " childHref " + childHref);
											console.log("import at " + childHref + " at " + i);
											sheet.computedUrls.splice(i, 0, childHref);
											sheet.addImport(childHref, i++);
											subImport.correctHref = childHref; 
										}
									}
								}
								if(flatteningOccurred){
									setTimeout(flattenImports, 50);
								}else{
									console.log("done flattening");
									sheet.processed = true;
									loadOnce(sheet);
									callback(link);
								}
							}
							if(link.styleSheet && link.styleSheet.removeImport){
								return flattenImports();
							}
							loadOnce(link.sheet || link.styleSheet);
							callback(link); 
						};
						onCssLoaded();
						//setTimeout(onCssLoaded,0);
					}
				}

				// after will become truthy once the loop executes a second time
				for(var i = 0, after; i < resources.length; i++, after = url){
					resourceDef = resources[i];
					var
						// TODO: this is a bit weird: find a better way to extract name?
						opts = parseSuffixes(resourceDef),
						name = opts.shift(),
						url = nameWithExt(require.toUrl(name), 'css'),
						link = createLink(doc),
						nowait = 'nowait' in opts ? opts.nowait != 'false' : !!(config && config.cssDeferLoad),
						params = {
							link: link,
							url: url,
							wait: config && config.cssWatchPeriod || 50
						};
					if (nowait) {
						callback(link);
					}
					else {
						// hook up load detector(s)
						loadDetector(params, loaded);
					}

					// go!
					link.href = url;

					head.appendChild(link);
				}
			},

			/* the following methods are public in case they're useful to other plugins */

			'nameWithExt': nameWithExt,

			'parseSuffixes': parseSuffixes,

			'createLink': createLink

		};

	define(plugin);

})(document);
