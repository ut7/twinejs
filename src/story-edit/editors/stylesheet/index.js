/*
  Manages the script editor modal of a StoryEditView.

  @class StoryEditView.ScriptEditor
  @extends Backbone.View
*/

'use strict';
var Marionette = require('backbone.marionette');
var CodeMirror = require('codemirror');
var modal = require('../../../ui/modal');
var modalTemplate = require('./modal.ejs');

// These CodeMirror modules attach to the CodeMirror module directly.

require('codemirror/addon/display/placeholder');
require('codemirror/addon/hint/show-hint');
require('codemirror/mode/css/css');

module.exports = Marionette.ItemView.extend({
	/*
	Opens a modal for a particular story.

	@method open
	@param {`data/story`} story story whose script to edit
	@static
	*/
	open: function(story) {
		this.story = story;

		this.setElement(modal.open({
			classes: 'editor',
			content: Marionette.Renderer.render(modalTemplate, story.attributes)
		}));

		this.setupCodeMirror();
	},

	setupCodeMirror: function() {
		/*
		The instance of CodeMirror used for editing.

		@property cm
		*/
		this.cm = CodeMirror.fromTextArea(this.$('.stylesheetSource')[0], {
			lineWrapping: true,
			lineNumbers: false,
			tabSize: 2,
			indentWithTabs: true,
			mode: 'css',
			extraKeys: {
				'Ctrl-Space': function(cm) {
					cm.showHint();
				}
			}
		});

		/*
		Actually show the editor. We refresh twice; now so the text will show
		properly as the modal animates onscreen, and later, once the animation
		completes, so scrolling works properly.
		*/

		this.cm.refresh();

		this.$el.one('modalOpen.twineui', function() {
			this.cm.refresh();
			this.cm.focus();
		}.bind(this));
	},

	/*
	Saves changes to the model.

	@method save
	@static
	*/
	save: function() {
		this.story.save({stylesheet: this.cm.doc.getValue()});
	},

	events: {
		'modalClose.twineui': 'save'
	}
});