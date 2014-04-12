(function() {
	var $httpBackend;
	angular.module('module/cqrs/example/network/http', ['ngMockE2E'])
	.config(['$provide', function($provide) {
		$provide.decorator('$httpBackend', ['$delegate', function() {
			return $httpBackend || ($httpBackend = arguments[0]);
		}]);
	}]);
})();
