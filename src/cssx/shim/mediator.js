/**
 * Copyright (c) 2011 unscriptable.com
 *
 * run-time mediator for shims
 *
 */
define(function () {

	var selectorHandlers, extractClassesRx, querySelectorAll, undef;

	selectorHandlers = {};
	extractClassesRx = /\.(\w|-)+/ig;

	function addSelector (selector, callback, privateData) {
		var classes, handlers;
		classes = {};
		selector.replace(extractClassesRx, function (className) {
			// only process a className once per selector
			if (!(className in classes)) {
				handlers = selectorHandlers[className] = selectorHandlers[className] || [];
				handlers.push({
					selector: selector,
					callback: callback,
					privateData: privateData
				});
			}
			classes[className] = true;
		});

	}

	function setQuerySelectorAll (qsa, force) {
		if (!qsa || force) querySelectorAll = qsa;
	}

	function mutated (node, className, defer) {
		var handlers, deferredList, handler, params;
		handlers = className ?
				   (selectorHandlers[className] ? selectorHandlers[className].slice() : []) :
				   getAllHandlers();
		deferredList = [];
		while ((handler = handlers.pop())) {
			params = {
				node: node,
				className: className,
				defer: defer,
				nodes: querySelectorAll(node, handler.selector),
				selector: handler.selector,
				callback: handler.callback,
				querySelectorAll: querySelectorAll,
				privateData: handler.privateData
			};
			if (defer) {
				deferredList = deferredList.push(params);
			}
			else {
				handler.callback(params);
			}
		}
		return function () {
			while ((params = deferredList.pop())) {
				params.callback(params);
			}
		};
	}

	function getAllHandlers () {
		var className, all;
		all = [];
		for (className in selectorHandlers) {
			all.push.apply(all, selectorHandlers[className]);
		}
		return all;
	}

	return {
		addSelector: addSelector,
		setQuerySelectorAll: setQuerySelectorAll,
		mutated: mutated
	};

});
