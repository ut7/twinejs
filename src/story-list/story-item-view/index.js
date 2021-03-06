/**
 An individual item in the list managed by StoryListView.
 This offers quick links for editing, playing, and deleting
 a story; StoryEditView handles more detailed changes.

 @class StoryItemView
 @extends Marionette.ItemView
**/

'use strict';
const $ = require('jquery');
const _ = require('underscore');
const moment = require('moment');
const Vue = require('vue');
const locale = require('../../locale');
const confirm = require('../../ui/confirm');
const notify = require('../../ui/notify');
const prompt = require('../../ui/prompt');
const publish = require('../../story-publish');
const Passage = require('../../data/models/passage');
const PassageCollection = require('../../data/collections/passage');
const ZoomTransition = require('../zoom-transition');

module.exports = Vue.extend({
	template: require('./index.html'),

	props: {
		// Currently a Backbone model.
		'model': Object,
	},

	components: {
		'story-preview': require('../story-preview'),
	},

	computed: {
		lastUpdate() {
			return moment(this.model.get('lastUpdate')).format('lll');
		},
		name() {
			return this.model.get('name');
		},
		hue() {
			return [...this.model.get('name')].reduce((hue, char) => hue + char.charCodeAt(), 0) % 360;
		},
		passages() {
			return PassageCollection.all().where({ story: this.model.get('id') });
		},
	},

	methods: {
		/**
		 Opens a StoryEditView for this story.

		 @method edit
		**/

		edit() {
			const $el = $(this.$el);
			new ZoomTransition({ data: {
				x: $el.offset().left + $el.outerWidth() / 2,
				y: $el.offset().top,
			}}).$mountTo(this.$el).then(
				() => window.location.hash = '#stories/' + this.model.id
			);
		},

		/**
		 Plays this story in a new tab.

		 @method play
		**/

		play() {
			if (Passage.withId(this.model.get('startPassage')) === undefined) {
				notify(
					locale.say(
						'This story does not have a starting point. ' +
						'Edit this story and use the ' +
						'<i class="fa fa-rocket"></i> icon on a passage to set ' +
						'this.'
					),
					'danger'
				);
			}
			else {
				window.open(
					'#stories/' + this.model.id + '/play',
					'twinestory_play_' + this.model.id
				);
			}
		},

		/**
		 Tests this story in a new tab.

		 @method test
		**/

		test() {
			if (Passage.withId(this.model.get('startPassage')) === undefined) {
				notify(
					locale.say(
						'This story does not have a starting point. ' +
						'Edit this story and use the ' +
						'<i class="fa fa-rocket"></i> icon on a passage to ' +
						'set this.'
					),
					'danger'
				);
			}
			else {
				window.open(
					'#stories/' + this.model.id + '/test',
					'twinestory_test_' + this.model.id
				);
			}
		},

		/**
		 Downloads the story to a file.

		 @method publish
		**/

		publish() {
			// verify the starting point

			if (Passage.withId(this.model.get('startPassage')) === undefined) {
				notify(
					locale.say(
						'This story does not have a starting point. ' +
						'Use the <i class="fa fa-rocket"></i> icon on a ' +
						'passage to set this.'
					),
					'danger'
				);
			}
			else {
				publish.publishStory(this.model, this.model.get('name') + '.html');
			}
		},

		/**
		 Shows a confirmation before deleting the model via delete().

		 @method confirmDelete
		**/

		confirmDelete() {
			confirm({
				message:
					locale.say(
						'Are you sure you want to delete &ldquo;%s&rdquo;? ' +
						'This cannot be undone.',
						_.escape(this.model.get('name'))
					),
				buttonLabel:
					'<i class="fa fa-trash-o"></i> ' + locale.say('Delete Forever'),
				buttonClass:
					'danger'
			})
			.then(() => this.delete());
		},

		/**
		 Prompts the user for a new name for the story, then saves it.

		 @method rename
		**/

		rename() {
			prompt({
				message:
					locale.say(
						'What should &ldquo;%s&rdquo; be renamed to?',
						_.escape(this.model.get('name'))
					),
				buttonLabel:
					'<i class="fa fa-ok"></i> ' + locale.say('Rename'),
				defaultText:
					this.model.get('name'),
				blankTextError:
					locale.say('Please enter a name.')
			})
			.then((name) => this.model.save({ name }));
		},

		/**
		 Prompts the user for a name, then creates a duplicate version of this
		 story accordingly.

		 @method confirmDuplicate
		**/

		confirmDuplicate() {
			prompt({
				message:
					locale.say('What should the duplicate be named?'),
				buttonLabel:
					'<i class="fa fa-copy"></i> ' + locale.say('Duplicate'),
				defaultText:
					locale.say('%s Copy', this.model.get('name')),
				blankTextError:
					locale.say('Please enter a name.')
			})
			.then((text) => this.$dispatch('add', this.model.duplicate(text)));
		},

		/**
		 Deletes the model associated with this view.

		 @method delete
		**/

		delete() {
			$(this.$el).addClass('disappear').one('animationend', () => {
				this.model.destroy();
				this.$destroy();
			});
		},

	},
});
