(function() {
	var $httpBackend;
	angular.module('module/cqrs/example/network/http', ['ngMockE2E'])
	.config(['$provide', function($provide) {
		$provide.decorator('$httpBackend', ['$delegate', function() {
			return $httpBackend || ($httpBackend = arguments[0]);
		}]);
	}]);
	var domainItemObserver;
	var domainItemObservable;
	angular.module('module/cqrs/example/network/event', ['Rx'])
	.config(['Rx', function(Rx) {
		if (!domainItemObserver) {
			var subject = new Rx.Subject();
			domainItemObserver = subject;//.asObserver(); // asObserver is undefinded as of RxJs v2.2.17
			domainItemObservable = subject.asObservable().observeOn(Rx.Scheduler.timeout);
		}
	}])
	.factory('domain/item/observable', [function() {
		return domainItemObservable;
	}])
	.factory('domain/item/observer', [function() {
		return domainItemObserver;
	}])
})();
