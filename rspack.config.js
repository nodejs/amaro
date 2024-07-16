module.exports = {
	target: "node",
	module: {
		rules: [
			{
				test: /\.ts$/,
				exclude: [/node_modules/],
				loader: "builtin:swc-loader",
				options: {
					jsc: {
						parser: {
							syntax: "typescript",
						},
					},
				},
				type: "javascript/auto",
			},
		],
	},
	output: {
		filename: "index.js",
		library: {
			type: "commonjs2",
		},
	},
};
