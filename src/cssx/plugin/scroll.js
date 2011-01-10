/*
    cssx/plugin/scroll
    (c) copyright 2010, unscriptable.com
    author: john

    LICENSE: see the LICENSE.txt file. If file is missing, this file is subject to the AFL 3.0
    license at the following url: http://www.opensource.org/licenses/afl-3.0.php.
*/
define(
	[
		'cssx/sniff',
		'cssx/_TextProc'
	],
	function (sniff, _DomProc) {

		function getSbSize () {
			var sbSize = sniff.getScrollbarSize();
			sbSize = { w: sbSize.w + 'px', h: sbSize.h + 'px' };
			getSbSize = function () { return sbSize; };
			return sbSize;
		}

		return {

			// TODO: how to tell cssx that this plugin cannot do string replacement in a build???
			activate: true,

			onProperty: function (propName, value, selectors, ss) {
				// propName: String
				// value: String
				// selectors: String|Array
				// ss: String
				if (/-cssx-scrollbar/.test(value)) {
					_TextProc.appendRule(selectors, value.replace(/-cssx-scrollbar-(width|height)/g, function (m) {
						return '-cssx-scrollbar-width' === m ? getSbSize().w : getSbSize().h;
					}));
				}
			}

		};

	}
);
