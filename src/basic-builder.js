angular.module('module/cqrs/example/builder/item/basic', [])
.factory('builder/item/basic', [function() {
	return {
		created: function(args) {
			this.id = args.id;
			this.name = args.name;
			this.count = 0;
			this.active = true;
			this._version = 0;
		},
		activated: function(args) {
			this.active = true;
			this._version++;
		},
		deactivated: function(args) {
			this.active = false;
			this._version++;
		},
		checkedIn: function(args) {
			this.count += args.count;
			this._version++;
		},
		checkedOut: function(args) {
			this.count -= args.count;
			this._version++;
		},
		renamed: function(args) {
			this.name = args.name;
			this._version++;
		},
	};
}]);
