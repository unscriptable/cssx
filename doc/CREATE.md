This cssx/create module defines a fast lightweight function for creating new DOM elements
with terse, CSS selector-based syntax. The single function from this module creates
new DOM elements with the signature:

    create(referenceElement?, selector, properties|innerHTML?);

The first argument, referenceElement, is optional, and is the reference element
for the selector. Tag syntax (no prefix) is used to indicate the tag to be created. For example:

	create("div");
	
will create a new div element. And: 

	create(parent, "div"); 
	
Would create a new div element as a child of parent. 
The selector .class-name can be used to assign the class name. For example:

	create("div.my-class") would create <div> element with a class of "my-class".

The selector #id can be used to assign an id and [name=value] can be used to 
assign additional attributes to the element. For example:

	newInput = create(parent, "input.my-input#address[type=checkbox]");

Would create an input element with a class name of "my-input", and id of "address",
and the type attribute set to "checkbox". The attribute assignment will always use 
setAttribute to assign the attribute to the element. Multiple attributes and classes
can be assigned to a single element. If the tag name is omitted, a div
element will be created by default (the default tag can be changed with the 
create.defaultTag property). For example:

	create(".foo");

will create a div element with the class "foo". 

The create function returns the last top level element created or referenced (by a 
suffix combinator). In the examples above, the newly create element would be returned.

CSS combinators can be used to create child elements and sibling elements. For example,
we can use the child operator (or the descendant operator, it acts the same here) to 
create a nested elements:

	spanInsideOfDiv = create(reference, "div.outer span.inner");

This would create a new span element (with a class name of "inner") as a child of a
new div element (with a class name of "outer") as a child of the reference element. The
span element would be returned. We can also use the sibling operator to reference
the last created element or the reference element. In the example we indicate that
we want to create sibling of the reference element:

	newSpan = create(reference, "+span");

Would create a new span element directly after the reference element (reference and 
newSpan would be siblings.) We can also use - operator to indicate that the new element
should go before: 

	newSpan = create(reference, "-span");

This new span element will be inserted before the reference element in the DOM order.

The sibling operator can reference the last created element as well. For example
to add two td element to a table row:

	create(tableRow, "td+td");

The last created td will be returned.

The parent operator, "<" can be used to reference the parent of the last created 
element or reference element. In this example, we go crazy, and create a full table,
using the parent operator (applied twice) to traverse back up the DOM to create another table row
after creating a td element:

	newTable = create(referenceElement, "table.class-name#id tr td[colSpan=2]<<tr td+td<<");

We also use a parent operator twice at the end, so that we move back up two parents 
to return the table element (instead of the td element).

Finally, we can use the comma operator to create multiple elements, each basing their selector 
scope on the reference element. For example we could add two more rows to our table
without having to use the double parent operator:

	create(newTable, "tr td,tr td+td");

The third argument to create() may be an object with properties to be set on the new
element. For example, we could write:

	newDiv = create(parent, "div", {
		tabIndex: 1,
		innerHTML: "Hello, World"
	});

Which is identical to writing (all the properties are set using direct property access, not setAttribute):

	newDiv = create(parent, "div");
	newDiv.tabIndex = 1;
	newDiv.innerHTML = "Hello, World";

The third argument may also be a string, in which case it is used as the text inside of the
new element:

	newDiv = create(parent, "div", "Hello, World");

The text is escaped, so any string will show up as is, and will not be parsed as HTML.