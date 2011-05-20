/* Provides DOM element level interaction for CSS extensions */
define(["./cssx", "dojo/query"], function(cssx, query){
	var elementRenderers = {};
	/*require.ready(function(){
		lastRule.update();
	});*/
	return cssx.extend({
		addRenderer: function(rule, handler){
			var parent = rule.parent;
			var renderers = parent.renderers || (parent.renderers = {}); 
			var elementRenderers = renderers[rule.selector] || (renderers[rule.selector] = []);
			elementRenderers[handler.role || elementRenderers.length] = handler;
		},
		update: function(selector, node){
			// update the rendering for this CSS, possibly constrained to a given selector/node
			if(typeof selector == "string" || selector == undefined){
				for(var i = 0; i < layout.length; i++){
					// iterate through the layout and render each matching one
					var rule = layout[i];
					if(rule.selector == selector || selector == undefined){
						var targets = query(rule.selector, node)
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
		apply: function(rootElement){
			// render this CSS/rule into the target node
			var renderers = this.rootRule.renderers;
			for(var selector in renderers){
				var elementRenderers = renderers[selector];
				var rendererCount = elementRenderers.length; 
				query(selector, rootElement).forEach(function(element){
					for(var i = 0;i < rendererCount;i++){
						elementRenderers[i](element);
					}
				});
			} 
			/*node.rendered = true;
			for(var j in this.renderers){
				node = this.renderers[j](node) || node;
			}*/
		}
	});
}); 