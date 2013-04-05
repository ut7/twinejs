// Renders a single story into the top-level list.

// Shows an individual story list item.

StoryView = Marionette.ItemView.extend({
	tagName: 'tr',
	template: '#templates .storyview',

	events:
	{
		'click .delete': function()
		{
			this.model.destroy();
		}
	}
});
