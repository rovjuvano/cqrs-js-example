// NEXT: revisit exceptions in subscribe (e.g. query/item/{list,detail})
// NEXT: cleanup: domain/item
// NEXT: concurrency control
angular.module('Rx').run(['Rx', function(Rx) {
	Rx.Observable.prototype.x_cache = function() {
		var source = this;
		var cache;
		return Rx.Observable.create(function(observer) {
			if (!cache) {
				cache = new Rx.ReplaySubject();
				source.subscribe(cache);
			}
			return cache.subscribe(observer);
		});
	};
	return Rx;
}]);

var module = angular.module('module/cqrs/example/client', [
	'Rx',
	'module/cqrs/example/network/http',
	'module/cqrs/example/builder/item/basic',
])
.factory('app/query', ['$http', 'Rx', function($http, Rx) {
	return function(url) {
		return Rx.Observable.fromPromise($http({method: 'GET', url: url}))
		.pluck('data')
		.catch(function(response) {
			var error = new Error(response.data);
			error.statusCode = response.statusCode;
			console.warn('error:', error);
			throw error;
		})
		.x_cache();
	};
}])
.factory('app/query/item/list', ['app/query', 'Rx', function(query, Rx) {
	return function() {
		return query('/query/item/list').selectMany(function(list) {
			return Rx.Observable.fromArray(list);
		});
	};
}])
.factory('app/query/item/detail', ['app/query', function(query) {
	return function(itemId) {
		return query('/query/item/detail/' + itemId);
	};
}])
.factory('app/command/item', ['$http', 'Rx', 'app/event/item/observer', 'app/event/error/observer', function($http, Rx, itemObserver, errorObserver) {
	return function(command) {
		console.log('sending command', command);
		var source = Rx.Observable.fromPromise($http({
			method: 'POST',
			url: '/command/item',
			data: command,
		}))
		.selectMany(function(response) {
			console.log('done:', response);
			return Rx.Observable.fromArray(response.data);
		})
		.catch(function(response) {
			var error = new Error(response.data);
			error.statusCode = response.statusCode;
			console.warn('error:', error);
			throw error;
		})
		.x_cache();
		source.subscribe(itemObserver.onNext.bind(itemObserver), errorObserver.onNext.bind(errorObserver));
		return source;
	};
}])
.config(['$provide', 'Rx', function($provide, Rx) {
	[
		'app/event/item/selected',
		'app/event/item',
		'app/event/error',
	].forEach(function(baseName) {
		var subject = new Rx.Subject();
		$provide.factory(baseName + '/observable', function() { return subject });
		$provide.factory(baseName + '/observer', function() { return subject });
	});
}])
.controller('view/item/list', ['$scope', 'app/query/item/list', 'app/event/item/selected/observer', 'app/event/item/observable', 'builder/item/basic', function($scope, listItems, itemSelected, itemEvent, builder) {
	$scope.load = function() {
		$scope.itemList = [];
		listItems().subscribe(
			function(item) {
				$scope.itemList.push(item);
			},
			function(err) {
				console.error('Failed to load itemList: ' + err.message);
				$scope.itemList = [];
			},
			function() {
				console.debug('Loading itemList completed');
			}
		);
	};
	var getById = function(itemId) {
		for (var i=0, len=$scope.itemList.length; i<len; i++) {
			if ($scope.itemList[i].id === itemId) {
				return $scope.itemList[i];
			}
		}
	};
	var create = function() {
		var item = {};
		$scope.itemList.push(item);
		return item;
	};
	itemEvent.subscribe(function(event) {
		if ($scope.showLiveUpdates) {
			console.log('view/list:', event);
			builder[event.type].call(getById(event.rootId) || create(), event.data);
		}
	});
	$scope.showLiveUpdates = true;
	$scope.$watch('showLiveUpdates', function(newValue) {
		if (newValue) {
			$scope.load();
		}
	})
	$scope.select = function(item) {
		itemSelected.onNext(item);
	};
}])
.controller('view/item/detail', ['$scope', 'app/query/item/detail', 'app/event/item/selected/observable', 'app/event/item/observable', 'builder/item/basic', function($scope, detailItem, itemSelected, itemEvent, builder) {
	itemSelected.subscribe(function(itemId) {
		if (itemId) {
			load(itemId);
		}
		else {
			$scope.item = null;
		}
	});
	var load = function(itemId) {
		detailItem(itemId).subscribe(
			function(item) {
				$scope.item = item;
			},
			function(err) {
				console.error('Failed to load itemDetail: ' + err.message);
				$scope.item = null;
			},
			function () {
				console.debug('Loading itemDetail completed: ' + itemId);
			}
		);
	}
	itemEvent.subscribe(function(event) {
		if ($scope.showLiveUpdates && $scope.item && $scope.item.id === event.rootId) {
			console.log('view/detail:', event);
			builder[event.type].call($scope.item, event.data);
		}
	});
	$scope.showLiveUpdates = true;
	$scope.$watch('showLiveUpdates', function(newValue) {
		if (newValue && $scope.item) {
			load($scope.item.id);
		}
	})
}])
.controller('view/item/error', ['$scope', 'app/event/error/observable', '$timeout', function($scope, errObservable, $timeout) {
	$scope.errorList = [];
	var nextId = 0;
	var addError = function(error) {
		error.id = nextId++;
		$scope.errorList.push(error);
	};
	errObservable.subscribe(function(error) {
		addError(error);
	});
	$scope.removeError = function(error) {
		var index = $scope.errorList.indexOf(error);
		if (index >= 0) {
			$scope.errorList.splice(index, 1);
		}
	};
}])
.directive('unfocused', ['$timeout', function($timeout) {
	return {
		scope: {
			unfocused: '&',
			delay: '=',
		},
		link: function($scope, $element, $attrs) {
			var cb = $scope.unfocused || angular.noop;
			var timer;
			var start = function() {
				timer = $timeout(function() {
					timer = null;
				}, $scope.delay || 1000);
				timer.then(cb);
			};
			var cancel = function() {
				if (timer) {
					$timeout.cancel(timer);
					timer = null;
				}
			};
			$element.on('mouseleave', start);
			$element.on('mouseenter', cancel);
			$scope.$on('$destroy', cancel);
			start();
		},
	};
}])
.controller('view/item/create', ['$scope', 'app/command/item', function($scope, sendCommand) {
	var initialize = function() {
		$scope.args = {};
	};
	initialize();
	$scope.createItem = function(form) {
		var args = $scope.args;
		if (args.hasOwnProperty('active')) {
			args.active = !args.active;
		}
		sendCommand({type: 'create', data: $scope.args}).subscribe(initialize, function() {
			if (args.hasOwnProperty('active')) {
				args.active = !args.active;
			}
		});
	};
	$scope.createSampleData = function() {
		sendCommand({type: 'create', data: {id: 'Item0001', name: 'Item One'}});
		sendCommand({type: 'create', data: {id: 'Item0002', name: 'Item Two'}});
		sendCommand({type: 'create', data: {id: 'Item0003', name: 'Item Three'}});
	};
}])
.controller('view/item/activate', ['$scope', 'app/command/item', function($scope, sendCommand) {
	$scope.activateItem = function(form) {
		sendCommand({type: 'activate', rootId: $scope.item.id, data: {}});
	};	
}])
.controller('view/item/deactivate', ['$scope', 'app/command/item', function($scope, sendCommand) {
	$scope.deactivateItem = function(form) {
		sendCommand({type: 'deactivate', rootId: $scope.item.id, data: {}});
	};	
}])
.controller('view/item/check/in', ['$scope', 'app/command/item', function($scope, sendCommand) {
	$scope.checkInItem = function(form) {
		sendCommand({type: 'check/in', rootId: $scope.item.id, data: {count: $scope.count}});
	};	
}])
.controller('view/item/check/out', ['$scope', 'app/command/item', function($scope, sendCommand) {
	$scope.checkOutItem = function(form) {
		sendCommand({type: 'check/out', rootId: $scope.item.id, data: {count: $scope.count}});
	};	
}])
.controller('view/item/rename', ['$scope', 'app/command/item', function($scope, sendCommand) {
	$scope.$watch('item', function(item) {
		if (item) {
			$scope.name = item.name;
		}
	});
	$scope.renameItem = function(form) {
		sendCommand({type: 'rename', rootId: $scope.item.id, data: {name: $scope.name}});
	};	
}])
