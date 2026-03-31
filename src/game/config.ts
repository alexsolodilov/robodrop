export const config = {
	providerName: 'sample_provider',
	gameName: 'robo_drop',
	gameID: 'robo_drop',
	rtp: 0.96,
	maxWin: 1000,

	betModes: {
		tank: {
			cost: 1.0,
			feature: false,
			rtp: 0.96,
			max_win: 1000,
			label: 'TANK',
			description: 'Low volatility — tough robot, smaller wins',
		},
		acro: {
			cost: 1.0,
			feature: false,
			rtp: 0.96,
			max_win: 1000,
			label: 'ACRO',
			description: 'High volatility — fragile robot, bigger potential wins',
		},
	},

	robots: {
		tank: {
			label: 'TANK',
			penalties: {
				one_leg: 1.5,
				arm: 2,
				body: 3,
			},
			limbDurability: 2, // hits before detaching
		},
		acro: {
			label: 'ACRO',
			penalties: {
				one_leg: 2,
				arm: 3,
				body: 4,
			},
			limbDurability: 1, // detaches immediately
		},
	},
} as const;
