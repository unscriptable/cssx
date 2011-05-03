define(["./elemental"], function(elemental){
	return elemental.extend({
		onwidget: function(name, value, rule){
			var modules = [];
			value.replace(/require\s*\(\s*['"]([^'"]*)['"]\s*\)/g, function(t, moduleId){
				modules.push(moduleId);
			});
			require(modules);
			this.addRenderer(rule.selector, function(domNode){
				require(modules, function(){
					var __module = eval(value);
					var prototype = __module.prototype;
					var props = {};
					if(prototype){
						rule.eachProperty(function(t, name, value){
							if(name in prototype){
								var type = typeof prototype[name];
								if(type == "string" || typeof value != "string"){
									props[name] = value;
								}else if(type == "number"){
									props[name] = +value;
								}else{
									props[name] = eval(value);
								}
							}
						});
					}
					__module(props, domNode);
				});
			});
		},
		role: "layout"
	});
})