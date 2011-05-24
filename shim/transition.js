/*
    Handles gradients
*/
define(["./vendorize"],function(vendor){
	var prefix = vendor.prefix;
	return {
		onProperty: function(name, value){
			if(prefix == "-ms-" && name == "transition-duration"){
				return "filter:progid:DXImageTransform.Microsoft.Fade(duration=" + value + ");";
				// TODO: Need to call filters[index].play() on the elements (probably should use HTC)
			}
			return prefix + name + ": " + value;
		}
	};
});

