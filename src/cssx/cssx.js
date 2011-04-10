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
 * Suffixes can be applied to resources when listed as a dependency.
 * e.g. define(['cssx/cssx!myModule!ignore=ieLayout'], callback);
 *
 * Available suffixes:
 * !ignore: a comma-separated list of cssx plugins to ignore
 *
 * 	TODO: loading of the imported sheet must be chained!
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
			head = document.head || document.getElementsByTagName('head')[0],
			// this actually tests for absolute urls and root-relative urls
			// they're both non-relative
			nonRelUrlRe = /^\/|^[^:]*:\/\//,
			// Note: this will fail if there are parentheses in the url
			findUrlRx = /(?:url\()[^\)]*(?:\))/g,
			stripUrlRx = /url\(\s*["']?|["']?\s*\)/g,
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
			var result, output = '';

			// fix any urls.
			var basePath = this.basePath;
			value = value.replace(findUrlRx, function (url) {
				return translateUrl(url, basePath);
			});

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
					self.output += result + '\n';
				}
			});
		};

		CssProcessor.prototype.onImport = function (url, media) {
			var newUrl;
			if (/\b(screen|all|handheld)\b/i.test(media)) {
				newUrl = translateUrl(url, this.basePath);
				// TODO: loading of the imported sheet must be chained!
				load(url, require, function () {}, {});
			}
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

		function has (feature) {
			return hasFeatures[feature];
		}

		function translateUrl (url, parentPath) {
			var path = url.replace(stripUrlRx, '');
			// if this is a relative url
			if (!nonRelUrlRe.test(path)) {
				// append path onto it
				path = parentPath + path;
			}
			return 'url("' + path + '")';
		}

		function createStyleNode () {
			if (has('dom-create-stylesheet')) {
				return document.createStyleSheet();
			}
			else {
				// we can use standard <style> element creation
				var node = document.createElement("style");
				node.setAttribute("type", "text/css");
				head.insertBefore(node, head.firstChild);
				return node;
			}
		}

		var currentSheet;
		function insertCss (css) {
			if (!currentSheet) {
				currentSheet = createStyleNode();
			}
			if (has('stylesheet-cssText')) {
				// IE mangles cssText if you try to read it out, so we have
				// to save a copy of the originals in cssxSheets;
				var sheets = currentSheet.cssxSheets = currentSheet.cssxSheets || [];
				sheets.push(css);
				currentSheet.cssText = sheets.join('\n');
				// this is a lame attempt to avoid 4000-rule limit of IE
				if (currentSheet.rules.length > 3000) {
					currentSheet = createStyleNode();
				}
			}
			else {
				currentSheet.appendChild(document.createTextNode(css));
			}
		}

		var hasFeatures = {
			'dom-create-stylesheet': !!document.createStyleSheet,
			'stylesheet-cssText': document.createStyleSheet &&
				(currentSheet = document.createStyleSheet()) &&
				('cssText' in currentSheet)
		};



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


		function load (name, require, callback, config) {

			function fail (ex) {
				if (callback.reject) callback.reject(ex); else throw ex;
			}

			function resolve (val) {
				callback.resolve ? callback.resolve() : callback();
			}

			shimCallback.then(
				function () {

					// create a promise
					var processor = new CssProcessor(activeShims);

					// add some useful stuff to it
					processor.input = '';
					processor.basePath = name.substr(0, name.lastIndexOf('/') + 1);

					// tell promise to write out style element when it's resolved
					processor.then(function (cssText) {
						if (cssText) insertCss(cssText);
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

		/***** the plugin *****/
		
		return {

			version: '0.2',

			load: load

		};

	}
);

