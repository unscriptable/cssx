define(
	[
		'./inlineBlock',
		'./boxOffsets',
		'./ieOpacity',
		'./minmax',
		'./hover',
		'./childSelector',
		'./comboSelector'
	],
	function (inlineBlock, boxOffsets, ieOpacity, minmax, hover, childSelector, comboSelector) {

		return {
			inlineBlock: inlineBlock,
			boxOffsets: boxOffsets,
			ieOpacity: ieOpacity,
			minmax: minmax,
			hoverPseudo: hoverPseudo,
			childSelector: childSelector,
			comboSelector: comboSelector
		};

	}
);
