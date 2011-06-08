/**
 * Copyright (c) 2011 unscriptable.com
 *
 * TODO: documentation
 * TODO: process selector replacements in onSelector so they can be cascaded to other selector processors
 * TODO: allow for nested rules (LESS, SASS, XStyle)
 *
 */

(function (global, doc) {

	var ancestries, id = 0;

	function createKey () {
        return 'cssx-child-selector-' + id++;
    }

	var replaceRx = /\$\{(\d)\}/g;
	function replace (string, values) {
		return string.replace(replaceRx, function (match, pos) {
			return values[pos];
		});
	}
	
	define(['./mediator'], function (mediator) {

		return {
			
			onSelector: function (selector) {

				if (selector.indexOf('>') >= 0) {

					// create unique key for this ancestry
					var key = createKey();

					// save ancestry
					ancestries = ancestries || [];
					ancestries.push({ selector: selector, key: key });

					return '.' + key;
				}

			},

			onEndRule: function (selectors) {
				var i, j, ancestry;

				if (ancestries && ancestries.length > 0) {

					for (i = 0; i < ancestries.length; i++) {

						ancestry = ancestries[i];

						mediator.addSelector(ancestry.selector, applyKeyClass, { key: ancestry.key });

					}
				}

				// clean up ancestries
				ancestries = null;
			}
		};

	});

	function applyKeyClass (info) {
		var nodeList, i;
		nodeList = info.querySelectorAll(info.selector, info.node);
		for (i = 0; i < nodeList.length; i++) {
			toggleClass(nodeList[i], info.privateData.key, info.added);
		}
	}


	function toggleClass (node, className, add) {
		var classes, classPos;
		classes = ' ' + node.className + ' ';
		classPos = classes.indexOf(className);
		if (add && classPos < 0) {
			node.className = classes.substr(1) + className;
		}
		else if (!add && classPos >= 0) {
			node.className = classes.substr(1, classPos - 2) +
				classes.substring(classPos + className.length, classes.length - 1);
		}
	}

}(this, document));
