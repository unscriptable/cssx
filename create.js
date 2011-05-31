(function(define){
define([], function(){
	// module:
	//		cssx/create
	// summary:
	//		This module defines a fast lightweight function for creating new elements
	//		terse, CSS selector-based syntax. The single function from this module creates
	// 		new DOM elements with the signature:
	// 		create(referenceElement?, selector, properties|innerHTML);
	//		The first argument, referenceElement, is optional, and is the reference element
	//		for the selector. Tag syntax (no prefix) is used to indicate the tag to be created,
	//		.class-name can be used to assign the class name, #id can be used to assign an id.
	//		and [name=value] can be used to assign additional attributes to the element.
	// 		The attribute assignment will always use setAttribute to assign the attribute to the element.  
	//		For example, create("div.my-class") would create <div> element with a class of "my-class".
	//		(and appending to the referenceElement if provided). 
	//		CSS combinators can be used to create child elements and sibling elements.
	//		The create function returns the last top level element created or referenced (by a suffix combinator).
	//	examples:
	//		To create a simple div:
	//		|	create("div");
	//		To create a table as child of the referenceElement, one could write:
	//		create(referenceElement, "table.class-name#id tr.class-name td[colSpan=2]<tr.class-name td+td<<");
	//
	//		create(referenceElement, "table.class-name#id tr.class-name");
					
	var selectorParse = /(([-+])|[,<> ])?\s*(\.|#)?([-\w]+)?(?:\[([^\]=]+)=?['"]?([^\]'"]*)['"]?\])?/g,
		className = "className";		
	function create(referenceElement, selector, properties){
		if(typeof referenceElement == "string"){
			// first parameter is optional,
			properties = selector;
			selector = referenceElement;
			referenceElement = null;
		}
		var nextSibling = null, current, topReferenceElement = referenceElement;
		var leftoverCharacters = selector.replace(selectorParse, function(t, combinator, siblingCombinator, prefix, value, attrName, attrValue){
			if(combinator){
				if(siblingCombinator){
					// + or - combinator, 
					referenceElement = (nextSibling = (current || referenceElement)).parentNode;
					if(siblingCombinator == "+"){
						nextSibling = nextSibling.nextSibling;
					}// else a - operator, again not in CSS, but obvious in it's meaning (create next element before the current/referenceElement)
				}else{
					if(combinator == "<"){
						// parent combinator (not really in CSS, but theorized, and obvious in it's meaning)
						current = (current || referenceElement).parentNode;
					}else if(combinator == ","){
						// comma combinator, start a new selector
						current = topReferenceElement;
					}
					// else descendent or child selector (doesn't matter, but treated the same),
					referenceElement = current;
					current = null;
					nextSibling = null;
				}
			}
			var tag = !prefix && value;
			if(tag || (!current && (prefix || attrName))){
				// Need to create an element
				current = document.createElement(tag || create.defaultTag);
				if(referenceElement){
					referenceElement.insertBefore(current, nextSibling);
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
				current.setAttribute(attrName, attrValue || attrName);
			}
			return '';
		});
		if(leftoverCharacters){
			throw new SyntaxError("Unexpected char " + leftoverCharacters);
		}
		current = current || referenceElement;
		if(typeof properties == "string"){
			current.innerHTML = properties;
		}else{
			for(var i in properties){
				current[i] = properties[i];
			}
		}
		return current;
	}
	create.defaultTag = "div";
	return create;
});
})(typeof define == "undefined" ? function(deps, factory){create = factory();} : define);