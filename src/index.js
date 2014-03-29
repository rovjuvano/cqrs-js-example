// NEXT: move domain, queries, and command to server
// NEXT: concurrency control
var module = angular.module('module/cqrs/example', []);
module.addItemEvent = function(type) {
	var subject = new Rx.ReplaySubject();
	this.config(['domain/itemProvider', 'hub/item/eventProvider', function(domain, hub) {
		domain.addObserver(type, subject);
		hub.addObservable(type, subject);
	}]);
	this.factory('event/item/' + type, function() { return subject });
	return this;
};
module.subject = function(baseName, subject) {
	this.factory(baseName + '/observable', function() { return subject });
	this.factory(baseName + '/observer', function() { return subject });
	return this;
}
module
.constant('Rx', Rx)
.constant('Guard', {
	against: function(condition, message) {
		if (condition) throw new Error(message);
	}
})
.provider('hub/item/event', function() {
	var observables = {};
	this.addObservable = function(type, observable) {
		observables[type] = observable;
	};
	this.$get = [function() {
		return observables;
	}];
})
.provider('domain/item', function() {
	var observers = {};
	this.addObserver = function(type, observer) {
		observers[type] = observer;
	};
	this.$get = ['builder/item/basic', function(builder) {
		var store = {};
		var create = function(id) {
			store[id] = [];
			return store[id];
		};
		var save = function(event) {
			(store[event.id] || create(event.id)).push(event);
		};
		return {
			exists: function(id) {
				return !!store[id];
			},
			load: function(id) {
				var item;
				console.log('domain {');
				if (store[id]) {
					item = {};
					store[id].forEach(function(event) {
						console.log('  ', event);
						builder[event.type](item, event);
					});
				}
				console.log('}');
				return item;
			},
			addEvent: function(type, event) {
				event.type = type;
				save(event);
				observers[type].onNext(event);
			},
		}	;
	}];
})
.addItemEvent('created')
.addItemEvent('activated')
.addItemEvent('deactivated')
.addItemEvent('checkedIn')
.addItemEvent('checkedOut')
.addItemEvent('renamed')
.factory('builder/item/basic', [function() {
	return {
		created: function(item, event) {
			item.id = event.id;
			item.name = event.name;
			item.count = 0;
			item.active = true;
		},
		activated: function(item, event) {
			item.active = true;
		},
		deactivated: function(item, event) {
			item.active = false;
		},
		checkedIn: function(item, event) {
			item.count += event.count;
		},
		checkedOut: function(item, event) {
			item.count -= event.count;
		},
		renamed: function(item, event) {
			item.name = event.name;
		},
	};
}])
.factory('query/item/list', ['Rx', 'hub/item/event', 'builder/item/basic', function(Rx, itemEventHub, builder) {
	var itemList = [];
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
	Object.keys(itemEventHub).forEach(function(type) {
		itemEventHub[type].subscribe(function(event) {
			if (!(event instanceof Error)) {
				console.log('query/list:', event);
				builder[type](getById(event.id) || create(), event);
			}
		});
	});
	return function() {
		return Rx.Observable.fromArray(itemList).select(function(item) {
			return angular.copy(item);
		});
	}
}])
.factory('query/item/detail', ['Rx', 'hub/item/event', 'builder/item/basic', function(Rx, itemEventHub, builder) {
	var itemIndex = {};
	var create = function(index) {
		return itemIndex[index] = {};
	};
	Object.keys(itemEventHub).forEach(function(type) {
		itemEventHub[type].subscribe(function(event) {
			if (!(event instanceof Error)) {
				console.log('query/detail:', event);
				builder[type](itemIndex[event.id] || create(event.id), event);
			}
		});
	});
	return function(itemId) {
		return itemIndex[itemId]
			? Rx.Observable.return(angular.copy(itemIndex[itemId]))
			: Rx.Observable.throw(new Error('Item not found: ' + itemId))
	};
}])
.factory('command/item/create', ['domain/item', 'Guard', function(domain, Guard) {
	return function(id, name, errObserver) {
		try {
			id = String(id);
			name = String(name);
			Guard.against(domain.exists(id), 'Item already exists with ID: ' + id);
			Guard.against(id.length === 0, 'ID cannot be empty.');
			Guard.against(name.length === 0, 'Name cannot be empty.');
			domain.addEvent('created', {id: id, name: name});
		} catch (e) {
			errObserver.onNext(e);
		}
	};
}])
.factory('command/item/activate', ['domain/item', 'Guard', function(domain, Guard) {
	return function(id, errObserver) {
		try {
			Guard.against(!domain.exists(id), 'Item not found: ' + id);
			domain.addEvent('activated', {id: id});
		} catch(e) {
			errObserver.onNext(e);
		}
	};
}])
.factory('command/item/deactivate', ['domain/item', 'Guard', function(domain, Guard) {
	return function(id, errObserver) {
		try {
			Guard.against(!domain.exists(id), 'Item not found: ' + id);
			domain.addEvent('deactivated', {id: id});
		} catch(e) {
			errObserver.onNext(e);
		}
	};
}])
.factory('command/item/check/in', ['domain/item', 'Guard', function(domain, Guard) {
	return function(id, count, errObserver) {
		try {
			count = Number(count);
			Guard.against(!domain.exists(id), 'Item not found: ' + id);
			Guard.against(isNaN(count), 'Checkin count must be a number.');
			Guard.against(Math.floor(count) !== count, 'Checkin count must be a whole number.');
			Guard.against(count < 0, 'Checkin count must be greater than zero.');
			domain.addEvent('checkedIn', {id: id, count: count});
		} catch(e) {
			errObserver.onNext(e);
		}
	};
}])
.factory('command/item/check/out', ['domain/item', 'Guard', function(domain, Guard) {
	return function(id, count, errObserver) {
		try {
			count = Number(count);
			Guard.against(!domain.exists(id), 'Item not found: ' + id);
			Guard.against(isNaN(count), 'Checkout count must be a number.');
			Guard.against(Math.floor(count) !== count, 'Checkout count must be a whole number.');
			Guard.against(count < 0, 'Checkout count must be greater than zero.');
			var item = domain.load(id);
			Guard.against(item.count < count, 'Checkout count (' + count + ') must be less than or equal to inventory count (' + item.count + ')');
			domain.addEvent('checkedOut', {id: id, count: count});
		} catch(e) {
			errObserver.onNext(e);
		}
	};
}])
.factory('command/item/rename', ['domain/item', 'Guard', function(domain, Guard) {
	return function(id, name, errObserver) {
		try {
			name = String(name);
			Guard.against(!domain.exists(id), 'Item not found: ' + id);
			Guard.against(name.length === 0, 'Name cannot be empty.');
			domain.addEvent('renamed', {id: id, name: name});
		} catch (e) {
			errObserver.onNext(e);
		}
	};
}])
.subject('event/item/selected', new Rx.ReplaySubject())
.subject('app/error', new Rx.ReplaySubject())
.controller('view/item/list', ['$scope', 'query/item/list', 'event/item/selected/observer', 'hub/item/event', 'builder/item/basic', function($scope, listItems, itemSelected, itemEventHub, builder) {
	$scope.load = function() {
		$scope.itemList = [];
		listItems().subscribe(
			function(item) {
				$scope.itemList.push(item);
			},
			function(err) {
				console.error('Failed to load itemList: ' + err.message);
				$scope.itemList = [];
				throw err;
			},
			function() {
				console.info('Loading itemList completed');
			}
		);
	};
	var getById = function(id) {
		for (var i=0; i<$scope.itemList.length; i++) {
			if ($scope.itemList[i].id === id) {
				return $scope.itemList[i];
			}
		}
	};
	var create = function() {
		var item = {};
		$scope.itemList.push(item);
		return item;
	};
	Object.keys(itemEventHub).forEach(function(type) {
		itemEventHub[type].subscribe(function(event) {
			if (!(event instanceof Error) && $scope.showLiveUpdates) {
				console.log('view/list:', event);
				builder[type](getById(event.id) || create(), event);
			}
		});
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
.controller('view/item/detail', ['$scope', 'query/item/detail', 'event/item/selected/observable', 'hub/item/event', 'builder/item/basic', function($scope, detailItem, itemSelected, itemEventHub, builder) {
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
				item.newName = item.name;
				$scope.item = item;
			},
			function(err) {
				console.error('Failed to load itemDetail: ' + err.message);
				$scope.item = null;
				throw err;
			},
			function () {
				console.debug('Loading itemDetail completed: ' + itemId);
			}
		);
	}
	Object.keys(itemEventHub).forEach(function(type) {
		itemEventHub[type].subscribe(function(event) {
			if ($scope.showLiveUpdates && $scope.item && $scope.item.id === event.id) {
				if (!(event instanceof Error)) {
					console.log('view/detail:', event);
					builder[type]($scope.item, event);
				}
			}
		});
	});
	$scope.showLiveUpdates = true;
	$scope.$watch('showLiveUpdates', function(newValue) {
		if (newValue && $scope.item) {
			load($scope.item.id);
		}
	})
}])
.controller('view/item/error', ['$scope', 'app/error/observable', '$timeout', function($scope, errObservable, $timeout) {
	$scope.errorList = [];
	var nextId = 0;
	errObservable.subscribe(function(error) {
		addError(error);
	});
	var addError = function(error) {
		error.id = nextId++;
		$scope.errorList.push(error);
	};
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
.controller('view/item/create', ['$scope', 'command/item/create', 'app/error/observer', function($scope, command, errObserver) {
	$scope.item = {id: '', name: ''};
	$scope.createItem = function(form) {
		command($scope.item.id, $scope.item.name, errObserver);
	};	
}])
.controller('view/item/activate', ['$scope', 'command/item/activate', 'app/error/observer', function($scope, command, errObserver) {
	$scope.activateItem = function(form) {
		command($scope.item.id, errObserver);
	};	
}])
.controller('view/item/deactivate', ['$scope', 'command/item/deactivate', 'app/error/observer', function($scope, command, errObserver) {
	$scope.deactivateItem = function(form) {
		command($scope.item.id, errObserver);
	};	
}])
.controller('view/item/check/in', ['$scope', 'command/item/check/in', 'app/error/observer', function($scope, command, errObserver) {
	$scope.checkInItem = function(form) {
		command($scope.item.id, $scope.item.countAdded, errObserver);
	};	
}])
.controller('view/item/check/out', ['$scope', 'command/item/check/out', 'app/error/observer', function($scope, command, errObserver) {
	$scope.checkOutItem = function(form) {
		command($scope.item.id, $scope.item.countRemoved, errObserver);
	};	
}])
.controller('view/item/rename', ['$scope', 'command/item/rename', 'app/error/observer', function($scope, command, errObserver) {
	$scope.renameItem = function(form) {
		command($scope.item.id, $scope.item.newName, errObserver);
	};	
}])
.run(['command/item/create', 'app/error/observer', function(createItem, errObserver) {
	createItem('Item0001', 'Item One', errObserver);
	createItem('Item0002', 'Item Two', errObserver);
	createItem('Item0003', 'Item Three', errObserver);
}])
