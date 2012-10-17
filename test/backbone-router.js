var _ = require('component-underscore')
var $ = require('component-jquery')

var Backbone = {}
var Router = Backbone.Router = require('backbone-router')
Backbone.History = require('local-backbone-history')

var equal = assert.equal
var strictEqual = assert.strictEqual
var ok = assert.ok

var router = null;
var location = null;
var lastRoute = null;
var lastArgs = [];

function onRoute(router, route, args) {
	lastRoute = route;
	lastArgs = args;
}

var Location = function(href) {
	this.replace(href);
};

_.extend(Location.prototype, {

	replace: function(href) {
		_.extend(this, _.pick($('<a></a>', {href: href})[0],
			'href',
			'hash',
			'host',
			'search',
			'fragment',
			'pathname',
			'protocol'
		));
		// In IE, anchor.pathname does not contain a leading slash though
		// window.location.pathname does.
		if (!/^\//.test(this.pathname)) this.pathname = '/' + this.pathname;
	},

	toString: function() {
		return this.href;
	}
});

var Router = Backbone.Router.extend({

	count: 0,

	routes: {
		"noCallback":                 "noCallback",
		"counter":                    "counter",
		"search/:query":              "search",
		"search/:query/p:page":       "search",
		"contacts":                   "contacts",
		"contacts/new":               "newContact",
		"contacts/:id":               "loadContact",
		"optional(/:item)":           "optionalItem",
		"splat/*args/end":            "splat",
		"*first/complex-:part/*rest": "complex",
		":entity?*args":              "query",
		"*anything":                  "anything"
	},

	initialize : function(options) {
		this.testing = options.testing;
		this.route('implicit', 'implicit');
	},

	counter: function() {
		this.count++;
	},

	implicit: function() {
		this.count++;
	},

	search : function(query, page) {
		this.query = query;
		this.page = page;
	},

	contacts: function(){
		this.contact = 'index';
	},

	newContact: function(){
		this.contact = 'new';
	},

	loadContact: function(){
		this.contact = 'load';
	},

	optionalItem: function(arg){
		this.arg = arg !== undefined ? arg : null;
	},

	splat : function(args) {
		this.args = args;
	},

	complex : function(first, part, rest) {
		this.first = first;
		this.part = part;
		this.rest = rest;
	},

	query : function(entity, args) {
		this.entity    = entity;
		this.queryArgs = args;
	},

	anything : function(whatever) {
		this.anything = whatever;
	}

});

describe("BackboneRouter", function() {
	beforeEach(function() {
		location = new Location('http://example.com');
		Backbone.history = _.extend(new Backbone.History, {location: location});
		router = new Router({testing: 101});
		Backbone.history.interval = 9;
		Backbone.history.start({pushState: false});
		lastRoute = null;
		lastArgs = [];
		Backbone.history.on('route', onRoute);
	})

	afterEach(function() {
		Backbone.history.stop();
		Backbone.history.off('route', onRoute);
	})


it("initialize", function() {
	equal(router.testing, 101);
});

it("routes (simple)", function() {
	location.replace('http://example.com#search/news');
	Backbone.history.checkUrl();
	equal(router.query, 'news');
	equal(router.page, undefined);
	equal(lastRoute, 'search');
	equal(lastArgs[0], 'news');
});

it("routes (two part)", function() {
	location.replace('http://example.com#search/nyc/p10');
	Backbone.history.checkUrl();
	equal(router.query, 'nyc');
	equal(router.page, '10');
});

it("routes via navigate", function() {
	Backbone.history.navigate('search/manhattan/p20', {trigger: true});
	equal(router.query, 'manhattan');
	equal(router.page, '20');
});

it("routes via navigate for backwards-compatibility", function() {
	Backbone.history.navigate('search/manhattan/p20', true);
	equal(router.query, 'manhattan');
	equal(router.page, '20');
});

it("route precedence via navigate", function(){
	// check both 0.9.x and backwards-compatibility options
	_.each([ { trigger: true }, true ], function( options ){
		Backbone.history.navigate('contacts', options);
		equal(router.contact, 'index');
		Backbone.history.navigate('contacts/new', options);
		equal(router.contact, 'new');
		Backbone.history.navigate('contacts/foo', options);
		equal(router.contact, 'load');
	});
});

it("loadUrl is not called for identical routes.", function() {
	Backbone.history.loadUrl = function(){ ok(false); };
	location.replace('http://example.com#route');
	Backbone.history.navigate('route');
	Backbone.history.navigate('/route');
	Backbone.history.navigate('/route');
});

it("use implicit callback if none provided", function() {
	router.count = 0;
	router.navigate('implicit', {trigger: true});
	equal(router.count, 1);
});

it("routes via navigate with {replace: true}", function() {
	location.replace('http://example.com#start_here');
	Backbone.history.checkUrl();
	location.replace = function(href) {
		strictEqual(href, new Location('http://example.com#end_here').href);
	};
	Backbone.history.navigate('end_here', {replace: true});
});

it("routes (splats)", function() {
	location.replace('http://example.com#splat/long-list/of/splatted_99args/end');
	Backbone.history.checkUrl();
	equal(router.args, 'long-list/of/splatted_99args');
});

it("routes (optional)", function() {
	location.replace('http://example.com#optional');
	Backbone.history.checkUrl();
	equal(router.arg, null);
	location.replace('http://example.com#optional/thing');
	Backbone.history.checkUrl();
	equal(router.arg, 'thing');
});

it("routes (complex)", function() {
	location.replace('http://example.com#one/two/three/complex-part/four/five/six/seven');
	Backbone.history.checkUrl();
	equal(router.first, 'one/two/three');
	equal(router.part, 'part');
	equal(router.rest, 'four/five/six/seven');
});

it("routes (query)", function() {
	location.replace('http://example.com#mandel?a=b&c=d');
	Backbone.history.checkUrl();
	equal(router.entity, 'mandel');
	equal(router.queryArgs, 'a=b&c=d');
	equal(lastRoute, 'query');
	equal(lastArgs[0], 'mandel');
	equal(lastArgs[1], 'a=b&c=d');
});

it("routes (anything)", function() {
	location.replace('http://example.com#doesnt-match-a-route');
	Backbone.history.checkUrl();
	equal(router.anything, 'doesnt-match-a-route');
});

it("fires event when router doesn't have callback on it", function() {
	router.on("route:noCallback", function(){ ok(true); });
	location.replace('http://example.com#noCallback');
	Backbone.history.checkUrl();
});

it("#933, #908 - leading slash", function() {
	location.replace('http://example.com/root/foo');

	Backbone.history.stop();
	Backbone.history = _.extend(new Backbone.History, {location: location});
	Backbone.history.start({root: '/root', hashChange: false, silent: true});
	strictEqual(Backbone.history.getFragment(), 'foo');

	Backbone.history.stop();
	Backbone.history = _.extend(new Backbone.History, {location: location});
	Backbone.history.start({root: '/root/', hashChange: false, silent: true});
	strictEqual(Backbone.history.getFragment(), 'foo');
});

it("#1003 - History is started before navigate is called", function() {
	Backbone.history.stop();
	Backbone.history.navigate = function(){ ok(Backbone.History.started); };
	Backbone.history.start();
	// If this is not an old IE navigate will not be called.
	if (!Backbone.history.iframe) ok(true);
});

it("route callback gets passed decoded values", function() {
	var route = 'has%2Fslash/complex-has%23hash/has%20space';
	Backbone.history.navigate(route, {trigger: true});
	equal(router.first, 'has/slash');
	equal(router.part, 'has#hash');
	equal(router.rest, 'has space');
});

it("correctly handles URLs with % (#868)", function() {
	location.replace('http://example.com#search/fat%3A1.5%25');
	Backbone.history.checkUrl();
	location.replace('http://example.com#search/fat');
	Backbone.history.checkUrl();
	equal(router.query, 'fat');
	equal(router.page, undefined);
	equal(lastRoute, 'search');
});

it("#1185 - Use pathname when hashChange is not wanted.", function() {
	Backbone.history.stop();
	location.replace('http://example.com/path/name#hash');
	Backbone.history = _.extend(new Backbone.History, {location: location});
	Backbone.history.start({hashChange: false});
	var fragment = Backbone.history.getFragment();
	strictEqual(fragment, location.pathname.replace(/^\//, ''));
});

it("#1206 - Strip leading slash before location.assign.", function() {
	Backbone.history.stop();
	location.replace('http://example.com/root/');
	Backbone.history = _.extend(new Backbone.History, {location: location});
	Backbone.history.start({hashChange: false, root: '/root/'});
	location.assign = function(pathname) {
		strictEqual(pathname, '/root/fragment');
	};
	Backbone.history.navigate('/fragment');
});

it("#1387 - Root fragment without trailing slash.", function() {
	Backbone.history.stop();
	location.replace('http://example.com/root');
	Backbone.history = _.extend(new Backbone.History, {location: location});
	Backbone.history.start({hashChange: false, root: '/root/', silent: true});
	strictEqual(Backbone.history.getFragment(), '');
});

it("#1366 - History does not prepend root to fragment.", function() {
	Backbone.history.stop();
	location.replace('http://example.com/root/');
	Backbone.history = _.extend(new Backbone.History, {
		location: location,
		history: {
			pushState: function(state, title, url) {
				strictEqual(url, '/root/x');
			}
		}
	});
	Backbone.history.start({
		root: '/root/',
		pushState: true,
		hashChange: false
	});
	Backbone.history.navigate('x');
	strictEqual(Backbone.history.fragment, 'x');
});

it("Normalize root.", function() {
	Backbone.history.stop();
	location.replace('http://example.com/root');
	Backbone.history = _.extend(new Backbone.History, {
		location: location,
		history: {
			pushState: function(state, title, url) {
				strictEqual(url, '/root/fragment');
			}
		}
	});
	Backbone.history.start({
		pushState: true,
		root: '/root',
		hashChange: false
	});
	Backbone.history.navigate('fragment');
});

it("Normalize root.", function() {
	Backbone.history.stop();
	location.replace('http://example.com/root#fragment');
	Backbone.history = _.extend(new Backbone.History, {
		location: location,
		history: {
			pushState: function(state, title, url) {},
			replaceState: function(state, title, url) {
				strictEqual(url, '/root/fragment');
			}
		}
	});
	Backbone.history.start({
		pushState: true,
		root: '/root'
	});
});

it("Normalize root.", function() {
	Backbone.history.stop();
	location.replace('http://example.com/root');
	Backbone.history = _.extend(new Backbone.History, {location: location});
	Backbone.history.loadUrl = function() { ok(true); };
	Backbone.history.start({
		pushState: true,
		root: '/root'
	});
});

it("Normalize root - leading slash.", function() {
	Backbone.history.stop();
	location.replace('http://example.com/root');
	Backbone.history = _.extend(new Backbone.History, {
		location: location,
		history: {
			pushState: function(){},
			replaceState: function(){}
		}
	});
	Backbone.history.start({root: 'root'});
	strictEqual(Backbone.history.root, '/root/');
});

it("Transition from hashChange to pushState.", function() {
	Backbone.history.stop();
	location.replace('http://example.com/root#x/y');
	Backbone.history = _.extend(new Backbone.History, {
		location: location,
		history: {
			pushState: function(){},
			replaceState: function(state, title, url){
				strictEqual(url, '/root/x/y');
			}
		}
	});
	Backbone.history.start({
		root: 'root',
		pushState: true
	});
});

it("#1619: Router: Normalize empty root", function() {
	Backbone.history.stop();
	location.replace('http://example.com/');
	Backbone.history = _.extend(new Backbone.History, {
		location: location,
		history: {
			pushState: function(){},
			replaceState: function(){}
		}
	});
	Backbone.history.start({root: ''});
	strictEqual(Backbone.history.root, '/');
});

it("#1619: Router: nagivate with empty root", function() {
	Backbone.history.stop();
	location.replace('http://example.com/');
	Backbone.history = _.extend(new Backbone.History, {
		location: location,
		history: {
			pushState: function(state, title, url) {
				strictEqual(url, '/fragment');
			}
		}
	});
	Backbone.history.start({
		pushState: true,
		root: '',
		hashChange: false
	});
	Backbone.history.navigate('fragment');
});

it("Transition from pushState to hashChange.", function() {
	Backbone.history.stop();
	location.replace('http://example.com/root/x/y?a=b');
	location.replace = function(url) {
		strictEqual(url, '/root/?a=b#x/y');
	};
	Backbone.history = _.extend(new Backbone.History, {
		location: location,
		history: {
			pushState: null,
			replaceState: null
		}
	});
	Backbone.history.start({
		root: 'root',
		pushState: true
	});
});

it("#1695 - hashChange to pushState with search.", function() {
	Backbone.history.stop();
	location.replace('http://example.com/root?a=b#x/y');
	Backbone.history = _.extend(new Backbone.History, {
		location: location,
		history: {
			pushState: function(){},
			replaceState: function(state, title, url){
				strictEqual(url, '/root/x/y?a=b');
			}
		}
	});
	Backbone.history.start({
		root: 'root',
		pushState: true
	});
});
})
