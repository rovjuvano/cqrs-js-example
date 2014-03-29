angular.module('module/cqrs/example/domain/item', [
	'Rx',
	'module/cqrs/example/network/http',
	'module/cqrs/example/network/event',
	'module/cqrs/example/builder/item/basic',
])
.constant('Guard', {
	against: function(condition, message) {
		if (condition) throw new Error(message);
	}
})
.constant('store/item/event', {})
.constant('store/item/command', [])
.factory('domain/item', ['store/item/event', 'domain/item/observer', 'builder/item/basic', function(eventStore, observer, builder) {
	var create = function(rootId) {
		eventStore[rootId] = [];
		return eventStore[rootId];
	};
	return {
		exists: function(rootId) {
			return !!eventStore[rootId];
		},
		load: function(rootId) {
			var item;
			console.log('domain {');
			if (eventStore[rootId]) {
				item = {};
				eventStore[rootId].forEach(function(event) {
					console.log(' ', event);
					builder[event.type].call(item, event.data);
				});
			}
			console.log('}');
			return item;
		},
		makeEvents: function(rootId, list) {
			var store = (eventStore[rootId] || create(rootId));
			list.forEach(function(item) {
				var event = {
					index: store.length,
					timestamp: new Date(),
					rootId: rootId,
					type: item[0],
					data: item[1],
				};
				store.push(event);
			});
			var events = store.slice(-list.length, store.length);
			events.forEach(function(event) {
				observer.onNext(event);
			});
			return events;
		},
	};
}])
.constant('handler', {})
.run(['handler', 'domain/item', 'Guard', function(handler, domain, Guard) {
	handler['create'] = function(command) {
		var itemId = command.data.id;
		var name = command.data.name;
		Guard.against(domain.exists(itemId), 'Item already exists with ID: ' + itemId);
		Guard.against(typeof itemId !== 'string', 'ID must be a string.');
		Guard.against(itemId.length === 0, 'ID cannot be empty.');
		Guard.against(typeof name !== 'string', 'Name must be a string.');
		Guard.against(name.length === 0, 'Name cannot be empty.');
		var events = [['created', {id: itemId, name: name}]];
		if (command.data.hasOwnProperty('active')) {
			var active = command.data.active;
			Guard.against(typeof active !== 'boolean', 'active flag must be a boolean.');
			events.push([active ? 'activated' : 'deactivated', {}]);
		}
		if (command.data.hasOwnProperty('count')) {
			var count = command.data.count;
			Guard.against(typeof count !== 'number', 'Checkin count must be a number.');
			Guard.against(isNaN(count), 'Checkin count must be a number.');
			Guard.against(Math.floor(count) !== count, 'Checkin count must be a whole number.');
			Guard.against(count < 0, 'Checkin count must be greater than zero.');
			events.push(['checkedIn', {count: count}]);
		}
		return domain.makeEvents(itemId, events);
	};
}])
.run(['handler', 'domain/item', 'Guard', function(handler, domain, Guard) {
	handler['activate'] = function(command) {
		var rootId = command.rootId;
		Guard.against(!domain.exists(rootId), 'Item not found: ' + rootId);
		return domain.makeEvents(rootId, [['activated', {}]]);
	};
}])
.run(['handler', 'domain/item', 'Guard', function(handler, domain, Guard) {
	handler['deactivate'] = function(command) {
		var rootId = command.rootId;
		Guard.against(!domain.exists(rootId), 'Item not found: ' + rootId);
		return domain.makeEvents(rootId, [['deactivated', {}]]);
	};
}])
.run(['handler', 'domain/item', 'Guard', function(handler, domain, Guard) {
	handler['check/in'] = function(command) {
		var rootId = command.rootId;
		var count = command.data.count;
		Guard.against(!domain.exists(rootId), 'Item not found: ' + rootId);
		Guard.against(typeof count !== 'number', 'Checkin count must be a number.');
		Guard.against(isNaN(count), 'Checkin count must be a number.');
		Guard.against(Math.floor(count) !== count, 'Checkin count must be a whole number.');
		Guard.against(count < 0, 'Checkin count must be greater than zero.');
		return domain.makeEvents(rootId, [['checkedIn', {count: count}]]);
	};
}])
.run(['handler', 'domain/item', 'Guard', function(handler, domain, Guard) {
	handler['check/out'] = function(command) {
		var rootId = command.rootId;
		var count = command.data.count;
		Guard.against(!domain.exists(rootId), 'Item not found: ' + rootId);
		Guard.against(typeof count !== 'number', 'Checkout count must be a number.');
		Guard.against(isNaN(count), 'Checkout count must be a number.');
		Guard.against(Math.floor(count) !== count, 'Checkout count must be a whole number.');
		Guard.against(count < 0, 'Checkout count must be greater than zero.');
		var item = domain.load(rootId);
		Guard.against(item.count < count, 'Checkout count (' + count + ') must be less than or equal to inventory count (' + item.count + ')');
		return domain.makeEvents(rootId, [['checkedOut', {count: count}]]);
	};
}])
.run(['handler', 'domain/item', 'Guard', function(handler, domain, Guard) {
	handler['rename'] = function(command) {
		var rootId = command.rootId;
		var name = command.data.name;
		Guard.against(!domain.exists(rootId), 'Item not found: ' + rootId);
		Guard.against(typeof name !== 'string', 'Name must be a string.');
		Guard.against(name.length === 0, 'Name cannot be empty.');
		return domain.makeEvents(rootId, [['renamed', {name: name}]]);
	};
}])
.factory('handle', ['handler', 'store/item/command', function(handler, commandStore) {
	return function(command) {
		command.index = commandStore.length;
		command.timestamp = new Date();
		commandStore.push(command);
		return handler[command.type](command);
	};
}])
.run(['$httpBackend', 'handle', 'app/command/observer', function($httpBackend, handle, observer) {
	$httpBackend.when('POST', '/command/item').respond(function(method, url, rawData, headers) {
		try {
			var command = JSON.parse(rawData);
			var events = handle(command);
			command.events = events.map(function(event) { return event.type }).join(', ');
			return [200, events, {}];
		}
		catch (e) {
			command.error = e.message;
			return [400, e.message, {}];
		}
		finally {
			observer.onNext();			
		}
	});
}])
.config(['$provide', 'Rx', function($provide, Rx) {
	var subject = new Rx.Subject();
	$provide.factory('app/command/observable', function() { return subject });
	$provide.factory('app/command/observer', function() { return subject });
}])
.controller('commandStore', ['$scope', 'store/item/command', 'app/command/observable', function($scope, commandStore, observable) {
	$scope.commandStore = commandStore;
	observable.subscribe(function() {
		$scope.$apply();
	});
}])
.controller('eventStore', ['$scope', 'store/item/event', 'app/command/observable', function($scope, eventStore, observable) {
	$scope.eventStore = eventStore;
	observable.subscribe(function() {
		$scope.$apply();
	});
}])
