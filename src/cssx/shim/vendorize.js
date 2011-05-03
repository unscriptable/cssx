/*
    Creates vendor prefixes for CSS3 properties

*/
define([],function(){
	var ua = navigator.userAgent;
	var prefix = ua.indexOf("WebKit") > -1 ? "-webkit-" :
		ua.indexOf("Firefox") > -1 ? "-moz-" :
		ua.indexOf("Opera") > -1 ? "-o-" : "";
	return {
		"onborder-radius": function(prop, value){
			return prefix + prop + ": " + value;
		},
		"onbox-shadow": function(prop, value){
			return prefix + prop + ": " + value;
		}
	};
});

