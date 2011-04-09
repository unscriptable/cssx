/**
 * Copyright (c) 2011 unscriptable.com
 *
 * TODO: documentation
 * TODO: allow for nested rules (LESS, SASS, XStyle)
 * TODO: process selector replacements in onSelector so they can be cascaded to other selector processors
 * TODO: reuse toggleClass
 *
 */

(function (global, doc) {

	var
		comboCheckers = [],
		selectors,
		id = 0,
		comboDetectorRx = /\.\w+\./g,
		comboFinderRx = /(.*)((?:\.\w+){2,})/g,
		comboSplitterRx = /\b(\w|-)+\b/g,
		ruleTemplate = '.${0}{${1}:expression(cssx_combo_selector_check(this,"${2}",${3}));}\n';

	function createKey () {
        return 'cssx-combo-selector-' + id++;
    }

	var replaceRx = /\$\{(\d)\}/g;
	function replace (string, values) {
		return string.replace(replaceRx, function (match, pos) {
			return values[pos];
		});
	}

	function createComboChecker (combo) {
		var classes = {}, classList = [], checker, index = 0;

		combo.replace(comboSplitterRx, function (className) {
			if (!classes[className]) {
				classes[className] = Math.pow(2, index++);
				classList.push(className);
			}
			return className; // minimizes memory allocation work
		});

		// IE is such a cluster ____. Can't seem to get any single-pass
		// regex to work without capturing an starting space so we have
		// to post-process the matched strings. performance fail!

		checker = {
			classes: classes,
			full: Math.pow(2, index) - 1,
			rx: new RegExp('(^|\\s)(' + classList.join('|') + ')(?=$|\\s)', 'g'),
			check: function (classes) {
				var accum = 0, map = this.classes;
				classes.replace(this.rx, function (className) {
					// here's the post-processing needed:
					className = className.replace(/^\s/, '');
					accum |= (map[className] || 0);
					return className; // minimizes memory allocation work
				});
				return this.full == accum;
			}
		};
		return comboCheckers.push(checker) - 1;
	}

	function checkComboChecker (classes, checkerId) {
		var checker = comboCheckers[checkerId];
		return checker && checker.check(classes);
	}

	function parseCombos (selector) {
		var start = 0, part = '', parts = [], len = selector.length;
		selector.replace(comboFinderRx, function (match, other, combo) {
			parts.push({ other: other });
			parts.push({ combo: combo });
			return match; // minimizes memory allocation work
		});
		return parts;
	}

	define({

		onSelector: function (selector) {

			if (comboDetectorRx.test(selector)) {

				// create unique key for this ancestry
				var key = createKey();

				// save selector
				selectors = selectors || [];
				selectors.push({ selector: selector, key: key });

				return '.' + key;
			}

		},

		onEndRule: function () {
			var i, j, parts, part, checkerId, baseKey, baseRule = '', rules = '';

			if (selectors && selectors.length > 0) {

				for (i = 0; i < selectors.length; i++) {

					// TODO: bail if any blanks were found in classes
					parts = parseCombos(selectors[i].selector);
					baseKey = selectors[i].key;

					for (j = parts.length - 1; j > 0; j--) {

						part = parts[j];

						if (part.other) {
							baseRule += part.other;
						}
						else {
							part.key = createKey();
							checkerId = createComboChecker(part.combo);
							part.combo.replace(comboSplitterRx, function (className) {
								rules += replace(ruleTemplate, [className, part.key, baseKey, checkerId]);
								return className; // minimizes memory allocation work
							});
							baseRule += '.' + part.key + ',';
						}
					}
				}

				baseRule += '\n' + rules;
			}

			// clean up classes
			selectors = null;

			return baseRule;

		}

	});

	function toggleClass (node, className, add) {
		var replaced, newClassName, replaceRx = new RegExp('\\s?' + className + '\\s?');
		newClassName = node.className.replace(replaceRx, function (match) {
			replaced = add;
			return add ? match : '';
		});
		newClassName += add && !replaced ? ' ' + className : '';
		// IE6 isn't smart enough to check if className actually changed
		if (node.className != newClassName) {
			node.className = newClassName;
		}
	}

	global['cssx_combo_selector_check'] = function (node, origClass, checkerId) {
		var allSatisfied = checkComboChecker(node.className, checkerId);
		toggleClass(node, origClass, allSatisfied);
	};

}(this, document));
