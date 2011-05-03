/* Provides DOM element level interaction for CSS extensions */
define(["./cssx", "dojo/query"], function(cssx, querySelectorAll){
	var elementRenderers = {};
	/*require.ready(function(){
		lastRule.update();
	});*/
	return cssx.extend({
		addRenderer: function(selector, handler){
			var renderers = elementRenderers[selector] || (elementRenderers[selector] = []);
			renderers[handler.role || renderers.length] = handler;
		},
		update: function(selector, node){
			// update the rendering for this CSS, possibly constrained to a given selector/node
			if(typeof selector == "string" || selector == undefined){
				for(var i = 0; i < layout.length; i++){
					// iterate through the layout and render each matching one
					var rule = layout[i];
					if(rule.selector == selector || selector == undefined){
						var targets = querySelectorAll(rule.selector, node)
						for(var j = 0; j < targets.length; j++){
							var target = targets[j];
							if(!target.rendered){
								rule.apply(target);
							}
						}
					}
				}
			}
		},
		apply: function(node){
			// render this CSS/rule into the target node 
			node.rendered = true;
			for(var j in renderers){
				node = renderers[j](node) || node;
			}
		}
	});
}); 