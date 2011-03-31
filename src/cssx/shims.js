define(
	[
		'require',
		'./sniff',
		'./shim/_bundles',
		'./shim/_tests'
	],
	function (require, css, common, CssTextParser, sniff, bundles, tests) {
		"use strict";
		function getShims (require, callback) {
			// get the list of bundles
//			require(['./shim/_bundles'], function (bundles) {
				var bundleName;
				// find the one that first matches our user agent
				for (var n in bundles) {
					if (n !== 'default') {
						var ctx = {}, env = { isBuild: false }; // TODO: build-time
						if (bundles[n].test === true || bundles[n].test(env, sniff, ctx)) {
							bundleName = bundles[n].name;
							break;
						}
					}
				}
				// fetch it and return the bundle of shims
				require([bundleName || bundles['default'].name], function (bundle) {
					callback(bundle);
				});
//			});
		}

		function runFeatureTests (require, shims, callback) {
			// get all of the feature tests
//			require(['./shim/_tests'], function (tests) {
				// collect any that fail
				var failed = [];
				for (var n in tests) {
					var ctx = {}, env = { isBuild: false }; // TODO: build-time
					// only test for the shims that we don't already have
					if (!(n in shims) && !tests[n].test(env, sniff, ctx)) {
						failed.push(tests[n].name);
					}
				}
				// get the shims for those
				require(failed, function () {
					for (var i = 0; i < failed.length; i++) {
						shims[failed[i]] = arguments[i];
					}
					callback(shims);
				});
//			});
		}

		function getAllShims (require, callback) {
			getShims(require, function (bundle) {
				runFeatureTests(require, bundle, callback);
			});
		}

		getAllShims(require, function (allShims) {
			shims = allShims;
		});
		
});