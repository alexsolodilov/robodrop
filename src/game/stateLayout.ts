import { createLayout } from 'utils-layout';

export const { stateLayout, stateLayoutDerived } = createLayout({
	backgroundRatio: {
		normal: 800 / 600,
		portrait: 600 / 800,
	},
	mainSizesMap: {
		desktop: { width: 800, height: 600 },
		tablet: { width: 800, height: 600 },
		landscape: { width: 800, height: 600 },
		portrait: { width: 600, height: 800 },
	},
});
