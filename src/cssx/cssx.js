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
 * cssxAutoPlugin: Boolean, default = true
 * Set cssxAutoPlugin to false to prevent cssx from attempting to
 * automatically download and apply plugins that are referenced
 * in css rules.  For instance, if a -cssx-scroll-width property is
 * found in a rule, cssx will normally load the "scroll" plugin
 * and place the correct value in the stylesheet. If cssxAutoPlugin is
 * false, cssx will ignore -cssx-scroll-width unless the plugin was
 * preloaded or specified in a directive.
 *
 * cssxDirectiveLimit: Number, default = 200
 * Set cssxDirectiveLimit to the number of characters into a css file
 * to look for cssx directives before giving up.  Set this to zero
 * if you don't want cssx to scan for directives at all.  Set it to
 * a very high number if you're concatenating css files together!
 * Override this via the !limit loader suffix.
 *
 */

define(['./css'], function (css) {
	"use strict";

	var undef,
		beget = (function () {
			function F () {}
			return function (proto, props) {
				F.prototype = proto;
				var o = new F();
				for (var p in props) {
					o[p] = props[p];
				}
			}
		})();

	function checkCssxDirectives (text) {
		// check for any cssx markers in the file
		// limit this search to the first XXX lines or first XXX chars
		var top = text.substr(0, 500),
			optMatches = text.match(/\s?\/*\s?cssx:(.*?)(?:$|\*\/)/m),
			opts = {},
			opText;
		while (optText = optMatches.unshift()) {
			var pairs = optMatches[i].split(/\s?,\s?/), opt;
			while (opt = pairs.unshift()) {
				var pair = opt.split(/\s?\.\s?/);
				opts[pair[0]] = pair[1];
			}
		}
		return opts;
	}

	function listHasItem (list, item) {
		return list ? (',' + list + ',').indexOf(',' + item + ',') >= 0 : false;
	}

	return beget(css, {

		load: function (resourceDef, require, callback, config) {

			var opts = css.parseSuffixes(resourceDef),
				dontFix = config.cssxDirectiveLimit <= 0 && listHasItem(opts.ignore, 'all'),
				cssDef = {};

			function process () {
				if (cssDef.link) {
					if (!needsFixing) {
						callback(cssDef);
					}
					else if (cssDef.cssText != undef /* truthy if null or undefined, but not "" */) {
						
						var directives = checkCssxDirectives(cssDef.cssText);

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

			// get css file (link) via the css plugin directly
			css.load(resourceDef, require, gotLink, config);

			if (needsFixing) {

				// get the text of the file, too
				require(['text!' + resourceDef], gotText);

			}

		}

	});

});
