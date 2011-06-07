/**
 * Copyright (c) 2011 unscriptable.com
 *
 * dojo plugin for coordinating with cssx run-time shims
 *
 */
define(
['dojo/_base/html', 'dojo/_base/query', '../shim/mediator'],
function (html, query, mediator) {

	var orig, undef;

	// dojo 1.6 is pretty lame. it doesn't return anything for the dojo/_base/query module
	query = typeof query == 'function' ? query : dojo.query;

	function isString (obj) {
		return Object.prototype.toString.call(obj) == '[object String]';
	}

	function mutated (node, classes, defer) {
		var classList, className, callbacks;
		// ensure we have a node and an array
		node = html.byId(node);
		classList = isString(classes) ? classes.split(' ') : classes.slice();
		callbacks = [];
		while ((className = classList.pop())) {
			callbacks.push(mediator.mutated(node, className, defer));
		}
		return callbacks;
	}

	function commit (callbacks) {
		for (var i = 0; i < callbacks ? callbacks.length : 0; i++) {
			callbacks[i]();
		}
	}

	mediator.setQuerySelectorAll(query);

	// wrap dojo's methods for manipulating classes and parsing html
	orig = {
		addClass: html.addClass,
		removeClass: html.removeClass,
		replaceClass: html.replaceClass,
		toggleClass: html.toggleClass,
		attr: html.attr,
		_toDom: html._toDom
	};

	html.addClass = function (nodeOrId, classes) {
		var result;
		result = orig.addClass(nodeOrId, classes);
		mutated(nodeOrId, classes, false);
		return result;
	};

	html.removeClass = function (nodeOrId, classes) {
		var result, callbacks;
		callbacks = mutated(nodeOrId, classes, true);
		result = orig.removeClass(nodeOrId, classes);
		commit(callbacks);
		return result;
	};

	html.toggleClass = function (nodeOrId, className, condition) {
		var result, callbacks, hasClass;
		hasClass = html.hasClass(nodeOrId, className);
		if (hasClass) callbacks = mutated(nodeOrId, [className], true);
		result = orig.toggleClass(nodeOrId, className, condition);
		if (!hasClass) mutated(nodeOrId, [className], false);
		commit(callbacks);
		return result;
	};

	html.replaceClass = function(nodeOrId, newClasses, oldClasses) {
		var result, callbacks;
		callbacks = mutated(nodeOrId, oldClasses, true);
		result = orig.replaceClass(nodeOrId, newClasses, oldClasses);
		commit(callbacks);
		mutated(nodeOrId, newClasses, false);
		return result;
	};

	// TODO:
	html.attr = function (node, name, value) {
		var result;
		result = orig.attr(node, name, value);
		if (arguments.length == 2) {
			// special case if name == 'class' or 'className'
			if (name == 'class' || name == 'className') {
				html.replaceClass(node, value, node.className);
			}
			else {
				// TODO: handle non-className attributes
			}
		}
		return result;
	};

	html._toDom = function (frag, doc) {
		// html._toDom (instead of parser.parse and html.create/place
		// and dijit#buildRendering)
		var result;
		result = orig._toDom(frag, doc);
		mutated(result, undef, false);
		return result;
	};

});
