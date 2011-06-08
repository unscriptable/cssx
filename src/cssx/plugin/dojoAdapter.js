/**
 * Copyright (c) 2011 unscriptable.com
 *
 * dojo adapter plugin for coordinating with cssx run-time shims
 *
 */
define(
['dojo', 'dojo/parser', 'cssx/shim/mediator'],
function (dojo, dojoParser, mediator) {

	var orig, undef;

	function isString (obj) {
		return Object.prototype.toString.call(obj) == '[object String]';
	}

	function isArray (obj) {
		return Object.prototype.toString.call(obj) == '[object Array]';
	}

	function mutated (node, classes, defer) {
		var classList, className, callbacks, runOnce = {};
		// ensure we have a node and an array
		node = dojo.byId(node);
		classList = isString(classes) ? classes.split(' ') : isArray(classes) ? classes.slice() : [runOnce];
		callbacks = [];
		while ((className = classList.pop())) {
			callbacks.push(mediator.mutated(node, className == runOnce ? undef : className, defer));
		}
		return callbacks;
	}

	function commit (callbacks) {
		for (var i = 0; i < callbacks ? callbacks.length : 0; i++) {
			callbacks[i]();
		}
	}

	mediator.setQuerySelectorAll(dojo.query);

	// wrap dojo's methods for manipulating classes and parsing html
	orig = {
		addClass: dojo.addClass,
		removeClass: dojo.removeClass,
		replaceClass: dojo.replaceClass,
		toggleClass: dojo.toggleClass,
		attr: dojo.attr,
		_toDom: dojo._toDom,
		parse: dojoParser.parse
	};

	dojo.addClass = function (nodeOrId, classes) {
		var result;
		result = orig.addClass(nodeOrId, classes);
		mutated(nodeOrId, classes, false);
		return result;
	};

	dojo.removeClass = function (nodeOrId, classes) {
		var result, callbacks;
		callbacks = mutated(nodeOrId, classes, true);
		result = orig.removeClass(nodeOrId, classes);
		commit(callbacks);
		return result;
	};

	dojo.toggleClass = function (nodeOrId, className, condition) {
		var result, callbacks, hasClass;
		hasClass = dojo.hasClass(nodeOrId, className);
		if (hasClass) callbacks = mutated(nodeOrId, [className], true);
		result = orig.toggleClass(nodeOrId, className, condition);
		if (!hasClass) mutated(nodeOrId, [className], false);
		commit(callbacks);
		return result;
	};

	dojo.replaceClass = function(nodeOrId, newClasses, oldClasses) {
		var result, callbacks;
		callbacks = mutated(nodeOrId, oldClasses, true);
		result = orig.replaceClass(nodeOrId, newClasses, oldClasses);
		commit(callbacks);
		mutated(nodeOrId, newClasses, false);
		return result;
	};

	// TODO:
	dojo.attr = function (node, name, value) {
		var result;
		result = orig.attr(node, name, value);
		if (arguments.length == 2) {
			// special case if name == 'class' or 'className'
			if (name == 'class' || name == 'className') {
				dojo.replaceClass(node, value, node.className);
			}
			else {
				// TODO: handle non-className attributes
			}
		}
		return result;
	};

	dojo._toDom = function (frag, doc) {
		// html._toDom (instead of parser.parse and html.create/place
		// and dijit#buildRendering)
		var result;
		result = orig._toDom(frag, doc);
		mutated(result, undef, false);
		return result;
	};

	dojoParser.parse = function (rootNode, args) {
		var result;
		rootNode = rootNode || dojo.body();
		result = orig.parse.call(dojoParser, rootNode, args);
		mutated(rootNode, undef, false);
		return result;
	}

});
