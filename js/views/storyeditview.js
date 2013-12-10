/**
 Offers an interface for editing a story. This class is concerned
 with editing the story itself; editing individual passages is handled
 through PassageItemViews. This sets up links from the passage views to
 this one by setting each child's parentView property to this one.

 @class StoryEditView
 @extends Marionette.CompositeView
**/

StoryEditView = Marionette.CompositeView.extend(
{
	itemView: PassageItemView,
	itemViewContainer: '.passages',
	itemViewOptions: function() { return { parentView: this } },
	template: '#templates .storyEditView',

	/**
	 Maps numeric zoom settings (that are in our model) to
	 nice adjectives that we use in our CSS.

	 @property ZOOM_MAPPINGS
	 @type Object
	 @final
	**/

	ZOOM_MAPPINGS:
	{
		big: 1,
		medium: 0.5,
		small: 0.25
	},

	initialize: function (options)
	{
		var self = this;
		this.collection = new PassageCollection(app.passages.where({ story: this.model.id }));

		/**
		 Tracks passage positions and links to speed up drawing operations.
		 Call cachePassage() to update a passage in the cache.

		 @propert drawCache
		**/

		this.drawCache = {};

		// keep story name in sync

		this.model.on('change:name', function (model)
		{
			self.$('.storyName').text(model.get('name'));
		});

		// keep start passage menu and draw cache in sync

		this.collection
		.on('change:name', function (item)
		{
			delete self.drawCache[item.previous('name')];

			self.$('select.startPassage option').each(function()
			{
				if ($(this).val() == item.id || $(this).val() == item.cid)
					$(this).text(item.get('name'));
			});
		})
		.on('change', function (item)
		{
			self.cachePassage(item);
			self.drawLinks();
		})
		.on('add', function (item)
		{
			// set as starting passage if we only have one

			if (self.collection.length == 1)
			{
				self.model.save({ startPassage: item.cid });
			};

			self.$('select.startPassage').append($('<option value="' + (item.id || item.cid) +
												 '">' + item.get('name') + '</option>'));
			self.cachePassage(item);
			self.drawLinks();
		})
		.on('remove', function (item)
		{
			delete self.drawCache[item.get('name')];
			self.drawLinks();

			self.$('select.startPassage option').each(function()
			{
				if ($(this).val() == item.id)
					$(this).remove();
			});
		});

		this.on('itemview:change', function (childView)
		{
			this.cachePassage(childView.model);
		});
	},

	onRender: function()
	{
		var self = this;
		
		// set up tooltips

		this.$('a[title], button[title]').tooltip();

		// we use #storyPropertiesDialog as a template, but set the values
		// according to the model whenever the popover is shown.

		this.$('.storyProperties')
		.popover({
			html: true,
			placement: 'left',
			container: '#storyEditView',
			content: function() { return $('#storyPropertiesPopover').html() }
		})
		.click(function()
		{
			$('.popover input.storyName').val(self.model.get('name'));
		});

		// build the initial start passage menu

		var menu = this.$('#startPassage');

		this.collection.each(function (item)
		{
			menu.append($('<option value="' + item.id + '">' + item.get('name') + '</option>'));
		});

		// resize the canvas whenever the browser window resizes

		this.resizeCanvas();
		$(window).on('resize', function() { self.resizeCanvas() });

		// sync the DOM zoom attributes with the model

		this.setZoom();

		// automatically focus textareas on edit modals when they are shown

		$(document).on('shown.bs.modal', '.editModal', function()
		{
			var textarea = $(this).find('textarea')[0];
			var textLen = $(textarea).val().length;
			textarea.focus();

			// ugh feature detection
			// http://stackoverflow.com/questions/499126/jquery-set-cursor-position-in-text-area

			if (textarea.setSelectionRange)
				textarea.setSelectionRange(textLen, textLen);
			else if (textarea.createTextRange)
			{
				var range = textarea.createTextRange();
				range.collapse(true);
				range.moveEnd('character', textLen);
				range.moveStart('character', textLen);
				range.select();
			};
		});

		// for some reason, jQuery can't see the position of the passages yet, so we defer... kind of

		window.setTimeout(function()
		{
			self.collection.each(function(item) { self.cachePassage(item) });
			self.drawLinks();
		}, 0);
	},

	close: function()
	{
		$(window).off('resize');
	},

	/**
	 Changes the model's zoom and updates the view accordingly.

	 @method setZoom
	 @param {Number} zoom New zoom level -- 1 is 100%, 0.5 is 50%.
	                      If omitted, then this simply updates the view.
	**/

	setZoom: function (zoom)
	{
		if (zoom)
			this.model.save({ zoom: zoom });
		else
			zoom = this.model.get('zoom');

		// select the appropriate toolbar button
		// and change CSS class

		for (var desc in this.ZOOM_MAPPINGS)
			if (this.ZOOM_MAPPINGS[desc] == zoom)
			{
				var radio = this.$('input.zoom' + desc[0].toUpperCase() + desc.substr(1));
				radio.attr('checked', 'checked');
				radio.closest('label').addClass('active');
				this.$el.removeClass('zoom-small zoom-medium zoom-big').addClass('zoom-' + desc);
			};
		
		/**
		 Triggered whenever the zoom level of the view changes.
		 @event zoom 
		**/

	    this.trigger('zoom');

		// all of our cached passage positions are now out of date

		this.collection.each(this.cachePassage, this);
	    this.drawLinks();
    },

	/**
	 Sets the model's start passage.

	 @method setStartPassage
	 @param {Number} id id of the passage
	**/

	setStartPassage: function (id)
	{
		this.model.save({ startPassage: id });
	},

	/**
	 Set the model's name.

	 @method setName
	 @param {String} name New name to set
	**/

	setName: function (name)
	{
		this.model.save({ name: name });
	},

	/**
	 Adds a new passage to the center of the view.

	 @method addPassage
	**/

	addPassage: function()
	{
		var offsetX = this.$('.passage:first').width() / 2;
		var offsetY = this.$('.passage:first').height() / 2;

		var passage = this.collection.create(
		{
			story: this.model.id,
			top: ($(window).scrollTop() + $(window).height() / 2) - offsetY,
			left: ($(window).scrollLeft() + $(window).width() / 2) - offsetX
		});
		
		// catch dupe passage names

		if (! passage.isValid())
		{
			var origName = passage.get('name');
			var untitledIndex = 0;

			do
			{
				passage.set({ name: origName + ' ' + (++untitledIndex) });
			}
			while (! passage.isValid() && passage.validationError == Passage.DUPE_NAME_ERROR.replace('%s', passage.get('name')));
		};

		// position the passage so it doesn't overlap any others

		this.positionPassage(passage);
		passage.save();
		this.children.findByModel(passage).appear();
	},

	/**
	 Opens a new tab with the playable version of this story. This
	 will re-use the same tab for a particular story.

	 @method play
	**/

	play: function()
	{
		window.open('#stories/' + this.model.id + '/play', 'twinestory_play_' + this.model.id);
	},

	/**
	 Opens a new tab with the proofing copy of this story. This
	 will re-use the same tab for a particular story.

	 @method proof
	**/

	proof: function()
	{
		window.open('#stories/' + this.model.id + '/proof', 'twinestory_proof_' + this.model.id);
	},

	/**
	 Publishes a story by passing control over to TwineApp.publishStory.	

	 @method publish
	**/

	publish: function()
	{
		window.app.publishStory(this.model);
	},

	/**
	 Opens a modal dialog for editing the story's stylesheet, e.g. #stylesheetModal.
	 This sets .stylesheetSource's value to the current stylesheet.

	 @method editStylesheet
	**/

	editStylesheet: function()
	{
		this.$('#stylesheetModal .stylesheetSource').val(this.model.get('stylesheet'));
		this.$('.storyProperties').popover('hide');
		this.$('#stylesheetModal').modal(
		{
			keyboard: false,
			backdrop: 'static'
		});
	},

	/**
	 Saves changes to the story's stylesheet based on the contents of .stylesheetSource
	 and hides .stylesheetModal.

	 @method setStylesheet
	 @param {String} src Source code for the stylesheet.
	**/

	setStylesheet: function (src)
	{
		this.model.save({ stylesheet: src });
		this.$('#stylesheetModal').modal('hide');	
	},

	/**
	 Opens a modal dialog for editing the story's stylesheet, e.g. #scriptModal.
	 This sets .scriptSource's value to the current stylesheet.

	 @method editScript
	**/

	editScript: function()
	{
		this.$('.scriptSource').val(this.model.get('script'));
		this.$('.storyProperties').popover('hide');
		this.$('#scriptModal').modal({
			keyboard: false,
			backdrop: 'static'
		});	
	},

	/**
	 Saves changes to the story's script based on the contents of .scriptSource
	 and hides #scriptModal.

	 @method setScript
	 @param {String} src Source code for the script.
	**/

	setScript: function (src)
	{
		this.model.save({ script: src });
		this.$('#scriptModal').modal('hide');	
	},

	/**
	 Projects a point from the endpoint of a line at a certain angle and distance.
	 
	 @method endPointProjectedFrom
	 @param {Array} line An array of two points, each an object with x and y properties
	 @param {Number} angle Angle in radians to project from the endpoints
	 @param {Number} distance Distance the projected line should have
	**/

    endPointProjectedFrom: function (line, angle, distance)
    {
        var length = Math.sqrt(Math.pow(line[1].x - line[0].x, 2) +
                               Math.pow(line[1].y - line[0].y, 2));

        if (length == 0)
			return line[1];

        // taken from http://mathforum.org/library/drmath/view/54146.html

        var lengthRatio = distance / length;

        var x = line[1].x - ((line[1].x - line[0].x) * Math.cos(angle) -
                             (line[1].y - line[0].y) * Math.sin(angle)) * lengthRatio;
        var y = line[1].y - ((line[1].y - line[0].y) * Math.cos(angle) +
                             (line[1].x - line[0].x) * Math.sin(angle)) * lengthRatio;

        return {x: x, y: y};
    },

	/**
	 Draws arrows between passages to indicate links, using the <canvas> element of this view.

	 @method drawLinks
	**/

	drawLinks: function()
	{
		// canvas properties

		var canvas = this.$('canvas')[0];
		var gc = canvas.getContext('2d');

		// dimensions of a passage

		var width = this.$('.passage:first .frame').outerWidth();
		var height = this.$('.passage:first .frame').outerHeight();

		// configuration of arrowheads
		
		var drawArrows = (this.model.get('zoom') > 0.25);
        var arrowSize = Math.max(width / 8);
		var arrowAngle = Math.PI / 6;

		canvas.width = canvas.width;
		gc.strokeStyle = '#7088ac';
		gc.fillStyle = '#7088ac';
		gc.lineWidth = 2;

		for (var name in this.drawCache)
		{
			if (! this.drawCache.hasOwnProperty(name))
				continue;

			var p = this.drawCache[name];

			for (var i = 0; i < p.links.length; i++)
			{
				if (! this.drawCache[p.links[i]])
					continue;
				
				var q = this.drawCache[p.links[i]];

				// p is the start passage; q is the destination
				// find the closest sides to connect

				var xDist = q.position.left - p.position.left;
				var yDist = q.position.top - p.position.top;

				if (Math.abs(xDist) > Math.abs(yDist))
				{
					// connect horizontal sides

					if (xDist > 0)
					{
						// right side of p to left side of q

						var line = [{ x: p.position.left + width, y: p.position.top + height / 2 },
									{ x: q.position.left, y: q.position.top + height / 2 }];
					}
					else
					{
						// left side of p to right side of q

						var line = [{x: p.position.left, y: p.position.top + height / 2 },
									{x: q.position.left + width, y: q.position.top + height / 2 }];
					};
				}
				else
				{
					// connect vertical sides

					if (yDist > 0)
					{
						// bottom side of p to top side of q

						var line = [{x: p.position.left + width / 2, y: p.position.top + height },
									{x: q.position.left + width / 2, y: q.position.top }];
					}
					else
					{
						// top side of p to top side of q

						var line = [{ x: p.position.left + width / 2, y: p.position.top },
									{ x: q.position.left + width / 2, y: q.position.top + height }];
					};
				}

				// line is now an array of two points: 0 is the start, 1 is the end

				var arrow;

				if (drawArrows)
					arrow =
					[
						this.endPointProjectedFrom(line, arrowAngle, arrowSize),
						this.endPointProjectedFrom(line, -arrowAngle, arrowSize)
					];

				// draw it

				gc.moveTo(line[0].x, line[0].y);
				gc.lineTo(line[1].x, line[1].y);

				if (drawArrows)
				{
					gc.moveTo(line[1].x, line[1].y);
					gc.lineTo(arrow[0].x, arrow[0].y);
					gc.moveTo(line[1].x, line[1].y);
					gc.lineTo(arrow[1].x, arrow[1].y);
				};

				gc.closePath();
				gc.stroke();
			};
		};
    },

	/**
	 Resizes the view's <canvas> element to match the size of the .passages div,
	 e.g. so that lines can be drawn between passage DOM elements.

	 @method resizeCanvas
	**/

	resizeCanvas: function()
	{
		var width = $(document).width();
		var height = $(document).height();

		this.$('.passages').css(
		{
			width: width,
			height: height
		});

		this.$('canvas').attr(
		{
			width: width,
			height: height
		});

		this.drawLinks();
	},

	/**
	 Nudges a passage so that it does not overlap any other passage in the view.

	 @method positionPassage
	 @param {Passage} passage Passage to nudge.
	**/

	positionPassage: function (passage)
	{
		this.collection.each(function (p)
		{
			if (p.id != passage.id && p.intersects(passage))
			{
				done = false;
				p.displace(passage);
			};
		});
	},

	/**
	 Updates the draw cache for a passage. This must occur whenever a passage's position,
	 name, or body changes. All of these can affect links drawn.

	 Normally, you don't need to call this manually.

	 @method cachePassage
	 @param {Passage} passage Passage to cache.
	**/

    cachePassage: function (passage)
    {
		var pos = this.$('.passages div[data-id="' + passage.id + '"] .frame').offset();

	    // if the passage hasn't been rendered yet, there's nothing to cache yet

	    if (pos)
		    this.drawCache[passage.get('name')] =
		    {
			    position: pos,
			    links: passage.links()
		    };
    },

	events:
	{
		'change .startPassage': function (e)
		{
			this.setStartPassage($(e.target).val());
		},

		'change .storyName': function (e)
		{
			this.setName($(e.target).val());
		},

		'click .addPassage': 'addPassage',
		'click .playStory': 'play',
		'click .proofStory': 'proof',
		'click .publishStory': 'publish',
		'click .editScript': 'editScript',

		'click .saveScript': function (e)
		{
			this.setScript(this.$('.scriptSource').val());
		},

		'click .editStylesheet': 'editStylesheet',

		'click .saveStylesheet': function (e)
		{
			this.setStylesheet(this.$('#stylesheetModal .stylesheetSource').val());
		},

		'change .zoomBig, .zoomMedium, .zoomSmall': function (e)
		{
			var desc = $(e.target).attr('class').replace('zoom', '').toLowerCase();
			this.setZoom(this.ZOOM_MAPPINGS[desc]);
		},

		'drag .passage': function (event)
		{
			// draw links between passages as they are dragged around

			this.cachePassage(this.collection.get($(event.target).closest('.passage').attr('data-id')));
			this.drawLinks();
		}
	},
});
