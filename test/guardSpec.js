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
		});
		context('(true)', function() {
			it('allows execution', function() {
				var result = true;
				(function() {
					Guard.against(true, 'Message');
					result = false;
				}());
				result.should.be.false;
			});
		});
	});
});
