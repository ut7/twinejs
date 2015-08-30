/**
 The main Backbone app running the show. This is accessible via the
 global variable `window.app`.
 
 @module Twine
 @class TwineApp
 @extends Backbone.Marionette.Application
**/

'use strict';
var $ = require('jquery');
var _ = require('underscore');
var moment = require('moment');
var Backbone = require('backbone');
var Marionette = require('backbone.marionette');
var locale = require('../locale');
var notify = require('../ui/notify');
var nwui = require('../nwui');
var ui = require('../ui');
var AppPref = require('../data/models/appPref');
var StoryFormatCollection = require('../data/collections/storyFormatCollection');
var TransRegion = require('../backbone-ext/transRegion');
var TwineRouter = require('./router');

var TwineApp = module.exports = Marionette.Application.extend(
{
	initialize: function()
	{
		this.on('start', this.start);
	},

	start: function()
	{
		if (nwui.active)
			nwui.init();

		/**
		 Name of the app.

		 @property name
		**/

		this.name = $('html').data('app-name');

		/**
		 Version number of the app.

		 @property version
		**/

		this.version = $('html').data('version');

		/**
		 Build number of the app.

		 @property buildNumber
		**/

		this.buildNumber = parseInt($('html').data('build-number'));

		// add i18n hook to Marionette's rendering

		var templateProperties =
		{
			moment: moment,
			s: locale.say.bind(locale),
			sp: locale.sayPlural.bind(locale)
		};

		Marionette.Renderer.render = function (template, data)
		{
			if (typeof template !== 'function')
				throw new Error(locale.say('Asked to render a non-function template ' + template));
			return template(_.extend(data, templateProperties));
		};

		// set up our main region

		this.addRegions(
		{
			/**
			 The top-level container for views.

			 @property mainRegion
			**/

			mainRegion:
			{
				selector: '#regions .main',
				regionClass: TransRegion
			}
		});

		ui.init();

		/**
		 The app router.

		 @property router
		 @type TwineRouter
		**/

		this.router = new TwineRouter({ app: this });
		Backbone.history.start();

		// create built-in story formats if they don't already exist

		var formats = StoryFormatCollection.all();

		if (! formats.findWhere({ name: 'Harlowe' }))
			formats.create({ name: 'Harlowe', url: 'storyformats/Harlowe/format.js', userAdded: false });

		if (! formats.findWhere({ name: 'Snowman' }))
			formats.create({ name: 'Snowman', url: 'storyformats/Snowman/format.js', userAdded: false });

		if (! formats.findWhere({ name: 'Paperthin' }))
			formats.create({ name: 'Paperthin', url: 'storyformats/Paperthin/format.js', userAdded: false });

		if (! formats.findWhere({ name: 'SugarCube' }))
			formats.create({ name: 'SugarCube', url: 'storyformats/SugarCube/format.js', userAdded: false });

		// set default formats if not already set
		// (second param is a default)

		AppPref.withName('defaultFormat', 'Harlowe');
		AppPref.withName('proofingFormat', 'Paperthin');
	},

	/**
	 Checks for a newer version of the Twine app against
	 http://twinery.org/latestversion/2.json, using build numbers which
	 are automatically generated by Grunt.

	 If retrieving this information fails, then this does nothing.

	 @method checkForUpdate
	 @param {Number} latestBuildNumber build number to consider as current. This is
	                                   required; the app's build number is stored in
									   window.app.buildNumber.
	 @param {Function} callback if a new version is available, this is called with
	                            an object with the properties buildNumber, the newest
								release's build number, version, the human-readable
								version number, and url, the URL the download is available at.
	**/

	checkForUpdate: function (latestBuildNumber, callback)
	{
		$.getJSON('http://twinery.org/latestversion/2.json', function (data)
		{
			if (data.buildNumber > latestBuildNumber)
				callback(data);
		});
	}
});
