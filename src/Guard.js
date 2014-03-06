module.exports = {
	against: function(assertion, message) {
		if (!assertion) {
			throw Error(message);
		}
	},
};
