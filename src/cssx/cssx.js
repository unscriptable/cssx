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
 * cssxPreload: Array
 * Set cssxPreload to a list of names of plugins that should be loaded
 * before processing any css files. Unless overridden by an !ignore
 * loader suffix or directive in a css file, all css files
 * will be scanned by these plugins.
 *
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
 * !inspect: a comma-separated list of cssx plugins to run
 * !scanlimit: the number of characters into the css file to search
 * 		for cssx directives
 *
 */

define(
	[
		'./css',
		'./common',
		'./CssTextParser',
		'./sniff',
		'./plugin/_activation'
	],
	function (css, common, CssTextParser, sniff, activations) {
		"use strict";

		// TODO: rewrite css.js using promises and inherit Promise from there
		function Promise () {
			this._callbacks = [];
		}

		Promise.prototype = {

			then: function (resolve, reject) {
				this._callbacks.push({ resolve: resolve, reject: reject });
			},

			resolve: function (val) { this._complete('resolve', val); },

			reject: function (ex) { this._complete('reject', ex); },

			_complete: function (which, arg) {
				this.then = which === 'resolve' ?
					function (resolve, reject) { resolve(arg); } :
					function (resolve, reject) { reject(arg); };
				var cbo, i = 0;
				while (cbo = this._callbacks[i++]) { cbo[which] && cbo[which](arg); }
			}
			
		};

		var preloading,
			undef;

		function checkCssxDirectives (text) {
			// check for any cssx markers in the file
			// limit this search to the first XXX lines or first XXX chars
			var top = text.substr(0, 500),
				optMatches = text.match(/\s?\/*\s?cssx:(.*?)(?:$|\*\/)/m),
				opts = {},
				opText, pair;
			while (opText = optMatches.unshift()) {
				var pairs = optMatches[i].split(/\s?,\s?/), opt;
				while (opt = pairs.unshift()) {
					pair = opt.split(/\s?\.\s?/);
					opts[pair[0]] = pair[1];
				}
			}
			return opts;
		}

		function listHasItem (list, item) {
			return list ? (',' + list + ',').indexOf(',' + item + ',') >= 0 : false;
		}

//		function chain (func, after) {
//			return function (processor, args) {
//				func(processor, args);
//				after(processor, args);
//			};
//		}

		function applyCssx (processor, cssText, plugins) {
			// attach plugin callbacks
			var callbacks = {
					onSheet: undef,
					onRule: undef,
					onEndRule: undef,
					onAtRule: undef,
					onImport: undef,
					onSelector: undef,
					onProperty: undef
				},
				count = 0;
			for (var p in callbacks) (function (cb, p) {
				for (var i = 0; i < plugins.length; i++) {
					if (plugins[i][p]) {
						cb = function (processor, args) {
							cb && cb(processor, args);
							plugins[i][p](processor, args);
						};
//						cb = chain(cb, plugins[i][p]);
						count++;
					}
				}
				if (cb !== undef) {
					callbacks[p] = function () { cb(processor, arguments); }
				}
			}(callbacks[p], p));
			if (count > 0) {
				// TODO: parse file, applying cssx fixes as found
				new CssTextParser(callbacks).parse(cssText);
			}
			processor.resolve(processor.cssText);
		}

		return common.beget(css, {

			load: function (name, require, callback, config) {

				// create a promise
				var promise = new Promise();

				// add some useful stuff to it
				processor.cssText = '';
				processor.addRule = function (objOrArray) {
					var rules = [].concat(objOrArray),
						rule, i = 0;
					while (rule = rules[i++]) {
						this.cssText += rule;
					}
				};

				// tell promise to write out style element when it's resolved
				promise.then(function (cssText) {
					// TODO: finish this
					if (cssText) createStyleNode(cssText, cssDef.link);
				});

				// tell promise to call back to the loader
				promise.then(
					callback.resolve ? callback.resolve : callback,
					callback.reject ? callback.reject : undef
				);

				// check for preloads
				if (preloading === undef) {
					preloading = true;
					var preloads = [];
					for (var p in activations) {
						if (activations.hasOwnProperty(p)) {
							// TODO: supply the environment parameter
							if (activations.load({ isBuild: false }, sniff)) {
								preloads.push('./plugin/' + p);
							}
						}
					}
					require(preloads, function () { preloading = false; process(); });
				}
				else {
					preloading = false;
				}

				// check for special instructions (via suffixes) on the name 
				var opts = css.parseSuffixes(name),
					dontExecCssx = config.cssxDirectiveLimit <= 0 && listHasItem(opts.ignore, 'all'),
					cssDef = {};

				function process () {
					if (!preloading) {
						if (cssDef.link) {
							if (dontExecCssx) {
								callback(cssDef);
							}
							else if (cssDef.cssText != undef /* truthy if null or undefined, but not "" */) {
								// get directives in file
								//var directives = checkCssxDirectives(cssDef.cssText);
								// TODO: if cssxAuto, use the auto plugin to scan -cssx- plugin references in file and load them
								// TODO: create a list of inspections from cssxPreload + cssxAuto discoveries - cssxIgnore + !inspect - !ignore

								var directives = [];
								require(directives, function () {
									applyCssx(promise, cssDef, cssText, Array.prototype.slice.call(arguments, 0));
								});
							}
						}
					}
				}

				function gotLink (link) {
					cssDef.link = link;
					process();
				}

				function gotText (text) {
					cssDef.cssText = text;
					process();
				}

				// get css file (link) via the css plugin
				css.load(name, require, gotLink, config);
				if (!dontExecCssx) {
					// get the text of the file, too
					require(['text!' + name], gotText);
				}

			}

		});

	}
);
