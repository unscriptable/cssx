(function(define){
define([], function(){
	// module:
	//		cssx/create
	// summary:
	//		This module defines a fast lightweight function for creating new elements
	//		terse, selector-based syntax. The single return is a function that creates
	// 		new DOM elements with the signature
	// 		create(parent?, elementName or array of children...);
	//		The first argument, parent, is optional, and can be an element to append the newly
	//   	elements to.
	//		All subsequent arguments are used to create new elements. An argument can
	//		be a string, in which case it is interpreted with the same syntax as a CSS 
	// 		selector. Tag syntax (no prefix) is used to indicate the tag to be created,
	//		.class-name can be used to assign the class name, #id can be used to assign an id.
	//		and [name=value] can be used to assign additional attributes to the element.
	// 		The attribute assignment will always use setAttribute to assign the attribute to the element.  
	//		For example, "div.my-class" would create <div> element with a class of "my-class".
	//		CSS combinators can be used to create child elements and sibling elements. 
	//		There can be an unlimited number of arguments, each creating new elements
	//		(and appending to the parent if provided). 
	//		The create function returns the last top level element created or referenced (by a suffix combinator).
	//	examples:
	//		To create a 
	//		To create a table as child of the parent, one could write:
	//		create(parent, "table.class-name#id tr.class-name td[colSpan=2]<tr.class-name td+td<<");
	//
	//		create(parent, "table.class-name#id tr.class-name");
					
	var selectorParse = /(([-+])|[,<> ])?\s*(\.|#)?([-\w]+)?(?:\[([^\]=]+)=['"]?([^\]'"]+)['"]?\])?/g,
		className = "className";		
	function create(parent, selector, properties){
		if(typeof parent == "string"){
			// first parameter is optional,
			if(typeof selector == "object"){
				properties = selector;
			} 
			selector = parent;
			parent = null;
		}
		var nextSibling = null, current, topParent = parent;
		var leftoverCharacters = selector.replace(selectorParse, function(t, combinator, siblingCombinator, prefix, value, attrName, attrValue){
			if(combinator){
				if(siblingCombinator){
					// + or - combinator, 
					parent = (nextSibling = (current || parent)).parentNode;
					if(siblingCombinator == "+"){
						nextSibling = nextSibling.nextSibling;
					}
				}else{
					if(combinator == "<"){
						// parent combinator (not really in CSS, but theorized, and obvious in it's meaning)
						current = (current || parent).parentNode;
					}else if(combinator == ","){
						// comma combinator, start a new selector
						current = topParent;
					}
					// else descendent or child selector (doesn't matter, but treated the same),
					parent = current;
					current = null;
					nextSibling = null;
				}
			}
			var tag = !prefix && value;
			if(tag || (!current && (prefix || attrName))){
				// Need to create an element
				current = document.createElement(tag || create.defaultTag);
				if(parent){
					parent.insertBefore(current, nextSibling);
				}
			}
			if(prefix){
				if(prefix == "."){
					// .class-name was specified
					current[className] = current[className] ? current[className] + ' ' + value : value;
				}else{
					// #id was specified
					current.id = value;
				}
			}
			if(attrName){
				// [name=value]
				current.setAttribute(attrName, attrValue);
			}
			return '';
		});
		if(leftoverCharacters){
			throw new SyntaxError("Unexpected char " + leftoverCharacters);
		}
		for(var i in properties){
			current[i] = properties[i];
		}
		return current || parent;
	}
	create.defaultTag = "div";
	return create;
});
})(typeof define == "undefined" ? function(deps, factory){create = factory();} : define);