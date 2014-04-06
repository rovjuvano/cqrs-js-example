angular.module('module/cqrs/example/query/item/detail', [
	'module/cqrs/example/network/http',
	'module/cqrs/example/network/event',
	'module/cqrs/example/builder/item/basic',
	'module/cqrs/example/domain/item',
])
.constant('store/item/detail', {})
.constant('app', {})
.run(['$log', 'app', 'store/item/detail', 'store/item/event', 'builder/item/basic', 'app/store/observer', function($log, app, itemIndex, eventStore, builder, observer) {
	var create = function(index) {
		return itemIndex[index] = {_version: -1};
	};
	var safeGaurd = 3;
	var priorEventId;
	var subscribe = function(eventCount) {
		var eventCount = Object.keys(itemIndex).reduce(function(acc, key) { return acc + itemIndex[key]._version + 1 }, 0);
		var subscription = window.subscriptionDetail = eventStore.skip(eventCount).subscribe(function(event) {
			if (app.ignoreEvents) {
				return;
			}
			$log.log('query/detail:', event);
			var item = itemIndex[event.data.id] || create(event.data.id);
			if (priorEventId !== event._priorEventId) {
				if (--safeGaurd <= 0) throw new Error('Infinite Loop');
				$log.debug('re-subscribing detail');
				subscription.dispose();
				subscribe();
				return;
			}
			safeGaurd = 3;
			builder[event.type].call(item, event.data);
			priorEventId = event.eventId;
			observer.onNext();
		});
	};
	subscribe();
}])
.run(['store/item/detail', '$httpBackend', function(itemIndex, $httpBackend) {
	$httpBackend.when('GET', new RegExp('/query/item/detail/.*')).respond(function(method, url, rawData, headers) {
		var itemId = url.replace(new RegExp('.*/'), '');
		if (itemIndex[itemId]) {
			return [200, itemIndex[itemId], {}];
		}
		return [404, 'Item not found', {}];
	});
}])
.config(['$provide', 'Rx', function($provide, Rx) {
	var subject = new Rx.Subject();
	$provide.factory('app/store/observable', function() { return subject });
	$provide.factory('app/store/observer', function() { return subject });
}])
.controller('itemStore', ['$scope', 'app', 'store/item/detail', 'app/store/observable', function($scope, app, itemStore, observable) {
	$scope.itemStore = itemStore;
	$scope.app = app;
	observable.subscribe(function() {
		$scope.$apply();
	});
}])
