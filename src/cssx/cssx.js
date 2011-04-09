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
		'require',
		'./css',
		'./shims',
		'./CssTextParser'
	],
	function (require, css, shims, CssTextParser) {

		var
			undef,
			activeShims = {};

		function Promise () {
			this._thens = [];
		}

		Promise.prototype = {

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
					function (resolved, rejected) { resolved && resolved(arg); return this; } :
					function (resolved, rejected) { rejected && rejected(arg); return this; };
				// complete all async then()s
				var aThen;
				while (aThen = this._thens.shift()) { aThen[which] && aThen[which](arg); }
				delete this._thens;
				// disallow multiple calls to resolve or reject
				this.resolve = this.reject =
					function () { throw new Error('Promise already completed.'); };
			}

		};

		function CssProcessor (processors) {
			Promise.call(this);
			this.input = '';
			this.output = '';
			this.processors = processors;
		}
		CssProcessor.prototype = new Promise();

		CssProcessor.prototype.onRule = function (selectors) {
			// onRule processors should output anything that needs to be output
			// before processing the current rule. They should not output
			// anything for the current rule.
			var self = this, result, output, first = true;

			each(this.processors.onRule, function (processor) {
				result = processor(selectors);
				if (result) {
					self.output += result;
				}
			});

			// onSelector processors should process the current selector only.
			for (var i = 0, len = selectors.length; i < len; i++) {
				output = selectors[i];
				each(this.processors.onSelector, function (processor) {
					result = processor(output);
					if (typeof result == 'string') {
						output = result;
					}
				});
				if (output) {
					this.output += first ? output : ',' + output;
					first = false;
				}
			}

			// onRule processors shouldn't add a brace!
			this.output += '{\n';
		};

		CssProcessor.prototype.onProperty = function (name, value, selectors) {
			// process any callbacks for custom property names or catch-all value callbacks
			var func, result, output = '';

			// process the value through any onValue processors
			each(this.processors.onValue, function (processor) {
				result = processor(name, value, selectors);
				if (typeof result == 'string') {
					value = result;
				}
			});

			each(this.processors.onProperty, function (processor) {
				result = processor(name, value, selectors);
				if (typeof result == 'string') {
					output += result;
				}
			});

			each(this.processors[name], function (processor) {
				result = processor(name, value, selectors);
				if (typeof result == 'string') {
					output += result;
				}
			});

			// create default output if we didn't get any from the shims
			this.output += output || name + ':' + value + ';\n';
		};

		CssProcessor.prototype.onEndRule = function (selectors) {
			// onEndRule processors should output anything that needs to be output
			// after processing the current rule. They should not output
			// anything for the current rule.
			var self = this, result;
			// onEndRule processors should not output a closing brace!
			this.output += '}\n';
			each(this.processors.onEndRule, function (processor) {
				result = processor(selectors);
				if (result) {
					self.output += result;
				}
			});
		};

		function each (array, callback) {
			for (var i = 0, len = array && array.length; i < len; i++) {
				callback(array[i], i, array);
			}

		}

		function listHasItem (list, item) {
			return list ? (',' + list + ',').indexOf(',' + item + ',') >= 0 : false;
		}

		function applyCssx (processor) {
			// attach plugin callbacks
			try {
				new CssTextParser(processor, processor).parse(processor.input);
				// TODO: process any newly added rules, etc, here
				processor.resolve(processor.output);
			}
			catch (ex) {
				processor.reject(ex);
			}
		}

		// go get shims and add them to the CssProcessor's prototype
		var shimCallback = new Promise();
		shims(function (allShims) {

			// augment prototype, cascading property, and other handlers
			for (var i in allShims) {
				for (var p in allShims[i]) {
					if (!(p in {})) {
						if (!activeShims[p]) {
							activeShims[p] = [];
						}
						activeShims[p].push(allShims[i][p]);
					}
				}
			}

			shimCallback.resolve();

		});

		var hasFeatures = {
			'dom-create-stylesheet': !!document.createStyleSheet
		};

		function has (feature) {
			return hasFeatures[feature];
		}

		function createStyleNode (css) {
			var head = document.head || document.getElementsByTagName('head')[0];
			if (has('dom-create-stylesheet')) {
				try {
					var styleSheet = document.createStyleSheet();
				} catch (e) {
//					// if we went past the 31 stylesheet limit in IE, we will combine all existing stylesheets into one.
//					var styleSheets = dojox.html.getStyleSheets(); // we would only need the IE branch in this method if it was inlined for other uses
//					var cssText = "";
//					for (var i in styleSheets) {
//						var styleSheet = styleSheets[i];
//						if (styleSheet.href) {
//							aggregate =+ "@import(" + styleSheet.href + ");";
//						}
//						 else {
//							aggregate =+ styleSheet.cssText;
//						}
//						dojo.destroy(styleSheets.owningElement);
//					}
//					var aggregate = dojox.html.getDynamicStyleSheet("_aggregate");
//					aggregate.cssText = cssText;
//					return dojox.html.getDynamicStyleSheet(styleSheetName);
				}
				styleSheet.cssText = css;
			}
			else {
				// we can use standard <style> element creation
				var node = document.createElement("style");
				node.setAttribute("type", "text/css");
				node.appendChild(document.createTextNode(css));
				head.insertBefore(node, head.firstChild);
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
						throw new Error("XMLHttpRequest not available");
					};
				while (progIds.length > 0 && xhr == noXhr) (function (id) {
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
			if (x.overrideMimeType) {
				x.overrideMimeType('text/plain');
			}
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


		/***** the plugin *****/
		
		return {

			version: '0.2',

			load: function (name, require, callback, config) {

				function fail (ex) {
					if (callback.reject) callback.reject(ex); else throw ex;
				}

				function resolve (val) {
					callback.resolve ? callback.resolve() : callback();
				}

				shimCallback.then(function () {

					// create a promise
					var processor = new CssProcessor(activeShims);

					// add some useful stuff to it
					processor.input = '';
//					processor.appendRule = function (objOrArray) {
//						var rules = [].concat(objOrArray),
//							rule, i = 0;
//						while (rule = rules[i++]) {
//							this.output += rule;
//						}
//					};

					// tell promise to write out style element when it's resolved
					processor.then(function (cssText) {
//document.body.appendChild(document.createTextNode(cssText));
						if (cssText) createStyleNode(cssText);
//document.body.appendChild(document.createTextNode('***** ' + document.styleSheets[document.styleSheets.length - 1].cssText));
					})
					// tell promise to call back to the loader
					.then(
						resolve,
						fail
					);

					// check for special instructions (via suffixes) on the name
					var opts = css.parseSuffixes(name),
						dontExecCssx = config.cssxDirectiveLimit <= 0 && listHasItem(opts.ignore, 'all');

					function process () {
						if (dontExecCssx) {
							processor.resolve(processor.input);
						}
						else if (processor.input != undef /* truthy if null or undefined, but not "" */) {
							// TODO: get directives in file to see what rules to skip/exclude
							//var directives = checkCssxDirectives(processor.input);
							// TODO: get list of excludes from suffixes
							applyCssx(processor);
						}
					}

					function gotLink (link) {
						processor.link = link;
						processor.resolve();
					}

					function gotText (text) {
						processor.input = text;
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
						// TODO: pass a promise, not just a callback
						fetchText(url, gotText, fail);
					}

					// TODO: return something useful to the user like a stylesheet abstraction
					// not the processor
					return processor;

				},
				fail
				);

			}
		};

	}
);

