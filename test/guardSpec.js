var Guard = require('../src/Guard');
require('should');

describe('Guard', function() {
	describe('#against', function() {
		context('(false)', function() {
			it('prevents execution', function() {
				var result = true;
				(typeof Guard).should.be.ok;
				(typeof Guard.against).should.equal('function');
				(function() {
					Guard.against(false);
					result = false;
				}).should.throw();
				result.should.be.true;
			});
			it('throws Error with given message', function() {
				var message = 'Message';
				(function() {
					Guard.against(false, message);
				}).should.throw(message);
			});
		});
	});
});
