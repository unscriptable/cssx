/**
 * Copyright (c) 2010 unscriptable.com
 */

/*jslint browser:true, on:true, sub:true */

/**
 * cssx instructions can be located in any of three places:
 * 1. as directives at the top of css files
 * 2. as loader suffixes
 * 3. as global configuration options
 *
 * global configuration options
 *
 * TODO: revisit these config options ad suffixes
 * cssxIgnore: Array of Strings or String
 * Set cssxIgnore to a list of cssx plugin names to ignore. Optionally,
 * set it to "all" to ignore all plugin names found in css files.
 * Use the !inspect loader suffix or directive to override cssxIgnore.
 *
 * TODO: remove preloads
 * cssxPreload: Array
 * Set cssxPreload to a list of names of plugins that should be loaded
 * before processing any css files. Unless overridden by an !ignore
 * loader suffix or directive in a css file, all css files
 * will be scanned by these plugins.
 *
 * TODO: remove cssxAuto
 * cssxAuto: Boolean, default = true
 * Set cssxAuto to false to prevent cssx from attempting to
 * automatically download and apply plugins that are discovered
 * in css rules.  For instance, if a -cssx-scrollbar-width property is
 * found in a rule, cssx will normally load the "scrollbar" plugin
 * and create a rule to supply the correct value. If cssxAuto is
 * false, cssx will ignore -cssx-scrollbar-width unless the plugin was
 * preloaded or specified in a directive.
 *
 * cssxDirectiveLimit: Number, default = 200
 * Set cssxDirectiveLimit to the number of characters into a css file
 * to look for cssx directives before giving up.  Set this to zero
 * if you don't want cssx to scan for directives at all.  Set it to
 * a very high number if you're concatenating css files together!
 * Override this via the !limit loader suffix.
 *
 * Suffixes can be applied to resources when listed as a dependency.
 * e.g. define(['cssx/cssx!myModule!ignore=ieLayout'], callback);
 *
 * Available suffixes:
 * !ignore: a comma-separated list of cssx plugins to ignore
 * TODO: remove: !inspect: a comma-separated list of cssx plugins to run
 * !scanlimit: the number of characters into the css file to search
 * 		for cssx directives
 *
 */

