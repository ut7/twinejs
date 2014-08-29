StoryListView.FormatsModal = Backbone.View.extend(
{
	initialize: function (options)
	{
		this.parent = options.parent;
		this.itemTemplate = _.template($('.formatItem').html());
	},

	/**
	 Opens a modal dialog for editing default formats.

	 @method open
	**/

	open: function()
	{
		// begin loading formats immediately

		this.$('.storyFormats, .proofingFormats').empty();
		this.formatsToLoad = StoryFormatCollection.all();
		this.loadNextFormat();

		this.$el.data('modal').trigger('show');
	},

	/**
	 Closes the modal dialog for editing default formats.

	 @method close
	**/

	close: function()
	{
		this.$el.data('modal').trigger('hide');
	},

	/**
	 Incrementally loads information about each story format.
 	 If there are more remaining to be loaded, then this calls itself
	 once the load is complete.

	 @method loadNextFormat
	**/

	loadNextFormat: function()
	{
		if (this.formatsToLoad.length > 0)
		{
			var format = this.formatsToLoad.at(0);

			format.load(_.bind(function()
			{
				// calculate containing directory for the format
				// so that image URLs, for example, are correct

				var path = format.get('url').replace(/\/[^\/]*?$/, '');
				var fullContent = _.extend(format.properties, { path: path });
				var content = $(this.itemTemplate(fullContent));

				if (fullContent.proofing)
				{
					this.$('.proofingFormats').append(content);

					if (AppPref.withName('proofingFormat').get('value') == fullContent.name)
						content.find('button.setDefault').addClass('active');
				}
				else
				{
					this.$('.storyFormats').append(content);

					if (AppPref.withName('defaultFormat').get('value') == fullContent.name)
						content.find('button.setDefault').addClass('active');
				};

				this.formatsToLoad.remove(format);
				this.loadNextFormat();
			}, this));
		}
		else
			this.$('.loading').hide();
	},

	/**
	 Removes a story format.

	 @method removeFormat
	 @param {String} name the name of the story format
	 **/

	removeFormat: function (name)
	{
		StoryFormat.withName(name).destroy();
	},

	events:
	{
		'click .showRemoveConfirm': function (e)
		{
			var container = $(e.target).closest('.buttons');
			container.find('.normalButtons').hide();
			container.find('.removeConfirm').fadeIn();
		},

		'click .hideRemoveConfirm': function (e)
		{
			var container = $(e.target).closest('.buttons');
			container.find('.normalButtons').fadeIn();
			container.find('.removeConfirm').hide();
		},

		'click .remove': function (e)
		{
			var container = $(e.target).closest('.format');
			this.removeFormat(container.data('format'));
			container.slideUp();
		}
	}
});
