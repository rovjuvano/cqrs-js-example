module.exports = {
	against: function(_, message) {
		throw Error(message);
	},
};
