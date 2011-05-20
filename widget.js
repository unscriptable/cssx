define(["./elemental"], function(elemental){
	var evaluate = eval;
	function cssToJs(value){
		// recursively convert CSS to a reasonable JS equivalent
		if(typeof value == "string"){
			return evaluate(value);
		}
		var result, children = value.children;
		if(children){
			result = [];
			for(var i = 0; i < children.length; i++){
				result.push(cssToJs(children[i]));
			}
		}else{
			result = {};
		}
		value.eachProperty(function(full, name, value){
			result[name] = cssToJs(value);
		});
		return result;
	}
	return elemental.extend({
		onwidget: function(name, value, rule){
			var __module = eval(value);
			var prototype = __module.prototype;
			var props = {};
			if(prototype){
				rule.eachProperty(function(t, name, value){
					// change from css-style to javaScript style names
					name = name.replace(/-[a-z]/g, function(match){
						return match[1].toUpperCase();
					});
					// copy properties over
					if(name in prototype){
						var type = typeof prototype[name];
						if(type == "number"){
							value = +value;
						}else if(type != "string"){
							if(prototype['_' + name + 'Css']){
								value = prototype['_' + name + 'Css'](value);
							}else{
								value = cssToJs(value);
							}
						}
						props[name] = value;
					}
				});
			}
			function Props(){}
			Props.prototype = props;
			this.addRenderer(rule, function(domNode){
				// instantiate widget
				__module(new Props, domNode);
			});
		},
		role: "layout"
	});
})