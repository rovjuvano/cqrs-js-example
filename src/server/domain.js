var subject, subject1;
angular.module('module/cqrs/example/domain/item', [
	'Rx',
	'UUID',
	'module/cqrs/example/network/http',
	'module/cqrs/example/network/event',
	'module/cqrs/example/builder/item/basic',
])
.constant('Guard', {
	against: function(condition, message) {
		if (condition) throw new Error(message);
	}
})
.value('store/item/event/current', [])
.config(['$provide', 'Rx', function($provide, Rx) {
	if (!subject) {
		subject = new Rx.Subject();
	}
	$provide.factory('store/item/event/observer', function() { return subject });
	$provide.factory('store/item/event/future', function() {
		return subject.selectMany(function(events) {
			return Rx.Observable.fromArray(events, Rx.Scheduler.timeout);
		});
	});
}])
.factory('store/item/event', ['Rx', 'store/item/event/current', 'store/item/event/observer', 'store/item/event/future', function(Rx, store, subject, subjectObservable) {
	var observer = {
		onNext: function(events) {
			events.forEach(function(event) {
				store.push(event);
			});
			subject.onNext(events);
		},
	};
	var observable = Rx.Observable.create(function(observer) {
		var o = Rx.Observable.fromArray(store, Rx.Scheduler.timeout).concat(subjectObservable);
		o.zip(o.startWith({}), function(current, prior) {
			current._priorEventId = prior.eventId;
			return current;
		})
		.subscribe(observer);
	});
	return new Rx.Subject.create(observer, observable);
}])
.constant('store/item/command', [])
.factory('domain/item', ['Rx', '$log', 'store/item/event/current', 'builder/item/basic', 'domain/item/observer', 'UUID', function(Rx, $log, eventStore, builder, observer, UUID) {
	function load(itemId, expectNew) {
		$log.log('domain {');
		return Rx.Observable.fromArray(eventStore)
		.filter(function(event) {
			return event.data.id === itemId;
		})
		.aggregate({}, function(item, event) {
			$log.log(' ', event);
			builder[event.type].call(item, event.data);
			return item;
		})
		.do(function() { $log.log('}') })
		.select(function(item) {
			var isNew = Object.keys(item).length === 0;
			if (isNew && expectNew) {
				return true;
			}
			if (!isNew && !expectNew) {
				return item;
			}
			return undefined;
		})
	};
	return {
		create: function(itemId) {
			return load(itemId, true);
		},
		load: function(itemId) {
			return load(itemId, false);
		},
	};
}])
.constant('handler', {})
.run(['handler', 'domain/item', 'Guard', function(handler, domain, Guard) {
	handler['create'] = function(args) {
		var itemId = args.id;
		return domain.create(itemId).selectMany(function(isNew) {
			Guard.against(!isNew, 'Item already exists with ID: ' + itemId);
			var name = args.name;
			Guard.against(typeof itemId !== 'string', 'ID must be a string.');
			Guard.against(itemId.length === 0, 'ID cannot be empty.');
			Guard.against(typeof name !== 'string', 'Name must be a string.');
			Guard.against(name.length === 0, 'Name cannot be empty.');
			var events = [['created', {id: itemId, name: name}]];
			if (args.hasOwnProperty('active')) {
				var active = args.active;
				Guard.against(typeof active !== 'boolean', 'active flag must be a boolean.');
				events.push([active ? 'activated' : 'deactivated', {id: itemId}]);
			}
			if (args.hasOwnProperty('count')) {
				var count = args.count;
				Guard.against(typeof count !== 'number', 'Checkin count must be a number.');
				Guard.against(isNaN(count), 'Checkin count must be a number.');
				Guard.against(Math.floor(count) !== count, 'Checkin count must be a whole number.');
				Guard.against(count < 0, 'Checkin count must be greater than zero.');
				events.push(['checkedIn', {id: itemId, count: count}]);
			}
			return Rx.Observable.fromArray(events);
		});
	};
}])
.run(['handler', 'domain/item', 'Guard', function(handler, domain, Guard) {
	handler['activate'] = function(args) {
		return domain.load(args.id).select(function(item) {
			Guard.against(item === undefined, 'Item not found: ' + args.id);
			return ['activated', {id: item.id}];
		});
	};
}])
.run(['handler', 'domain/item', 'Guard', function(handler, domain, Guard) {
	handler['deactivate'] = function(args) {
		return domain.load(args.id).select(function(item) {
			Guard.against(item === undefined, 'Item not found: ' + args.id);
			return ['deactivated', {id: item.id}];
		});
	};
}])
.run(['handler', 'domain/item', 'Guard', function(handler, domain, Guard) {
	handler['check/in'] = function(args) {
		return domain.load(args.id).select(function(item) {
			Guard.against(item === undefined, 'Item not found: ' + args.id);
			var count = args.count;
			Guard.against(typeof count !== 'number', 'Checkin count must be a number.');
			Guard.against(isNaN(count), 'Checkin count must be a number.');
			Guard.against(Math.floor(count) !== count, 'Checkin count must be a whole number.');
			Guard.against(count < 0, 'Checkin count must be greater than zero.');
			return ['checkedIn', {id: item.id, count: count}];
		});
	};
}])
.run(['handler', 'domain/item', 'Guard', function(handler, domain, Guard) {
	handler['check/out'] = function(args) {
		return domain.load(args.id).select(function(item) {
			Guard.against(item === undefined, 'Item not found: ' + args.id);
			var count = args.count;
			Guard.against(typeof count !== 'number', 'Checkout count must be a number.');
			Guard.against(isNaN(count), 'Checkout count must be a number.');
			Guard.against(Math.floor(count) !== count, 'Checkout count must be a whole number.');
			Guard.against(count < 0, 'Checkout count must be greater than zero.');
			Guard.against(item.count < count, 'Checkout count (' + count + ') must be less than or equal to inventory count (' + item.count + ')');
			return ['checkedOut', {id: item.id, count: count}];
		});
	};
}])
.run(['handler', 'domain/item', 'Guard', function(handler, domain, Guard) {
	handler['rename'] = function(args) {
		return domain.load(args.id).select(function(item) {
			Guard.against(item === undefined, 'Item not found: ' + args.id);
			var name = args.name;
			Guard.against(typeof name !== 'string', 'Name must be a string.');
			Guard.against(name.length === 0, 'Name cannot be empty.');
			return ['renamed', {id: item.id, name: name}];
		});
	};
}])
.factory('handle', ['handler', 'store/item/command', 'store/item/event', 'UUID', function(handler, commandStore, eventStore, UUID) {
	return function(type, args) {
		var command = {
			timestamp: new Date(),
			commandId: UUID(),
			type: type,
			data: args,
		};
		commandStore.push(command);
		var response;
		handler[command.type](args)
			.select(function(args) {
				return {
					timestamp: new Date(),
					eventId: UUID(),
					type: args[0],
					data: args[1],
				};
			})
			.toArray()
			.do(function(events) {
				command.events = events.map(function(event) { return event.type }).join(', ');
				eventStore.onNext(events);
			})
			.subscribe(function(events) {
				response = [200, events, {}];
			}, function(error) {
				command.error = error.message;
				response = [400, error.message, {}];
			});
		return response;
	};
}])
.run(['$httpBackend', '$log', 'handle', 'app/command/observer', function($httpBackend, $log, handle, appObserver) {
	var re = new RegExp('/command/item/(.*)');
	$httpBackend.when('POST', re).respond(function(method, url, rawData, headers) {
		var commandType = url.replace(re, '$1');
		try {
			return handle(commandType, JSON.parse(rawData));
		}
		catch (e) {
			$log.warn('handler terminated very abnormally');
			return [400, e.message, {}];
		} finally {
			appObserver.onNext();
		}
	});
}])
.config(['$provide', 'Rx', function($provide, Rx) {
	if (!subject1) {
		subject1 = new Rx.Subject();
	}
	$provide.factory('app/command/observable', function() { return subject1 });
	$provide.factory('app/command/observer', function() { return subject1 });
}])
.controller('commandStore', ['$scope', 'store/item/command', 'app/command/observable', function($scope, commandStore, observable) {
	$scope.commandStore = commandStore;
	observable.subscribe(function() {
		$scope.$apply();
	});
}])
.controller('eventStore', ['$scope', 'store/item/event/current', 'store/item/event/future', function($scope, eventStore, observable) {
	$scope.eventStore = eventStore;
	observable.subscribe(function() {
		$scope.$apply();
	});
}])
