angular.module('module/cqrs/example/query/item/detail', [
	'module/cqrs/example/network/http',
	'module/cqrs/example/network/event',
	'module/cqrs/example/builder/item/basic',
])
.constant('store/item/detail', {})
.run(['store/item/detail', 'domain/item/observable', 'builder/item/basic', function(itemIndex, domain, builder) {
	var create = function(index) {
		return itemIndex[index] = {};
	};
	domain.subscribe(function(event) {
		console.log('query/detail:', event);
		builder[event.type].call(itemIndex[event.rootId] || create(event.rootId), event.data);
	});
}])
.run(['store/item/detail', '$httpBackend', function(itemIndex, $httpBackend) {
	$httpBackend.when('GET', new RegExp('/query/item/detail/.*')).respond(function(method, url, rawData, headers) {
		var itemId = url.replace(new RegExp('.*/'), '');
		console.log('Getting item detail:', itemId);
		if (itemIndex[itemId]) {
			return [200, itemIndex[itemId], {}];
		}
		return [404, 'Item not found', {}];
	});
}])
.controller('itemStore', ['$scope', 'store/item/detail', 'domain/item/observable', function($scope, itemStore, observable) {
	$scope.itemStore = itemStore;
	observable.subscribe(function() {
		$scope.$apply();
	});
}])
