angular.module('module/cqrs/example/query/item/list', [
	'module/cqrs/example/network/http',
	'module/cqrs/example/network/event',
	'module/cqrs/example/builder/item/basic',
	'module/cqrs/example/domain/item',
])
.constant('store/item/list', [])
.constant('app', {})
.run(['$log', 'app', 'store/item/list', 'store/item/event', 'builder/item/basic', 'app/store/observer', function($log, app, itemList, eventStore, builder, observer) {
	var getById = function(itemId) {
		for (var i=0; i<itemList.length; i++) {
			if (itemList[i].id === itemId) {
				return itemList[i];
			}
		}
	};
	var create = function() {
		var item = {_version: -1};
		itemList.push(item);
		return item;
	};
	var safeGaurd = 3;
	var priorEventId;
	var subscribe = function(eventCount) {
		var eventCount = itemList.reduce(function(acc, item) { return acc + item._version + 1 }, 0);
		var subscription = window.subscriptionList = eventStore.skip(eventCount).subscribe(function(event) {
			if (app.ignoreEvents) {
				return;
			}
			$log.log('query/list:', event);
			var item = getById(event.data.id) || create();
			if (priorEventId !== event._priorEventId) {
				if (--safeGaurd <= 0) throw new Error('Infinite Loop');
				$log.debug('re-subscribing list');
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
.run(['store/item/list', '$httpBackend', function(itemList, $httpBackend) {
	$httpBackend.when('GET', '/query/item/list').respond(function(method, url, rawData, headers) {
		return [200, itemList, {}];
	});
}])
.config(['$provide', 'Rx', function($provide, Rx) {
	var subject = new Rx.Subject();
	$provide.factory('app/store/observable', function() { return subject });
	$provide.factory('app/store/observer', function() { return subject });
}])
.controller('itemStore', ['$scope', 'app', 'store/item/list', 'app/store/observable', function($scope, app, itemStore, observable) {
	$scope.itemStore = itemStore;
	$scope.app = app;
	observable.subscribe(function() {
		$scope.$apply();
	});
}])
