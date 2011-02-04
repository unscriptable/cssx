/**
    cssx/plugin/_activation
    (c) copyright 2010, unscriptable.com
    author: john

    LICENSE: see the LICENSE.txt file. If file is missing, this file is subject to the AFL 3.0
    license at the following url: http://www.opensource.org/licenses/afl-3.0.php.

 */

define({

	auto: {
		load: true,
		activate: true
	},

	scrollbar: {
		load: 'auto',
		activate: true
	},

	inlineBlock: {
		load: function (env, sniff) { return sniff.cssValue('display', 'inline-block'); },
		activate: function (env, sniff) { return !env.isBuild; }
	},

	boxOffsets: {
		load: function (env, sniff) {
			// Note: this is an inference test since a true sniff would be a
			// lot of code. A true test would require setting top and bottom
			// of an absolutely positioned node and verifying the height.
			// TODO: either find a foolproof inference or do a true test
			return sniff.cssValue('position', 'fixed');
		},
		activate: true
	}

});
