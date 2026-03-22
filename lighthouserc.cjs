module.exports = {
	ci: {
		collect: {
			staticDistDir: "./dist",
			url: ["http://localhost:4173"],
			numberOfRuns: 3,
		},
		upload: {
			target: "temporary-public-storage",
		},
	},
};
