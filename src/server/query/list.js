angular.module('module/cqrs/example/query/item/list', [
	'module/cqrs/example/network/http',
	'module/cqrs/example/network/event',
	'module/cqrs/example/builder/item/basic',
])
.constant('store/item/list', [])
.run(['store/item/list', 'domain/item/observable', 'builder/item/basic', function(itemList, domain, builder) {
	var getById = function(itemId) {
		for (var i=0; i<itemList.length; i++) {
			if (itemList[i].id === itemId) {
				return itemList[i];
			}
		}
	};
	var create = function() {
		var item = {};
		itemList.push(item);
		return item;
	};
	domain.subscribe(function(event) {
		console.log('query/list:', event);
		builder[event.type].call(getById(event.rootId) || create(), event.data);
	});
}])
.run(['store/item/list', '$httpBackend', function(itemList, $httpBackend) {
	$httpBackend.when('GET', '/query/item/list').respond(function(method, url, rawData, headers) {
		return [200, itemList, {}];
	});
}])
.controller('itemStore', ['$scope', 'store/item/list', 'domain/item/observable', function($scope, itemStore, observable) {
	$scope.itemStore = itemStore;
	observable.subscribe(function() {
		$scope.$apply();
	});
}])