define(
	[
		'./css',
		'./shims'
	],
	function (css, shims) {
		"use strict";


		function StyleSheet () {
			this._thens = [];
		}
		function ExtendedStyleSheet () {}
		StyleSheet.prototype = {

			then: function (resolve, reject) {
				// capture calls to then()
				this._thens.push({ resolve: resolve, reject: reject });
				return this;
			},

			resolve: function (val) { this._complete('resolve', val); },

			reject: function (ex) { this._complete('reject', ex); },

			_complete: function (which, arg) {
				// switch over to sync then()
				this.then = which === 'resolve' ?
					function (resolve, reject) { resolve && resolve(arg); return this; } :
					function (resolve, reject) { reject && reject(arg); return this; };
				// disallow multiple calls to resolve or reject
				this.resolve = this.reject =
					function () { throw new Error('Promise already completed.'); };
				// complete all async then()s
				var aThen, i = 0;
				while (aThen = this._thens[i++]) { aThen[which] && aThen[which](arg); }
				delete this._thens;
			},

			extend: function () {
				ExtendedStyleSheet.prototype = this;
				var ess = new ExtendedStyleSheet;
				// process each extension argument
				for (var i = 0; i < arguments.length; i++) {
					var arg = arguments[i];
					for (var j in arg) {
						// TODO: delegate to the previous if one exists 
						ess[j] = arg[j];
					}
				}
				if (ess.cssText) {
					ess.applyExtensions();
				}
				return ess;
			},

			applyExtensions: function () {
				var css = this.cssText;
				// initial event
				if (typeof this.onsheet == "function") {
					css = this.onsheet(css);
				}
				function Rule () {}
				Rule.prototype = {
					eachProperty: function (onproperty) {
						var selector, css;
						selector = (this.children ? onproperty(0, "layout", this.children) || this.selector : this.selector);
						css = this.cssText.replace(/\s*([^;:]+)\s*:\s*([^;]+)?/g, function (full, name, value) {
							if (styleSheet.onvalue) {
								value = styleSheet.onvalue(value, name);
							}
							onproperty(full, name, value);
						});
						return selector +  "{" + css + "}"; // process all the css properties
					},
					cssText: ""
				};
				
				var lastRule = new Rule;
				lastRule.css = css;
				var styleSheet = this;
				function onproperty (full, name, value) {
					// TODO: stop clobbering the onvalue result with "return full;"
					// this is called for each CSS property
					var propertyHandler = styleSheet["on" + name] || styleSheet.onproperty;
					if(typeof propertyHandler == "function"){
						// we have a CSS property handler for this property
						var result = propertyHandler(value, lastRule, name);
						if(typeof result == "string"){
							// replacement CSS
							return result;
						}
					}
					return full;
				}
				// parse the CSS, finding each rule
				css = css.replace(/\s*(?:([^{;\s]+)\s*{)?\s*([^{}]+;)?\s*(};?)?/g, function (full, selector, properties, close) {
					// called for each rule
					if (selector) {
						// a selector was found, start a new rule (note this can be nested inside another selector)
						var newRule = new Rule();
						(lastRule.children || (lastRule.children = [])).push(newRule); // add to the parent layout 
						newRule._parent = lastRule;
						var parentSelector = lastRule.selector;
						newRule.selector = (parentSelector ? parentSelector + " " : "") + selector;
						newRule.child = selector; // just this segment of selector
						lastRule = newRule;
					}
					if (properties) {
						// some properties were found
						lastRule.cssText += properties;
					}
					if (close) {
						// rule was closed with }
						var result = lastRule.eachProperty(onproperty);
						if(styleSheet.onrule){
							styleSheet.onrule(lastRule);
						}
						lastRule = lastRule._parent;
						return result; 
					}
					return "";
				});
				lastRule.eachProperty(onproperty);
				// might only need to do this if we have rendering rules
				if (this.cssText != css) {
					this.cssText = css;
					// it was modified, add the modified one
					//createStyleNode(css);
				}
				return this;
			}

		};
		for (var i in css) {
			StyleSheet.prototype[i] = css[i];
		}
		var
//			preloading,
			undef;

//		function checkCssxDirectives (text) {
//			// check for any cssx markers in the file
//			// limit this search to the first XXX lines or first XXX chars
//			var top = text.substr(0, 500),
//				optMatches = text.match(/\s?\/*\s?cssx:(.*?)(?:$|;|\*\/)/m),
//				opts = {},
//				opText, pair;
//			while (opText = optMatches.unshift()) {
//				var pairs = optMatches[i].split(/\s?,\s?/), opt;
//				while (opt = pairs.unshift()) {
//					pair = opt.split(/\s?\.\s?/);
//					opts[pair[0]] = pair[1];
//				}
//			}
//			return opts;
//		}

		function listHasItem (list, item) {
			return list ? (',' + list + ',').indexOf(',' + item + ',') >= 0 : false;
		}

//		function chain (func, after) {
//			return function (processor, args) {
//				func(processor, args);
//				after(processor, args);
//			};
//		}

//		function applyCssx (processor, cssText, plugins) {
//			// attach plugin callbacks
//			var callbacks = {
//				},
//				count = 0;
//			try {
//				for (var p in callbacks) (function (cb, p) {
//					for (var i = 0; i < plugins.length; i++) {
//						if (plugins[i][p]) {
//							cb = function (processor, args) {
//								cb && cb(processor, args);
//								plugins[i][p](processor, args);
//							};
//	//						cb = chain(cb, plugins[i][p]);
//							count++;
//						}
//					}
//					if (cb !== undef) {
//						callbacks[p] = function () { cb(processor, arguments); }
//					}
//				}(callbacks[p], p));
//				if (count > 0) {
//					// TODO: parse file, applying cssx fixes as found
//					new CssTextParser(callbacks).parse(cssText);
//				}
//				processor.resolve(processor.cssText);
//			}
//			catch (ex) {
//				processor.reject(ex);
//			}
//		}

		// go get shims
		var shimCallback = new StyleSheet(); // we really just want a promise
		shims(function (allShims) {

			var methods = StyleSheet.prototype;

			// augment prototype, cascading onvalue, onproperty, and onXXX handlers
			for (var i in allShims) {
				for (var p in allShims[i]) (function (shimFunc, name, existing) {
					if (name == 'onvalue') {
						methods[name] = function (value, prop) {
							var result = shimFunc(value, prop);
							return existing ? existing(result, prop) : result;
						}
					}
					else if (name == 'onproperty') {
						methods[name] = function (value, rule, prop) {
							var result = shimFunc(value, rule, prop);
							return existing ? existing(result, rule, prop) : result;
						}
					}
					else if (!existing) {
						methods[name] = shimFunc;
					}
					else {
						methods[name] = function () {
							// last shim loaded wins
							var result = shimFunc.apply(this, arguments);
							return typeof result == 'string' ? result : existing.apply(this, arguments);
						};
					}
				}(allShims[i][p], p, methods[p]))
			}


			shimCallback.resolve();

		});

		var plugin = {};
		plugin.load = function (name, require, callback, config) {

			shimCallback.then(function () {

				// create a promise
				var cssx = new StyleSheet();
				// add some useful stuff to it
				cssx.cssText = '';
				// tell promise to write out style element when it's resolved
				cssx.then(function (cssx) {
					// TODO: finish this
					if (cssx.cssText) createStyleNode(cssx.cssText);
				})
				// tell promise to call back to the loader
				.then(
					callback.resolve ? callback.resolve : callback,
					callback.reject ? callback.reject : undef
				);

	//				// check for preloads
	//				if (preloading === undef) {
	//					preloading = true;
	//					var preloads = [];
	//					for (var p in activations) {
	//						if (activations.hasOwnProperty(p)) {
	//							// TODO: supply the environment parameter
	//							if (activations.load({ isBuild: false }, sniff)) {
	//								preloads.push('./plugin/' + p);
	//							}
	//						}
	//					}
	//					require(preloads, function () { preloading = false; process(); });
	//				}
	//				else {
	//					preloading = false;
	//				}

				// check for special instructions (via suffixes) on the name
				var opts = css.parseSuffixes(name),
					dontExecCssx = config.cssxDirectiveLimit <= 0 && listHasItem(opts.ignore, 'all');

				function process () {
	//					if (!preloading) {
	//					if (cssx.link) {
							if (dontExecCssx) {
								cssx.resolve(cssx);
							}
							else { //} if (cssx.cssText != undef /* truthy if null or undefined, but not "" */) {
								// TODO: get directives in file to see what rules to skip/exclude
								//var directives = checkCssxDirectives(cssx.cssText);
								// TODO: get list of excludes from suffixes

									cssx.applyExtensions();
	//								var directives = [];
	//								require(directives, function () {
								cssx.resolve(cssx);
							}
	//					}
	//					}
				}

				function gotLink (link) {
					cssx.link = link;
					cssx.resolve();
				}

				function gotText (text) {
					cssx.cssText = text;
					process();
				}

				var url = require['toUrl'](css.nameWithExt(name, 'css'));

				if (isXDomain(url, document)) {
					// get css file (link) via the css plugin
					// TODO: pass a promise, not just a callback
					css.load(name, require, gotLink, config);
				}
				else {
					// get the text of the file
					fetchText(url, gotText, cssx.reject);
				}

				return cssx;

			}, callback.reject ? callback.reject : undef);

		};

		return plugin;

		function has () {
			return true;// for now
		}

		function createStyleNode (css) {
			var head = document.head || document.getElementsByTagName('head')[0];
			if (has("dom-create-style-element")) {
				// we can use standard <style> element creation
				styleSheet = document.createElement("style");
				styleSheet.setAttribute("type", "text/css");
				styleSheet.appendChild(document.createTextNode(css));
				head.insertBefore(styleSheet, head.firstChild);
			}
			else {
				try {
					var styleSheet = document.createStyleSheet();
				} catch (e) {
					// if we went past the 31 stylesheet limit in IE, we will combine all existing stylesheets into one. 
					var styleSheets = dojox.html.getStyleSheets(); // we would only need the IE branch in this method if it was inlined for other uses
					var cssText = "";
					for (var i in styleSheets) {
						var styleSheet = styleSheets[i];
						if (styleSheet.href) {
							aggregate =+ "@import(" + styleSheet.href + ");";
						}
						 else {
							aggregate =+ styleSheet.cssText;
						}
						dojo.destroy(styleSheets.owningElement);
					}
					var aggregate = dojox.html.getDynamicStyleSheet("_aggregate");
					aggregate.cssText = cssText;
					return dojox.html.getDynamicStyleSheet(styleSheetName); 
				}
				styleSheet.cssText = css;
			}
		}


		/***** xhr *****/

		var progIds = ['Msxml2.XMLHTTP', 'Microsoft.XMLHTTP', 'Msxml2.XMLHTTP.4.0'];

		function xhr () {
			if (typeof XMLHttpRequest !== "undefined") {
				// rewrite the getXhr method to always return the native implementation
				xhr = function () { return new XMLHttpRequest(); };
			}
			else {
				// keep trying progIds until we find the correct one, then rewrite the getXhr method
				// to always return that one.
				var noXhr = xhr = function () {
						throw new Error("getXhr(): XMLHttpRequest not available");
					};
				while (progIds.length > 0 && xhr === noXhr) (function (id) {
					try {
						new ActiveXObject(id);
						xhr = function () { return new ActiveXObject(id); };
					}
					catch (ex) {}
				}(progIds.shift()));
			}
			return xhr();
		}

		function fetchText (url, callback, errback) {
			var x = xhr();
			x.open('GET', url, true);
			x.onreadystatechange = function (e) {
				if (x.readyState === 4) {
					if (x.status < 400) {
						callback(x.responseText);
					}
					else {
						errback(new Error('fetchText() failed. status: ' + x.statusText));
					}
				}
			};
			x.send(null);
		}

		function isXDomain (url, doc) {
			// using rules at https://developer.mozilla.org/En/Same_origin_policy_for_JavaScript
			// Note: file:/// urls are not handled by this function!
			// See also: http://en.wikipedia.org/wiki/Same_origin_policy
			if (!/:\/\/|^\/\//.test(url)) {
				// relative urls are always same domain, duh
				return false;
			}
			else {
				// same domain means same protocol, same host, same port
				// exception: document.domain can override host (see link above)
				var loc = doc.location,
					parts = url.match(/([^:]+:)\/\/([^:\/]+)(?::([^\/]+)\/)?/);
				return (
					loc.protocol !== parts[1] ||
					(doc.domain !== parts[2] && loc.host !== parts[2]) ||
					loc.port !== (parts[3] || '')
				);
			}
		}


	}
);
