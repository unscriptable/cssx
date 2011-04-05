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
		'./css'
	],
	function (css) {
		"use strict";

		// TODO: rewrite css.js using promises and inherit Promise from there
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
				// FIXME: should this say typeof this.onSheet ?
				if (this.onSheet == "function") {
					css = arg.onsheet(css);
				}
				function Rule () {}
				Rule.prototype = {
					eachProperty: function(onproperty){
						return (this.children ? onproperty(0, "layout", this.children) || this.selector : this.selector) + 
							"{" + this.cssText.replace(/\s*([^;:]+)\s*:\s*([^;]+)?/g, onproperty) + "}"; // process all the css properties
					},
					cssText: ""
				};
				
				var lastRule = new Rule;
				lastRule.css = css;
				var styleSheet = this;
				function onproperty (t, name, value) {
					// this is called for each CSS property
					var propertyHandler = styleSheet["on" + name] || styleSheet.onproperty;
					if(typeof propertyHandler == "function"){
						// we have a CSS property handler for this property
						var result = propertyHandler(value, lastRule, name);
						if(typeof result == "string"){
							// otherwise it replacement CSS
							return result;
						}
					}
					return t;
				}
				// parse the CSS, finding each rule
				css = css.replace(/\s*(?:([^{;\s]+)\s*{)?\s*([^{}]+;)?\s*(};?)?/g, function (full, selector, properties, close) {
					// called for each rule
					if (selector) {
						// a selector as found, start a new rule (note this can be nested inside another selector)
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
					createStyleNode(css);
				}
				return this;
			}

		};
		for (var i in css) {
			StyleSheet.prototype[i] = css[i];
		}
		var
//			preloading,
			undef,
			shims;

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

		var cssx = new StyleSheet();
		cssx.load = function (name, require, callback, config) {

			// create a promise
			// add some useful stuff to it
			this.cssText = '';
			var cssx = this;
			// tell promise to write out style element when it's resolved
			this.then(function (cssText) {
				// TODO: finish this
				if (cssText) createStyleNode(cssText, this.link);
			});

			// tell promise to call back to the loader
			this.then(
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
					if (cssx.link) {
						if (dontExecCssx) {
							callback(cssx);
						}
						else if (cssx.cssText != undef /* truthy if null or undefined, but not "" */) {
							// TODO: get directives in file to see what rules to skip/exclude
							//var directives = checkCssxDirectives(cssx.cssText);
							// TODO: get list of excludes from suffixes

								cssx.applyExtensions();
//								var directives = [];
//								require(directives, function () {
							callback(cssx);
						}
					}
//					}
			}

			function gotLink (link) {
				cssx.link = link;
				process();
			}

			function gotText (text) {
				cssx.cssText = text;
				process();
			}

			// get css file (link) via the css plugin
			css.load(name, require, gotLink, config);
			if (!dontExecCssx) {
				// get the text of the file, too
				// Is it really safe to rely on the text! plugin? That is not guaranteed to be there in all AMD environments, is it?
				require(['text!' + name], gotText);
			}
			return cssx;
		};

		return cssx;

		function has () {
			return true;// for now
		}

		function createStyleNode (css) {
			var head = cssx.findHead();
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
	}
);
