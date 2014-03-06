var Guard = require('../src/Guard');
require('should');

describe('Guard', function() {
	describe('#against', function() {
		context('prevents execution', function() {
			it('throw exception', function() {
				var result = true;
				(typeof Guard).should.be.ok;
				(typeof Guard.against).should.equal('function');
				(function() {
					Guard.against(false);
					result = false;
				}).should.throw();
				result.should.be.true;
			});
		});
	});
});
