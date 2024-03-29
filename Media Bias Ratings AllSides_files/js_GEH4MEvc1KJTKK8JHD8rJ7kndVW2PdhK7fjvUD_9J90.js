(function ($) {

/**
 * A progressbar object. Initialized with the given id. Must be inserted into
 * the DOM afterwards through progressBar.element.
 *
 * method is the function which will perform the HTTP request to get the
 * progress bar state. Either "GET" or "POST".
 *
 * e.g. pb = new progressBar('myProgressBar');
 *      some_element.appendChild(pb.element);
 */
Drupal.progressBar = function (id, updateCallback, method, errorCallback) {
  var pb = this;
  this.id = id;
  this.method = method || 'GET';
  this.updateCallback = updateCallback;
  this.errorCallback = errorCallback;

  // The WAI-ARIA setting aria-live="polite" will announce changes after users
  // have completed their current activity and not interrupt the screen reader.
  this.element = $('<div class="progress" aria-live="polite"></div>').attr('id', id);
  this.element.html('<div class="bar"><div class="filled"></div></div>' +
                    '<div class="percentage"></div>' +
                    '<div class="message">&nbsp;</div>');
};

/**
 * Set the percentage and status message for the progressbar.
 */
Drupal.progressBar.prototype.setProgress = function (percentage, message) {
  if (percentage >= 0 && percentage <= 100) {
    $('div.filled', this.element).css('width', percentage + '%');
    $('div.percentage', this.element).html(percentage + '%');
  }
  $('div.message', this.element).html(message);
  if (this.updateCallback) {
    this.updateCallback(percentage, message, this);
  }
};

/**
 * Start monitoring progress via Ajax.
 */
Drupal.progressBar.prototype.startMonitoring = function (uri, delay) {
  this.delay = delay;
  this.uri = uri;
  this.sendPing();
};

/**
 * Stop monitoring progress via Ajax.
 */
Drupal.progressBar.prototype.stopMonitoring = function () {
  clearTimeout(this.timer);
  // This allows monitoring to be stopped from within the callback.
  this.uri = null;
};

/**
 * Request progress data from server.
 */
Drupal.progressBar.prototype.sendPing = function () {
  if (this.timer) {
    clearTimeout(this.timer);
  }
  if (this.uri) {
    var pb = this;
    // When doing a post request, you need non-null data. Otherwise a
    // HTTP 411 or HTTP 406 (with Apache mod_security) error may result.
    $.ajax({
      type: this.method,
      url: this.uri,
      data: '',
      dataType: 'json',
      success: function (progress) {
        // Display errors.
        if (progress.status == 0) {
          pb.displayError(progress.data);
          return;
        }
        // Update display.
        pb.setProgress(progress.percentage, progress.message);
        // Schedule next timer.
        pb.timer = setTimeout(function () { pb.sendPing(); }, pb.delay);
      },
      error: function (xmlhttp) {
        pb.displayError(Drupal.ajaxError(xmlhttp, pb.uri));
      }
    });
  }
};

/**
 * Display errors on the page.
 */
Drupal.progressBar.prototype.displayError = function (string) {
  var error = $('<div class="messages error"></div>').html(string);
  $(this.element).before(error).hide();

  if (this.errorCallback) {
    this.errorCallback(this);
  }
};

})(jQuery);
;
(function ($) {
  Drupal.behaviors.rate = {
    attach: function(context) {
      $('.rate-widget:not(.rate-processed)', context).addClass('rate-processed').each(function () {
        var widget = $(this);
        // as we use drupal_html_id() to generate unique ids
        // we have to truncate the '--<id>'
        var ids = widget.attr('id').split('--');
        ids = ids[0].match(/^rate\-([a-z]+)\-([0-9]+)\-([0-9]+)\-([0-9])$/);
        var data = {
          content_type: ids[1],
          content_id: ids[2],
          widget_id: ids[3],
          widget_mode: ids[4]
        };

        $('a.rate-button', widget).click(function() {
          var token = this.getAttribute('href').match(/rate\=([a-zA-Z0-9\-_]{32,64})/)[1];
          return Drupal.rateVote(widget, data, token);
        });
      });
    }
  };

  Drupal.rateVote = function(widget, data, token) {
    // Invoke JavaScript hook.
    widget.trigger('eventBeforeRate', [data]);

    $(".rate-info", widget).text(Drupal.t('Saving vote...'));

    // Random number to prevent caching, see http://drupal.org/node/1042216#comment-4046618
    var random = Math.floor(Math.random() * 99999);

    var q = (Drupal.settings.rate.basePath.match(/\?/) ? '&' : '?') + 'widget_id=' + data.widget_id + '&content_type=' + data.content_type + '&content_id=' + data.content_id + '&widget_mode=' + data.widget_mode + '&token=' + token + '&destination=' + encodeURIComponent(Drupal.settings.rate.destination) + '&r=' + random;
    if (data.value) {
      q = q + '&value=' + data.value;
    }

    // fetch all widgets with this id as class
    widget = $('.' + widget.attr('id'));

    $.get(Drupal.settings.rate.basePath + q, function(response) {
      if (response.match(/^https?\:\/\/[^\/]+\/(.*)$/)) {
        // We got a redirect.
        document.location = response;
      }
      else {
        // get parent object
        var p = widget.parent();

        // Invoke JavaScript hook.
        widget.trigger('eventAfterRate', [data]);

        widget.before(response);

        // remove widget
        widget.remove();
        widget = undefined;

        Drupal.attachBehaviors(p);
      }
    });

    return false;
  }
})(jQuery);
;
/**
 * Create a degradeable star rating interface out of a simple form structure.
 *
 * Originally based on the Star Rating jQuery plugin by Wil Stuckey:
 * http://sandbox.wilstuckey.com/jquery-ratings/
 */
(function($){ // Create local scope.

Drupal.behaviors.fivestar = {
  attach: function (context) {
    $('div.fivestar-form-item').once('fivestar', function() {
      var $this = $(this);
      var $container = $('<div class="fivestar-widget clearfix"></div>');
      var $select = $('select', $this);

      // Setup the cancel button
      var $cancel = $('option[value="0"]', $this);
      if ($cancel.length) {
        $('<div class="cancel"><a href="#0" title="' + $cancel.text() + '">' + $cancel.text() + '</a></div>')
          .appendTo($container);
      }

      // Setup the rating buttons
      var $options = $('option', $this).not('[value="-"], [value="0"]');
      var index = -1;
      $options.each(function(i, element) {
        var classes = 'star-' + (i+1);
        classes += (i + 1) % 2 == 0 ? ' even' : ' odd';
        classes += i == 0 ? ' star-first' : '';
        classes += i + 1 == $options.length ? ' star-last' : '';
        $('<div class="star"><a href="#' + element.value + '" title="' + element.text + '">' + element.text + '</a></div>')
          .addClass(classes)
          .appendTo($container);
        if (element.value == $select.val()) {
          index = i + 1;
        }
      });

      $container.find('.star-' + index).addClass('on');
      $container.addClass('fivestar-widget-' + ($options.length));
      $container.find('a')
        .bind('click', $this, Drupal.behaviors.fivestar.rate)
        .bind('mouseover', $this, Drupal.behaviors.fivestar.hover);

      $container.bind('mouseover mouseout', $this, Drupal.behaviors.fivestar.hover);

      // Attach the new widget and hide the existing widget.
      $select.after($container).css('display', 'none');
    });
  },
  rate: function(event) {
    var $this = $(this);
    var $widget = event.data;
    var value = this.hash.replace('#', '');
    $('select', $widget).val(value).change();
    var $this_star = $this.closest('.star');
    
    $this_star.siblings().removeClass('on');
    $this_star.addClass('on');
    event.preventDefault();
  },
  hover: function(event) {
    var $this = $(this);
    var $widget = event.data;
    var $target = $(event.target);
    var $stars = $('.star', $this);

    if (event.type == 'mouseover') {
      var index = $stars.index($target.parent());
      $stars.each(function(i, element) {
        if (i == index) {
          $(element).addClass('hover');
        } else {
          $(element).removeClass('hover');
        }
      });
    } else {
      $stars.removeClass('hover');
    }
  }
};

})(jQuery);
;
/**
 * Create a degradeable star rating interface out of a simple form structure.
 */
(function($){ // Create local scope.

Drupal.ajax.prototype.commands.fivestarUpdate = function (ajax, response, status) { 
  response.selector = $('.fivestar-form-item', ajax.element.form);
  ajax.commands.insert(ajax, response, status);
};

})(jQuery);
;
/*
 * jQuery.autopager v1.0.0
 *
 * Copyright (c) lagos
 * Dual licensed under the MIT and GPL licenses.
 */
(function($) {
	var window = this, options = {},
		content, currentUrl, nextUrl,
		active = false,
		defaults = {
			autoLoad: true,
			page: 1,
			content: '.content',
			link: 'a[rel=next]',
			insertBefore: null, 
			appendTo: null, 
			start: function() {},
			load: function() {},
			disabled: false
		};

	$.autopager = function(_options) {
		var autopager = this.autopager;

		if (typeof _options === 'string' && $.isFunction(autopager[_options])) {
			var args = Array.prototype.slice.call(arguments, 1),
				value = autopager[_options].apply(autopager, args);

			return value === autopager || value === undefined ? this : value;
		}

		_options = $.extend({}, defaults, _options);
		autopager.option(_options);

		content = $(_options.content).filter(':last');
		if (content.length) {
			if (!_options.insertBefore && !_options.appendTo) {
				var insertBefore = content.next();
				if (insertBefore.length) {
					set('insertBefore', insertBefore);
				} else {
					set('appendTo', content.parent());
				}
			}
		}

		setUrl();

		return this;
	};

	$.extend($.autopager, {
		option: function(key, value) {
			var _options = key;

			if (typeof key === "string") {
				if (value === undefined) {
					return options[key];
				}
				_options = {};
				_options[key] = value;
			}

			$.each(_options, function(key, value) {
				set(key, value);
			});
			return this;
		},

		enable: function() {
			set('disabled', false);
			return this;
		},

		disable: function() {
			set('disabled', true);
			return this;
		},

		destroy: function() {
			this.autoLoad(false);
			options = {};
			content = currentUrl = nextUrl = undefined;
			return this;
		},

		autoLoad: function(value) {
			return this.option('autoLoad', value);
		},

		load: function() {
			if (active || !nextUrl || options.disabled) {
				return;
			}

			active = true;
			options.start(currentHash(), nextHash());
			$.get(nextUrl, insertContent);
			return this;
		}

	});

	function set(key, value) {
		switch (key) {
			case 'autoLoad':
				if (value && !options.autoLoad) {
					$(window).scroll(loadOnScroll);
				} else if (!value && options.autoLoad) {
					$(window).unbind('scroll', loadOnScroll);
				}
				break;
			case 'insertBefore':
				if (value) {
					options.appendTo = null;
				}
				break
			case 'appendTo':
				if (value) {
					options.insertBefore = null;
				}
				break
		}
		options[key] = value;
	}

	function setUrl(context) {
		currentUrl = nextUrl || window.location.href;
		nextUrl = $(options.link, context).attr('href');
	}

	function loadOnScroll() {
		if (content.offset().top + content.height() < $(document).scrollTop() + $(window).height()) {
			$.autopager.load();
		}
	}

	function insertContent(res) {
		var _options = options,
			nextPage = $('<div/>').append(res.replace(/<script(.|\s)*?\/script>/g, "")),
			nextContent = nextPage.find(_options.content); 

		set('page', _options.page + 1);
		setUrl(nextPage);
		if (nextContent.length) {
			if (_options.insertBefore) {
				nextContent.insertBefore(_options.insertBefore);
			} else {
				nextContent.appendTo(_options.appendTo);
			}
			_options.load.call(nextContent.get(), currentHash(), nextHash());
			content = nextContent.filter(':last');
		}
		active = false;
	}

	function currentHash() {
		return {
			page: options.page,
			url: currentUrl
		};
	}

	function nextHash() {
		return {
			page: options.page + 1,
			url: nextUrl
		};
	}
})(jQuery);
;
// $Id:

(function ($) {
var views_infinite_scroll_was_initialised = false;
Drupal.behaviors.views_infinite_scroll = {
  attach:function() {
    // Make sure that autopager plugin is loaded
    if($.autopager) {
      if(!views_infinite_scroll_was_initialised) {
        views_infinite_scroll_was_initialised = true;
        // There should not be multiple Infinite Scroll Views on the same page
        if(Drupal.settings.views_infinite_scroll.length == 1) { 
          var settings = Drupal.settings.views_infinite_scroll[0];
          var use_ajax = false;
          // Make sure that views ajax is disabled
          if(Drupal.settings.views && Drupal.settings.views.ajaxViews) {
            $.each(Drupal.settings.views.ajaxViews, function(key, value) {
              if((value.view_name == settings.view_name) && (value.view_display_id == settings.display)) {
                use_ajax = true;
              }
            });
          }
          if(!use_ajax) {
            var view_selector    = 'div.view-id-' + settings.view_name + '.view-display-id-' + settings.display;
            var content_selector = view_selector + ' > ' + settings.content_selector;
            var items_selector   = content_selector + ' ' + settings.items_selector;
            var pager_selector   = view_selector + ' > div.item-list ' + settings.pager_selector;
            var next_selector    = view_selector + ' ' + settings.next_selector;
            var img_location     = view_selector + ' > div.view-content';
            var img_path         = settings.img_path;
            var img              = '<div id="views_infinite_scroll-ajax-loader"><img src="' + img_path + '" alt="loading..."/></div>';
            $(pager_selector).hide();
            var handle = $.autopager({
              appendTo: content_selector,
              content: items_selector,
              link: next_selector,
              page: 0,
              start: function() {
                $(img_location).after(img);
              },
              load: function() {
                $('div#views_infinite_scroll-ajax-loader').remove();
                Drupal.attachBehaviors(this);
              }
            });

            // Trigger autoload if content height is less than doc height already
            var prev_content_height = $(content_selector).height();
            do {
              var last = $(items_selector).filter(':last');
              if(last.offset().top + last.height() < $(document).scrollTop() + $(window).height()) {
                last = $(items_selector).filter(':last');
                handle.autopager('load');
              }
              else {
                break;
              }
            }
            while ($(content_selector).height() > prev_content_height);

          }
          else {  
            alert(Drupal.t('Views infinite scroll pager is not compatible with Ajax Views. Please disable "Use Ajax" option.'));
          }
        }
        else if(Drupal.settings.views_infinite_scroll.length > 1) {
          alert(Drupal.t('Views Infinite Scroll module can\'t handle more than one infinite view in the same page.'));
        }
      }
    }
    else {
      alert(Drupal.t('Autopager jquery plugin in not loaded.'));
    }
  }
}

})(jQuery);
;
/**
 * @file better_exposed_filters.js
 *
 * Provides some client-side functionality for the Better Exposed Filters module
 */
(function ($) {
  Drupal.behaviors.betterExposedFilters = {
    attach: function(context) {
      // Add highlight class to checked checkboxes for better theming
      $('.bef-tree input[type=checkbox], .bef-checkboxes input[type=checkbox]')
        // Highlight newly selected checkboxes
        .change(function() {
          _bef_highlight(this, context);
        })
        .filter(':checked').closest('.form-item', context).addClass('highlight')
      ;
    }
  };

  Drupal.behaviors.betterExposedFiltersSelectAllNone = {
    attach: function(context) {

      /*
       * Add Select all/none links to specified checkboxes
       */
      var selected = $('.form-checkboxes.bef-select-all-none:not(.bef-processed)');
      if (selected.length) {
        var selAll = Drupal.t('Select All');
        var selNone = Drupal.t('Select None');

        // Set up a prototype link and event handlers
        var link = $('<a class="bef-toggle" href="#">'+ selAll +'</a>')
        link.click(function(event) {
          // Don't actually follow the link...
          event.preventDefault();
          event.stopPropagation();

          if (selAll == $(this).text()) {
            // Select all the checkboxes
            $(this)
              .html(selNone)
              .siblings('.bef-checkboxes, .bef-tree')
                .find('.form-item input:checkbox').each(function() {
                  $(this).attr('checked', true);
                  _bef_highlight(this, context);
                })
              .end()

              // attr() doesn't trigger a change event, so we do it ourselves. But just on
              // one checkbox otherwise we have many spinning cursors
              .find('input[type=checkbox]:first').change()
            ;
          }
          else {
            // Unselect all the checkboxes
            $(this)
              .html(selAll)
              .siblings('.bef-checkboxes, .bef-tree')
                .find('.form-item input:checkbox').each(function() {
                  $(this).attr('checked', false);
                  _bef_highlight(this, context);
                })
              .end()

              // attr() doesn't trigger a change event, so we do it ourselves. But just on
              // one checkbox otherwise we have many spinning cursors
              .find('input[type=checkbox]:first').change()
            ;
          }
        });

        // Add link to the page for each set of checkboxes.
        selected
          .addClass('bef-processed')
          .each(function(index) {
            // Clone the link prototype and insert into the DOM
            var newLink = link.clone(true);

            newLink.insertBefore($('.bef-checkboxes, .bef-tree', this));

            // If all checkboxes are already checked by default then switch to Select None
            if ($('input:checkbox:checked', this).length == $('input:checkbox', this).length) {
              newLink.click();
            }
          })
        ;
      }

      // Check for and initialize datepickers
      var befSettings = Drupal.settings.better_exposed_filters;
      if (befSettings && befSettings.datepicker && befSettings.datepicker_options && $.fn.datepicker) {
        var opt = [];
        $.each(befSettings.datepicker_options, function(key, val) {
          if (key && val) {
            opt[key] = JSON.parse(val);
          }
        });
        $('.bef-datepicker').datepicker(opt);
      }

    }                   // attach: function() {
  };                    // Drupal.behaviors.better_exposed_filters = {

  Drupal.behaviors.betterExposedFiltersAllNoneNested = {
    attach:function (context, settings) {
      $('.form-checkboxes.bef-select-all-none-nested li').has('ul').once('bef-all-none-nested', function () {
        $(this)
          // To respect term depth, check/uncheck child term checkboxes.
          .find('input.form-checkboxes:first')
          .click(function() {
            var checkedParent = $(this).attr('checked');
            if (!checkedParent) {
              // Uncheck all children if parent is unchecked.
              $(this).parents('li:first').find('ul input.form-checkboxes').removeAttr('checked');
            }
            else {
              // Check all children if parent is checked.
              $(this).parents('li:first').find('ul input.form-checkboxes').attr('checked', $(this).attr('checked'));
            }
          })
          .end()
          // When a child term is checked or unchecked, set the parent term's
          // status.
          .find('ul input.form-checkboxes')
          .click(function() {
            var checked = $(this).attr('checked');

            // Determine the number of unchecked sibling checkboxes.
            var ct = $(this).parents('ul:first').find('input.form-checkboxes:not(:checked)').size();

            // If the child term is unchecked, uncheck the parent.
            if (!checked) {
              // Uncheck parent if any of the childres is unchecked.
              $(this).parents('li:first').parents('li:first').find('input.form-checkboxes:first').removeAttr('checked');
            }

            // If all sibling terms are checked, check the parent.
            if (!ct) {
              // Check the parent if all the children are checked.
              $(this).parents('li:first').parents('li:first').find('input.form-checkboxes:first').attr('checked', checked);
            }
          });
      });
    }
  };

  Drupal.behaviors.better_exposed_filters_slider = {
    attach: function(context, settings) {
      var befSettings = settings.better_exposed_filters;
      if (befSettings && befSettings.slider && befSettings.slider_options) {
        $.each(befSettings.slider_options, function(i, sliderOptions) {
          var containing_parent = "#" + sliderOptions.viewId + " #edit-" + sliderOptions.id + "-wrapper .views-widget";
          var $filter = $(containing_parent);

          // If the filter is placed in a secondary fieldset, we may not have
          // the usual wrapper element.
          if (!$filter.length) {
            containing_parent = "#" + sliderOptions.viewId + " .bef-slider-wrapper";
            $filter = $(containing_parent);
          }

          // Only make one slider per filter.
          $filter.once('slider-filter', function() {
            var $input = $(this).find('input[type=text]');

            // This is a "between" or "not between" filter with two values.
            if ($input.length == 2) {
              var $min = $input.parent().find('input#edit-' + sliderOptions.id + '-min'),
                  $max = $input.parent().find('input#edit-' + sliderOptions.id + '-max'),
                  default_min,
                  default_max;

              if (!$min.length || !$max.length) {
                return;
              }

              // Get the default values.
              // We use slider min & max if there are no defaults.
              default_min = parseFloat(($min.val() == '') ? sliderOptions.min : $min.val(), 10);
              default_max = parseFloat(($max.val() == '') ? sliderOptions.max : $max.val(), 10);
              // Set the element value in case we are using the slider min & max.
              $min.val(default_min);
              $max.val(default_max);

              $min.parents(containing_parent).after(
                $('<div class="bef-slider"></div>').slider({
                  range: true,
                  min: parseFloat(sliderOptions.min, 10),
                  max: parseFloat(sliderOptions.max, 10),
                  step: parseFloat(sliderOptions.step, 10),
                  animate: sliderOptions.animate ? sliderOptions.animate : false,
                  orientation: sliderOptions.orientation,
                  values: [default_min, default_max],
                  // Update the textfields as the sliders are moved
                  slide: function (event, ui) {
                    $min.val(ui.values[0]);
                    $max.val(ui.values[1]);
                  },
                  // This fires when the value is set programmatically or the
                  // stop event fires.
                  // This takes care of the case that a user enters a value
                  // into the text field that is not a valid step of the slider.
                  // In that case the slider will go to the nearest step and
                  // this change event will update the text area.
                  change: function (event, ui) {
                    $min.val(ui.values[0]);
                    $max.val(ui.values[1]);
                  },
                  // Attach stop listeners.
                  stop: function(event, ui) {
                    // Click the auto submit button.
                    $(this).parents('form').find('.ctools-auto-submit-click').click();
                  }
                })
              );

              // Update the slider when the fields are updated.
              $min.blur(function() {
                befUpdateSlider($(this), 0, sliderOptions);
              });
              $max.blur(function() {
                befUpdateSlider($(this), 1, sliderOptions);
              });
            }
            // This is single value filter.
            else if ($input.length == 1) {
              if ($input.attr('id') != 'edit-' + sliderOptions.id) {
                return;
              }

              // Get the default value. We use slider min if there is no default.
              var default_value = parseFloat(($input.val() == '') ? sliderOptions.min : $input.val(), 10);
              // Set the element value in case we are using the slider min.
              $input.val(default_value);

              $input.parents(containing_parent).after(
                $('<div class="bef-slider"></div>').slider({
                  min: parseFloat(sliderOptions.min, 10),
                  max: parseFloat(sliderOptions.max, 10),
                  step: parseFloat(sliderOptions.step, 10),
                  animate: sliderOptions.animate ? sliderOptions.animate : false,
                  orientation: sliderOptions.orientation,
                  value: default_value,
                  // Update the textfields as the sliders are moved.
                  slide: function (event, ui) {
                    $input.val(ui.value);
                  },
                  // This fires when the value is set programmatically or the
                  // stop event fires.
                  // This takes care of the case that a user enters a value
                  // into the text field that is not a valid step of the slider.
                  // In that case the slider will go to the nearest step and
                  // this change event will update the text area.
                  change: function (event, ui) {
                    $input.val(ui.value);
                  },
                  // Attach stop listeners.
                  stop: function(event, ui) {
                    // Click the auto submit button.
                    $(this).parents('form').find('.ctools-auto-submit-click').click();
                  }
                })
              );

              // Update the slider when the field is updated.
              $input.blur(function() {
                befUpdateSlider($(this), null, sliderOptions);
              });
            }
            else {
              return;
            }
          })
        });
      }
    }
  };

  // This is only needed to provide ajax functionality
  Drupal.behaviors.better_exposed_filters_select_as_links = {
    attach: function(context, settings) {

      $('.bef-select-as-links', context).once(function() {
        var $element = $(this);

        // Check if ajax submission is enabled. If it's not enabled then we
        // don't need to attach our custom submission handling, because the
        // links are already properly built.

        // First check if any ajax views are contained in the current page.
        if (typeof settings.views == 'undefined' || typeof settings.views.ajaxViews == 'undefined') {
          return;
        }

        // Now check that the view for which the current filter block is used,
        // is part of the configured ajax views.
        var $uses_ajax = false;
        $.each(settings.views.ajaxViews, function(i, item) {
          var $view_name = item.view_name.replace(/_/g, '-');
          var $view_display_id = item.view_display_id.replace(/_/g, '-');
          var $id = 'views-exposed-form-' + $view_name + '-' + $view_display_id;
          var $form_id = $element.parents('form').attr('id');
          if ($form_id == $id) {
            $uses_ajax = true;
            return;
          }
        });

        // If no ajax is used for form submission, we quit here.
        if (!$uses_ajax) {
          return;
        }

        // Attach selection toggle and form submit on click to each link.
        $(this).find('a').click(function(event) {
          var $wrapper = $(this).parents('.bef-select-as-links');
          var $options = $wrapper.find('select option');
          // We have to prevent the page load triggered by the links.
          event.preventDefault();
          event.stopPropagation();
          // Un select if previously seleted toogle is selected.
          var link_text = $(this).text();
          removed = '';
          $($options).each(function(i) {
            if ($(this).attr('selected')) {
              if (link_text == $(this).text()) {
                removed = $(this).text();
                $(this).removeAttr('selected');
              }
            }
          });

          // Set the corresponding option inside the select element as selected.
          $selected = $options.filter(function() {
            return $(this).text() == link_text && removed != link_text;
          });
          $selected.attr('selected', 'selected');
          $wrapper.find('.bef-new-value').val($selected.val());
          $wrapper.find('.bef-new-value[value=""]').attr("disabled", "disabled");
          $(this).addClass('active');
          // Submit the form.
          $wrapper.parents('form').find('.views-submit-button *[type=submit]').click();
        });

        $('.bef-select-as-link').ready(function() {
          $('.bef-select-as-link').find('a').removeClass('active');
          $('.bef-new-value').each(function(i, val) {
            id = $(this).parent().find('select').attr('id') + '-' + $(this).val();
            $('#'+id).find('a').addClass('active');
          });
        });
      });
    }
  };

  Drupal.behaviors.betterExposedFiltersRequiredFilter = {
    attach: function(context, settings) {
      // Required checkboxes should re-check all inputs if a user un-checks
      // them all.
      $('.bef-select-as-checkboxes', context).once('bef-required-filter').ajaxComplete(function (e, xhr, s) {
        var $element = $(this);

        if (typeof settings.views == 'undefined' || typeof settings.views.ajaxViews == 'undefined') {
          return;
        }

        // Now check that the view for which the current filter block is used,
        // is part of the configured ajax views.
        var $view_name;
        var $view_display_id;
        var $uses_ajax = false;
        $.each(settings.views.ajaxViews, function(i, item) {
          $view_name = item.view_name;
          $view_display_id = item.view_display_id;
          var $id = 'views-exposed-form-' + $view_name.replace(/_/g, '-') + '-' + $view_display_id.replace(/_/g, '-');
          var $form_id = $element.parents('form').attr('id');
          if ($form_id == $id) {
            $uses_ajax = true;
            return false;
          }
        });

        //Check if we have any filters at all because of Views Selective Filter
        if($('input', this).length > 0) {
          var $filter_name = $('input', this).attr('name').slice(0, -2);
          if (Drupal.settings.better_exposed_filters.views[$view_name].displays[$view_display_id].filters[$filter_name].required && $('input:checked', this).length == 0) {
            $('input', this).prop('checked', true);
          }
        }
      });
    }
  }

  /*
   * Helper functions
   */

  /**
   * Adds/Removes the highlight class from the form-item div as appropriate
   */
  function _bef_highlight(elem, context) {
    $elem = $(elem, context);
    $elem.attr('checked')
      ? $elem.closest('.form-item', context).addClass('highlight')
      : $elem.closest('.form-item', context).removeClass('highlight');
  }

  /**
   * Update a slider when a related input element is changed.
   *
   * We don't need to check whether the new value is valid based on slider min,
   * max, and step because the slider will do that automatically and then we
   * update the textfield on the slider's change event.
   *
   * We still have to make sure that the min & max values of a range slider
   * don't pass each other though, however once this jQuery UI bug is fixed we
   * won't have to. - http://bugs.jqueryui.com/ticket/3762
   *
   * @param $el
   *   A jQuery object of the updated element.
   * @param valIndex
   *   The index of the value for a range slider or null for a non-range slider.
   * @param sliderOptions
   *   The options for the current slider.
   */
  function befUpdateSlider($el, valIndex, sliderOptions) {
    var val = parseFloat($el.val(), 10),
        currentMin = $el.parents('div.views-widget').next('.bef-slider').slider('values', 0),
        currentMax = $el.parents('div.views-widget').next('.bef-slider').slider('values', 1);
    // If we have a range slider.
    if (valIndex != null) {
      // Make sure the min is not more than the current max value.
      if (valIndex == 0 && val > currentMax) {
        val = currentMax;
      }
      // Make sure the max is not more than the current max value.
      if (valIndex == 1 && val < currentMin) {
        val = currentMin;
      }
      // If the number is invalid, go back to the last value.
      if (isNaN(val)) {
        val = $el.parents('div.views-widget').next('.bef-slider').slider('values', valIndex);
      }
    }
    else {
      // If the number is invalid, go back to the last value.
      if (isNaN(val)) {
        val = $el.parents('div.views-widget').next('.bef-slider').slider('value');
      }
    }
    // Make sure we are a number again.
    val = parseFloat(val, 10);
    // Set the slider to the new value.
    // The slider's change event will then update the textfield again so that
    // they both have the same value.
    if (valIndex != null) {
      $el.parents('div.views-widget').next('.bef-slider').slider('values', valIndex, val);
    }
    else {
      $el.parents('div.views-widget').next('.bef-slider').slider('value', val);
    }
  }

}) (jQuery);
;
(function($){
/**
 * To make a form auto submit, all you have to do is 3 things:
 *
 * ctools_add_js('auto-submit');
 *
 * On gadgets you want to auto-submit when changed, add the ctools-auto-submit
 * class. With FAPI, add:
 * @code
 *  '#attributes' => array('class' => array('ctools-auto-submit')),
 * @endcode
 *
 * If you want to have auto-submit for every form element,
 * add the ctools-auto-submit-full-form to the form. With FAPI, add:
 * @code
 *   '#attributes' => array('class' => array('ctools-auto-submit-full-form')),
 * @endcode
 *
 * If you want to exclude a field from the ctool-auto-submit-full-form auto submission,
 * add the class ctools-auto-submit-exclude to the form element. With FAPI, add:
 * @code
 *   '#attributes' => array('class' => array('ctools-auto-submit-exclude')),
 * @endcode
 *
 * Finally, you have to identify which button you want clicked for autosubmit.
 * The behavior of this button will be honored if it's ajaxy or not:
 * @code
 *  '#attributes' => array('class' => array('ctools-use-ajax', 'ctools-auto-submit-click')),
 * @endcode
 *
 * Currently only 'select', 'radio', 'checkbox' and 'textfield' types are supported. We probably
 * could use additional support for HTML5 input types.
 */

Drupal.behaviors.CToolsAutoSubmit = {
  attach: function(context) {
    // 'this' references the form element
    function triggerSubmit (e) {
      if ($.contains(document.body, this)) {
        var $this = $(this);
        if (!$this.hasClass('ctools-ajaxing')) {
          $this.find('.ctools-auto-submit-click').click();
        }
      }
    }

    // the change event bubbles so we only need to bind it to the outer form
    $('form.ctools-auto-submit-full-form', context)
      .add('.ctools-auto-submit', context)
      .filter('form, select, input:not(:text, :submit)')
      .once('ctools-auto-submit')
      .change(function (e) {
        // don't trigger on text change for full-form
        if ($(e.target).is(':not(:text, :submit, .ctools-auto-submit-exclude)')) {
          triggerSubmit.call(e.target.form);
        }
      });

    // e.keyCode: key
    var discardKeyCode = [
      16, // shift
      17, // ctrl
      18, // alt
      20, // caps lock
      33, // page up
      34, // page down
      35, // end
      36, // home
      37, // left arrow
      38, // up arrow
      39, // right arrow
      40, // down arrow
       9, // tab
      13, // enter
      27  // esc
    ];
    // Don't wait for change event on textfields
    $('.ctools-auto-submit-full-form input:text, input:text.ctools-auto-submit', context)
      .filter(':not(.ctools-auto-submit-exclude)')
      .once('ctools-auto-submit', function () {
        // each textinput element has his own timeout
        var timeoutID = 0;
        $(this)
          .bind('keydown keyup', function (e) {
            if ($.inArray(e.keyCode, discardKeyCode) === -1) {
              timeoutID && clearTimeout(timeoutID);
            }
          })
          .keyup(function(e) {
            if ($.inArray(e.keyCode, discardKeyCode) === -1) {
              timeoutID = setTimeout($.proxy(triggerSubmit, this.form), 500);
            }
          })
          .bind('change', function (e) {
            if ($.inArray(e.keyCode, discardKeyCode) === -1) {
              timeoutID = setTimeout($.proxy(triggerSubmit, this.form), 500);
            }
          });
      });
  }
}
})(jQuery);
;
(function ($) {

	

  Drupal.behaviors.exampleModule = {
    attach: function (context, settings) {
    	// Hide broken images 
    	 
    	   // $("img").each(function(){ 
    	   //    var image = $(this); 
    	   //    if(image.context.naturalWidth == 0 || image.readyState == 'uninitialized'){  
    	   //       $(image).unbind("error").remove();
    	   //    } 
    	   // }); 






         


$(".page-bias-bias-ratings #edit-title").keyup(function(e) {
var code = e.keyCode ? e.keyCode : e.which;
if (code == 13) {
var getUrl = window.location;
var baseUrl = getUrl .protocol + "//" + getUrl.host;
var search_value1 = $("#edit-title").val();
var search_value = search_value1.trim();
window.location.href = baseUrl+'/media-bias/media-bias-ratings?field_featured_bias_rating_value=All&field_news_source_type_tid[1]=1&field_news_source_type_tid[2]=2&field_news_source_type_tid[3]=3&field_news_source_type_tid[4]=4&field_news_bias_nid_1[1]=1&field_news_bias_nid_1[2]=2&field_news_bias_nid_1[3]=3&title='+search_value;
     
   }
});
$('.page-bias-bias-ratings .views-exposed-widget #edit-id').prop('type', 'button');
$('.page-bias-bias-ratings .views-exposed-widget #edit-id').click(function()
{
var getUrl = window.location;
var baseUrl = getUrl .protocol + "//" + getUrl.host;
var search_value1 = $("#edit-title").val();
var search_value = search_value1.trim();

window.location.href = baseUrl+'/media-bias/media-bias-ratings?field_featured_bias_rating_value=All&field_news_source_type_tid[1]=1&field_news_source_type_tid[2]=2&field_news_source_type_tid[3]=3&field_news_source_type_tid[4]=4&field_news_bias_nid_1[1]=1&field_news_bias_nid_1[2]=2&field_news_bias_nid_1[3]=3&title='+search_value;
//window.open(baseUrl'media-bias-ratings?field_featured_bias_rating_value=All&field_news_source_type_tid[1]=1&field_news_source_type_tid[2]=2&field_news_source_type_tid[3]=3&title='+search_value+'#ratings');
});


$(".source-search-box input[type='text']").on('keyup', function() {
  $len = $(this).val().length;
  if($len >= 1)
  {
$('.source-search-box .close-txt').css('display','block');
  }
  else
  {
  	$('.source-search-box .close-txt').css('display','none');
  }

});

$('.close-txt').click(function()
{
$(this).hide();
$(".source-search-box input[type='text']").val('');
$(".source-search-box input[type='text']").focus();

});

$(".source-search-box input[type='text']").keyup(function(e) {
var code = e.keyCode ? e.keyCode : e.which;
if (code == 13) {
var getUrl = window.location;
var baseUrl = getUrl .protocol + "//" + getUrl.host;
var search_value1 = $(".source-search-box input[type='text']").val();
var search_value = search_value1.trim();
window.location.href = baseUrl+'/media-bias/media-bias-ratings?field_featured_bias_rating_value=All&field_news_source_type_tid[1]=1&field_news_source_type_tid[2]=2&field_news_source_type_tid[3]=3&field_news_source_type_tid[4]=4&field_news_bias_nid_1[1]=1&field_news_bias_nid_1[2]=2&field_news_bias_nid_1[3]=3&title='+search_value;
     
   }
});

$('#search-data').click(function()
{
var getUrl = window.location;
var baseUrl = getUrl .protocol + "//" + getUrl.host;
var search_value1 = $(".source-search-box input[type='text']").val();
var search_value = search_value1.trim();

window.location.href = baseUrl+'/media-bias/media-bias-ratings?field_featured_bias_rating_value=All&field_news_source_type_tid[1]=1&field_news_source_type_tid[2]=2&field_news_source_type_tid[3]=3&field_news_source_type_tid[4]=4&field_news_bias_nid_1[1]=1&field_news_bias_nid_1[2]=2&field_news_bias_nid_1[3]=3&title='+search_value;
//window.open(baseUrl'media-bias-ratings?field_featured_bias_rating_value=All&field_news_source_type_tid[1]=1&field_news_source_type_tid[2]=2&field_news_source_type_tid[3]=3&title='+search_value+'#ratings');
});

$('.page-myfrontpage .mypage_story_remove a').attr('alt','Remove from My Front Page');
$('.page-myfrontpage .mypage_story_remove a').attr('title','Remove from My Front Page');
$('.page-user .user-save-article-section .unclip a').attr('alt','Remove Saved Article');
$('.page-user .user-save-article-section .unclip a').attr('title','Remove Saved Article');



$view_content_length = $('.user-save-article-section .view-content').length;

if($view_content_length == 0 )
{
$('.user-save-article-section .view-filters').remove();
}
else
{
	$('.user-save-article-section .view-filters').css('display','block');
}

       function formatNumber(num) {
		  return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
		}

       $argee = jQuery('.news-source-full-area .rate-details .agree').text();
       $disargee = jQuery('.news-source-full-area .rate-details .disagree').text();
       $pagree= parseInt($argee);
       $pdisagree= parseInt($disargee);
       $total = $pagree+$pdisagree;
       $nformat = formatNumber($pagree+$pdisagree);
       jQuery('.total-rating').text($nformat+ ' ratings');
       if($total >= 80)
       {
	       $('#com_feedback').addClass('checked1');
	       $('#com_feedback').removeClass('checked0');
	   }
	   else
	   {
		   $('#com_feedback').removeClass('checked1');
		   $('#com_feedback').addClass('checked0');
	   }
       
   /*Read more read less js code start*/
    var showChar = 120; 
    var ellipsestext = "...";
    var moretext = "<i class='fa fa-caret-down'></i>";
    var lesstext = "<i class='fa fa-caret-up'></i>";
    

    jQuery('.more').each(function() {
        var content = jQuery(this).html();
 
        if(content.length > showChar) {
 
            var c = content.substr(0, showChar);
            var h = content.substr(showChar, content.length - showChar);
 
            var html = c + '<span class="moreellipses">' + ellipsestext+ '</span><span class="morecontent"><span>' + h + '</span>&nbsp;<a href="" class="morelink">' + moretext + '</a></span>';
 
            jQuery(this).html(html);
        }
 
    });
 
    jQuery(".morelink").click(function(){
    	$('.grid-text-height').css('height','auto');
        if(jQuery(this).hasClass("less")) {
            jQuery(this).removeClass("less");
            jQuery(this).html(moretext);
        } else {
            jQuery(this).addClass("less");
            jQuery(this).html(lesstext);
        }
        jQuery(this).parent().prev().toggle();
        jQuery(this).prev().toggle();
        return false;
    });


  $('.seefull').click(function()
    {
    $('.something').hide();
    $('.full-data, .comma').show();

    });

     $('.seeless').click(function()
    {
    $('.something').show();
    $('.full-data, .comma').hide();
    });


$('ul.topic_tabs li>a').click(function()
{
$('#topic_frame').attr('src','');
$('ul.topic_tabs li>a').removeClass('active');
$('#topic_frame').css('display','block');
$(this).addClass('active');
$topic_url = $(this).attr('data-src');
setTimeout(function(){ 
$('#topic_frame').attr('src',$topic_url);
 }, 20);
$('#topic_frame').css('height','720');

})


/*$licount = $('#third_party ul li').length;
for(var i=1; i<=$licount; i++)
{
	var witxt = $('#third_party ul li:nth-child('+i+') a').text();
	if(witxt =='Wikipedia')
	{
     $('#third_party ul li:nth-child('+i+')').remove();
	}
	
}*/

/*Read more read less js code close*/
    	
        jQuery('label.media-bias-head').removeClass('media-bias-head-open');
    	jQuery('label.media-bias-head').once().on('click', function(){ 
			if(jQuery(this).hasClass('media-bias-head-open')){
				jQuery(this).removeClass('media-bias-head-open');
			}else{
				jQuery(this).addClass('media-bias-head-open');
			}
			/*jQuery(this).toggleClass('media-bias-head-open');*/
			jQuery('#edit-field-featured-bias-rating-value-wrapper').toggle();
			jQuery('#edit-field-news-source-type-tid-wrapper').toggle();
			if(jQuery('[id^="edit-field-news-bias-nid-"]').is(':visible')){
				jQuery('[id^="edit-field-news-bias-nid-"]').css('display','none');
			}else{
				jQuery('[id^="edit-field-news-bias-nid-"]').css('display','block');
			}
			//jQuery('[id^="edit-field-news-bias-nid-"]').toggle();
		});
    	
    	 $('.bias-raitings-list > .view-filters .views-exposed-widget#edit-title-wrapper label[for="edit-title"]').once().on('click', function(){
			/*console.log(context); */
			if(!$(this).hasClass('edit-title-open')){
				$(this).addClass('edit-title-open');
			}else{
				$(this).removeClass('edit-title-open');
			}	
			if($('.media-bias-head').hasClass('media-bias-head-open')){
				$('.media-bias-head').removeClass('media-bias-head-open');
			}else{
				$('.media-bias-head').addClass('media-bias-head-open');
			}		
			if($(this).next('.views-widget').is(':visible')){
				$(this).next('.views-widget').css('display','none');
			}else{
				$(this).next('.views-widget').css('display','block');
			}
			if($(this).parent('#edit-title-wrapper').next('.views-submit-button').is(':visible')){
				$(this).parent('#edit-title-wrapper').next('.views-submit-button').css('display','none');
			}else{
				$(this).parent('#edit-title-wrapper').next('.views-submit-button').css('display','block');
			}
			
			if($(this).parent('#edit-title-wrapper').next('.views-submit-button').next('.views-reset-button').is(':visible')){
				$(this).parent('#edit-title-wrapper').next('.views-submit-button').next('.views-reset-button').css('display','none');
			}else{
				$(this).parent('#edit-title-wrapper').next('.views-submit-button').next('.views-reset-button').css('display','block');
			}
		});
		
		var changeStatus = true;
                jQuery(".bias-raitings-list form input.form-radio, .bias-raitings-list form input.form-checkbox").on('click', function(){
                    changeStatus = false;
                });
                   
                
                if(Drupal.ajax != undefined){
                   Drupal.ajax.prototype.beforeSubmit = function (xmlhttprequest, options){ 
                       
                    var contextData = options.context;
                    var tt= $(contextData).map(function(index,dom){return dom.id});
                    //console.log(tt[0]);
                   if(tt[0] != undefined && tt[0] == 'views-exposed-form-allsides-daily-administration-news-sources-page-1'){    
                    jQuery.each(Drupal.views.instances, function(i, view) {
                          if(view.settings.view_name == 'allsides_daily_administration_news_sources'){
                               if(changeStatus === true){
				jQuery('input[type=radio][id=edit-field-featured-bias-rating-value-all]').prop('checked', true);
				jQuery('input[type=checkbox][name^=field_news_source_type_tid]').prop('checked', true);
				jQuery('input[type=checkbox][name^=field_news_bias_nid]').prop('checked', true);
                                
                                var pushBiasArr = {};
                                pushBiasArr.name = 'field_featured_bias_rating_value';
                                pushBiasArr.value = 'All';
                                xmlhttprequest.push(pushBiasArr);
  
                                var pushSourceArr = {};
                                pushSourceArr.name = 'field_news_source_type_tid[1]';
                                pushSourceArr.value = '1';
                                xmlhttprequest.push(pushSourceArr);
                                pushSourceArr = {};
                                pushSourceArr.name = 'field_news_source_type_tid[2]';
                                pushSourceArr.value = '2';
                                xmlhttprequest.push(pushSourceArr);
                                pushSourceArr = {};
                                pushSourceArr.name = 'field_news_source_type_tid[3]';
                                pushSourceArr.value = '3';
                                xmlhttprequest.push(pushSourceArr);
                                pushSourceArr = {};
                                pushSourceArr.name = 'field_news_source_type_tid[4]';
                                pushSourceArr.value = '4';
                                xmlhttprequest.push(pushSourceArr);

                                var pushRatingArr = {};
                                pushRatingArr.name = 'field_news_bias_nid_1[1]';
                                pushRatingArr.value = '1';
                                xmlhttprequest.push(pushRatingArr);
                                pushRatingArr = {};
                                pushRatingArr.name = 'field_news_bias_nid_1[2]';
                                pushRatingArr.value = '2';
                                xmlhttprequest.push(pushRatingArr);
                                pushRatingArr = {};
                                pushRatingArr.name = 'field_news_bias_nid_1[3]';
                                pushRatingArr.value = '3';
                                xmlhttprequest.push(pushRatingArr);
                                                          
                            }
                            jQuery('.bias-raitings-list > small > .item-list > .pager').html('');
                            jQuery('.bias-raitings-list .view-content > table > tbody').html('<tr><td style="width: 100%;padding-top: 30vh;text-align: center;padding-bottom: 30vh;" colspan="4"><img src="/sites/all/themes/allsides/images/ajax-loader-page-gray.gif"></td></tr>');
                            jQuery('.bias-raitings-list .view-content .scrollable > table > tbody').html('<tr><td style="width: 100%;padding-top: 30vh;text-align: center;padding-bottom: 30vh;" colspan="4"><img src="/sites/all/themes/allsides/images/ajax-loader-page-gray.gif"></td></tr>');
                          }
                       });
                     }
                    }
                }
        
        
        
    	// Style submit buttons 

    	$('.form-submit').addClass('btn btn-success');

    	$('.node-blog .form-submit').addClass('btn-small');

		//$('ul.tabs').css('display', 'none');
		$('#edit-submit').addClass('btn');
		$('body.section-rate-own-bias #edit-submit').removeClass('form-submit').addClass('btn-primary');
		
		
		// Add Active Class To Links 
		var activeLink = $('.active-trail, body.page-news a.news-menu-item, body.node-type-news-home a.news-menu-item, body.section-topics a.issues-menu-item, body.section-dictionary a.issues-menu-item, body.section-blog a.topics-dialog-menu-item, body.node-type-about-page a.about-menu-item, body.section-topics  a.issues-menu-item, body.section-schools a.schools-menu-item,   body.page-bias-bias-ratings a.bias-menu-item, body.page-explore-issues a.topics-dialog-menu-item, body.page-dialog a.topics-dialog-menu-item, body.section-blog a.topics-dialog-menu-item, body.section-redbluedictionary a.topics-dialog-menu-item, body.page-about a.about-menu-item, body.page-how-allsides-changes-the-world a.about-menu-item, body.page-node-2905 a.about-menu-item, body.page-get-involved a.about-menu-item, body.page-node-17481 a.about-menu-item, body.page-node-27378 a.about-menu-item, body.page-node-24572 a.about-menu-item, body.section-about-bias a.about-menu-item               ');

		
		activeLink.closest('.nav > li').addClass('active');

		$('.active-trail').parents('.dropdown-issues').addClass('active');

		if (!$('body').hasClass('page-user-edit')) {


			// Edit The Registration input fields
			$('#edit-account input#edit-name').attr({
				 value: 'username',
				 // onFocus: "this.value=''"
				});
				
			/*$('#edit-account input#edit-mail').attr({
				  value: 'your email address',
				  onFocus: "this.value=''"
				});*/	
				
			$('#user-login input#edit-name, #user-login-form input#edit-name').attr({
				  value: 'your username or e-mail address',
				  onFocus: "this.value=''"
				});
				
			$('#user-login input#edit-pass, #user-login-form input#edit-pass').attr({
				  value: 'your password',
				  onFocus: "this.value=''"
				});		
				
			$('#edit-account input, #user-login input, #user-login-form input').blur(function(){
				$(this).css("color", "#333");
				});

			/*$('.password-box input#edit-name').attr({
				  value: 'username or email address',
				  onFocus: "this.value=''"
				});*/

			$('#user-login-form input').focus(function(){
				//$(this).css("background-color", "white");
				$(this).css('color', '#333');
			});	


		}	

		// MailChimp sign up form

		var mailchimpEmail = $('#edit-mailchimp-lists-mailchimp-allsides-free-form-mergevars-email');

		mailchimpEmail.attr({
				value: 'email address',
				onFocus: "this.value=''"	
			});

		mailchimpEmail.focus(function() {
			$(this).css('color', '#333');
		});

		mailchimpEmail.after('<p class="email-not-shared">Your email address will not be shared</p>');
		

		$('#edit-mailchimp-lists-mailchimp-allsides-free-form-mergevars-fname').attr({
				value: 'first name',
				onFocus: "this.value=''"
			});

		$('#edit-mailchimp-lists-mailchimp-allsides-free-form-mergevars-lname').attr({
				value: 'last name',
				onFocus: "this.value=''"
			});

		
		// remove link from username on profile page
		$('.profile-info h1 a').removeAttr("href");
		
		
		// Adds Character count functionality to Title Field
		$('.suggest-issue input#edit-title').addClass('text-area-opinion-title');
		$('.suggest-issue div.form-item-title').before('<div class="counter-container"><div class="counter counter3" id="counter3"></div><div class="char-remaining"> characters remaining</div></div>');
		
		
		// Text-Area character Count	
		$('input[name="title"]').bind('keyup', function() {
		var maxchar = 140;
		var cnt = $(this).val().length;
		var remainingchar = maxchar - cnt;
		var $counter = $('.counter3');
		if(remainingchar < 0){
			$counter.html('0');
			$(this).val($(this).val().slice(0, 140));
		}else{
			$counter.html(remainingchar);
		}
		
		if(remainingchar > 20 ){
            $counter.css('color', 'green');
        }else if(remainingchar > 0 ){
            $counter.css('color', '#ffa200');
		}else{
            $counter.css('color', 'red');
        }
		
		
		//console.log($('input[name="title"]').val().length);
		//var length = $('input[name="title"]').val().html().length();
		//console.log(length);
		//$counter.text(length);
		});

	  // Substitute Page Title text with User name on User profile page
	  titleText = $('title').html().replace("| AllSides", "");
	  $('.profile-info h1').html(titleText);
		
	  // Login / Register Pop-up functionality	
	  if($('body.not-logged-in').length>0 && $('article.citizen').length<1) {
	  	  $("body.not-logged-in li.edit a, ul.action-links-field-collection-add li a ").attr('href', '../user/register');
	  }
	  

      // Insert Already a Citizen? Sign In into user/register page
	  
	  
	  $('body.page-user-register div#edit-actions').before('<p class="very-small">By creating an account, I accept AllSides <a href="/content/terms-use">Terms of Service</a> and <a href="/content/privacy-policy">Privacy Policy</a>.</p>');
	  $('body.page-user-register div#edit-actions').append('<span class="sign-in-option">Already registered? <a href="/user/login">Sign in</a></span>');		
	  
	  // Insert Not a Citizen? Register here into user/register page
	  
	  $('body.page-user-login div#edit-actions').append('<span class="register-option">Not registered? <a href="/user/register">Sign up here</a></span>');	
	  $('body.page-user-login div#edit-actions').append('<div class="register-option-password"><a class="forgot-password" href="/user/password">Forgot Your Password?</a></div>');	
	  
	  // 

	  $('.register-box-register #edit-actions input').val("Sign Up");
	  $('.register-box-log-in #edit-actions input').val("Log In");
	  
	  function redirect() {
            window.location.href = 'http://www.google.com';
        }
		
	  $('form').attr("onsubmit", "setTimeout('redirect()', 1000);");
	  
	 
	  
	  //START Register Modal Customizations
	  
	  $("body.not-logged-in div.item-list a[href^='\/twitter\/redirect']").closest('div').css('display', 'none');
	  
	  $("#block-fb-connect-login-fblogin1").addClass('wrap-buttons');
	  
	  $("#block-twitter-signin-0").addClass('wrap-buttons');
	  $(".wrap-buttons").wrapAll('<div class="row-fluid facebook-twitter-wrapper"></div>');
	  
	   // $(".facebook-twitter-wrapper").after('<div class="row-fluid"><p class="create-account">Or, create an account with</p></div>');
	  
	  $('#login-page p.create-account').html("Or, sign in with");
	  
	  
	   if ($("body").hasClass("node-edit-overlay")) { // Redirect Visitors to Registration 
	  	 $("span.sign-in-option em a").attr("href", "/user/login?render=overlay&destination=/close_overlay");
		 $("span.register-option em a").attr("href", "/user/register?render=overlay&destination=/close_overlay");
		 $('form#user-login').prepend('<input type="hidden" name="overlay-login" />');
		 $('div.facebook-twitter-wrapper').before('<div class="row-fluid"><h2>Become and AllSides Citizen, and collaborate with us.</h2>');
		 
	   };
	   
	  $(".overlay-mask").click(function(){
    	$("a.overlay-close").trigger('click');
  	  });

	  //////////////////////// END Register Modal Customizations //////////////////////////////

		
	 ////////////////////// START AllSides Daily //////////////////////////////////////////////
			
		// Set News Article margins to 0 if there is no image (otherwise it's 100)
		var co =  $('.allsides-daily-row').not(':has(.news-image)').not('.float-box-see-more .allsides-daily-row').each(function() {
			$(this).find("div.news-title, div.news-body").css("margin-left", "0");
		});

		// AllSides-Daily Google News More Link
		//$('#block-aggregator-feed-1 div.more-link a').html('More from Google News').attr('href', 'https://news.google.com');
		
		////////////////////// END AllSides Daily //////////////////////////////////////////////

		////////////////////// START Self-Rating Bias //////////////////////////////////////////
		
		// If the page is Rate Own Bias page
		if ($('body').hasClass('section-rate-own-bias')) {
			//Get the Calculated Values From URL
			var urlParams = {};
			(function () {
			    var match,
			        pl     = /\+/g,  // Regex for replacing addition symbol with a space
			        search = /([^&=]+)=?([^&]*)/g,
			        decode = function (s) { return decodeURIComponent(s.replace(pl, " ")); },
			        query  = window.location.search.substring(1);

			    while (match = search.exec(query))
			       urlParams[decode(match[1])] = decode(match[2]);
			})();

			

			var biasScore = parseInt(urlParams["total"]);
			var i1 = urlParams["i1"];
			var i2 = urlParams["i2"];
			var i3 = urlParams["i3"];
			var i4 = urlParams["i4"];
			var i5 = urlParams["i5"];
			var i6 = urlParams["i6"];
			var i7 = urlParams["i7"];
			var i8 = urlParams["i8"];

			var q1 = urlParams["q1"];
			var q2 = urlParams["q2"];
			var q3 = urlParams["q3"];
			var q4 = urlParams["q4"];
			var q5 = urlParams["q5"];
			var q6 = urlParams["q6"];
			var q7 = urlParams["q7"];
			var q8 = urlParams["q8"];
			

			var showbox = urlParams["showbox"];
			// -> "front"
			
			// Set the attr of select field to value of "i1, i2, i3, etc." in URL
			$("select#edit-submitted-fs1-i1 option[value='" + i1 + "']").attr('selected','selected');
			$("select#edit-submitted-fs2-i2 option[value='" + i2 + "']").attr('selected','selected');
			$("select#edit-submitted-fs3-i3 option[value='" + i3 + "']").attr('selected','selected');
			$("select#edit-submitted-fs4-i4 option[value='" + i4 + "']").attr('selected','selected');
			$("select#edit-submitted-fs5-i5 option[value='" + i5 + "']").attr('selected','selected');
			$("select#edit-submitted-fs6-i6 option[value='" + i6 + "']").attr('selected','selected');
			$("select#edit-submitted-fs7-i7 option[value='" + i7 + "']").attr('selected','selected');
			$("select#edit-submitted-fs8-i8 option[value='" + i8 + "']").attr('selected','selected');

			$("select#edit-submitted-fs1-q1 option[value='" + q1 + "']").attr('selected','selected');
			$("select#edit-submitted-fs2-q2 option[value='" + q2 + "']").attr('selected','selected');
			$("select#edit-submitted-fs3-q3 option[value='" + q3 + "']").attr('selected','selected');
			$("select#edit-submitted-fs4-q4 option[value='" + q4 + "']").attr('selected','selected');
			$("select#edit-submitted-fs5-q5 option[value='" + q5 + "']").attr('selected','selected');
			$("select#edit-submitted-fs6-q6 option[value='" + q6 + "']").attr('selected','selected');
			$("select#edit-submitted-fs7-q7 option[value='" + q7 + "']").attr('selected','selected');
			$("select#edit-submitted-fs8-q8 option[value='" + q8 + "']").attr('selected','selected');

			
			


			//Set the Bias based on the 'total' parmeter value in the URL
			if (biasScore>=80) {
				$('.bias-result-word').html('Left');
				$('a.bias-result-image img').attr('src', 'sites/all/themes/allsides/images/bias-left-circle.png');
				}
			else if (biasScore>=60 && biasScore <=79) {
				$('.bias-result-word').html('Leaning Left');
				$('a.bias-result-image img').attr('src', 'sites/all/themes/allsides/images/bias-leaning-left-circle.png');
				}
			else if (biasScore>=40 && biasScore <=59) {
				$('.bias-result-word').html('Center');
				$('a.bias-result-image img').attr('src', 'sites/all/themes/allsides/images/bias-center-circle.png');
				}
			else if (biasScore>=20 && biasScore <=39) {
				$('.bias-result-word').html('Leaning Right');
				$('a.bias-result-image img').attr('src', 'sites/all/themes/allsides/images/bias-leaning-right-circle.png');
				}
			else if (biasScore>=0 && biasScore <=19) {
				$('.bias-result-word').html('Right');
				$('a.bias-result-image img').attr('src', 'sites/all/themes/allsides/images/bias-right-circle.png');
			
			};

		
			// START Implement AddThis messages
		
			// Attach title announcing your bias to social sharing buttons 
			function addthisReady(evt) {

				//Set the Bias based on the 'total' parmeter value in the URL
				if (biasScore>=80) {
					$('.sharing-buttons a').attr('addthis:title', 'I am Left!');
					}
				else if (biasScore>=60 && biasScore <=79) {
					$('.sharing-buttons a').attr('addthis:title', 'I am Leaning Left!');
					}
				else if (biasScore>=40 && biasScore <=59) {
					$('.sharing-buttons a').attr('addthis:title', 'I am in the Center!');
					}
				else if (biasScore>=20 && biasScore <=39) {
					$('.sharing-buttons a').attr('addthis:title', 'I am Leaning Right!');
					}
				else if (biasScore>=0 && biasScore <=19) {
					$('.sharing-buttons a').attr('addthis:title', 'I am Right!');
				};
			}

			// Listen for the addthis ready event
			addthis.addEventListener('addthis.ready', addthisReady);
			
			// END Implement AddThis messages

		
			// Show or Hide box depending if the Bias form submitted or not
			if(showbox === undefined) {
				$('#block-block-15').hide();
			}
			else {
				$('#block-block-15').show();
			};
		

		
			//Make Slider
			var select1 = $( "#edit-submitted-fs1-q1" );
			var slider1 = $( "<div id='slider1'></div>" ).insertAfter( select1 ).slider({
				min: 1,
				max: 5,
				range: "min",
				value: select1[ 0 ].selectedIndex + 1,
				slide: function( event, ui ) {
					select1[ 0 ].selectedIndex = ui.value - 1;
				}
			});

			var select2 = $( "#edit-submitted-fs2-q2" );
			var slider2 = $( "<div id='slider2'></div>" ).insertAfter( select2 ).slider({
				min: 1,
				max: 5,
				range: "min",
				value: select2[ 0 ].selectedIndex + 1,
				slide: function( event, ui ) {
					select2[ 0 ].selectedIndex = ui.value - 1;
				}
			});

			var select3 = $( "#edit-submitted-fs3-q3" );
			var slider3 = $( "<div id='slider3'></div>" ).insertAfter( select3 ).slider({
				min: 1,
				max: 5,
				range: "min",
				value: select3[ 0 ].selectedIndex + 1,
				slide: function( event, ui ) {
					select3[ 0 ].selectedIndex = ui.value - 1;
				}
			});

			var select4 = $( "#edit-submitted-fs4-q4" );
			var slider4 = $( "<div id='slider4'></div>" ).insertAfter( select4 ).slider({
				min: 1,
				max: 5,
				range: "min",
				value: select4[ 0 ].selectedIndex + 1,
				slide: function( event, ui ) {
					select4[ 0 ].selectedIndex = ui.value - 1;
				}
			});

			var select5 = $( "#edit-submitted-fs5-q5" );
			var slider5 = $( "<div id='slider5'></div>" ).insertAfter( select5 ).slider({
				min: 1,
				max: 5,
				range: "min",
				value: select5[ 0 ].selectedIndex + 1,
				slide: function( event, ui ) {
					select5[ 0 ].selectedIndex = ui.value - 1;
				}
			});

			var select6 = $( "#edit-submitted-fs6-q6" );
			var slider6 = $( "<div id='slider6'></div>" ).insertAfter( select6 ).slider({
				min: 1,
				max: 5,
				range: "min",
				value: select6[ 0 ].selectedIndex + 1,
				slide: function( event, ui ) {
					select6[ 0 ].selectedIndex = ui.value - 1;
				}
			});

			var select7 = $( "#edit-submitted-fs7-q7" );
			var slider7 = $( "<div id='slider7'></div>" ).insertAfter( select7 ).slider({
				min: 1,
				max: 5,
				range: "min",
				value: select7[ 0 ].selectedIndex + 1,
				slide: function( event, ui ) {
					select7[ 0 ].selectedIndex = ui.value - 1;
				}
			});

			var select8 = $( "#edit-submitted-fs8-q8" );
			var slider8 = $( "<div id='slider8'></div>" ).insertAfter( select8 ).slider({
				min: 1,
				max: 5,
				range: "min",
				value: select8[ 0 ].selectedIndex + 1,
				slide: function( event, ui ) {
					select8[ 0 ].selectedIndex = ui.value - 1;
				}
			});


		    /*var select1 = $( "#edit-submitted-fs1-i1" );
			var slider1 = $( "<div id='slider1'></div>" ).insertBefore( select1 ).slider({
				min: 1,
				max: 5,
				range: "min",
				value: select1[ 0 ].selectedIndex + 1,
				slide: function( event, ui ) {
					select1[ 0 ].selectedIndex = ui.value - 1;
				}
			});

			var select2 = $( "#edit-submitted-fs2-i2" );
			var slider2 = $( "<div id='slider2'></div>" ).insertBefore( select2 ).slider({
				min: 1,
				max: 5,
				range: "min",
				value: select2[ 0 ].selectedIndex + 1,
				slide: function( event, ui ) {
					select2[ 0 ].selectedIndex = ui.value - 1;
				}
			});

			var select3 = $( "#edit-submitted-fs3-i3" );
			var slider3 = $( "<div id='slider3'></div>" ).insertBefore( select3 ).slider({
				min: 1,
				max: 5,
				range: "min",
				value: select3[ 0 ].selectedIndex + 1,
				slide: function( event, ui ) {
					select3[ 0 ].selectedIndex = ui.value - 1;
				}
			});

			var select4 = $( "#edit-submitted-fs4-i4" );
			var slider4 = $( "<div id='slider4'></div>" ).insertBefore( select4 ).slider({
				min: 1,
				max: 5,
				range: "min",
				value: select4[ 0 ].selectedIndex + 1,
				slide: function( event, ui ) {
					select4[ 0 ].selectedIndex = ui.value - 1;
				}
			});

			var select5 = $( "#edit-submitted-fs5-i5" );
			var slider5 = $( "<div id='slider5'></div>" ).insertBefore( select5 ).slider({
				min: 1,
				max: 5,
				range: "min",
				value: select5[ 0 ].selectedIndex + 1,
				slide: function( event, ui ) {
					select5[ 0 ].selectedIndex = ui.value - 1;
				}
			});

			var select6 = $( "#edit-submitted-fs6-i6" );
			var slider6 = $( "<div id='slider6'></div>" ).insertBefore( select6 ).slider({
				min: 1,
				max: 5,
				range: "min",
				value: select6[ 0 ].selectedIndex + 1,
				slide: function( event, ui ) {
					select6[ 0 ].selectedIndex = ui.value - 1;
				}
			});

			var select7 = $( "#edit-submitted-fs7-i7" );
			var slider7 = $( "<div id='slider7'></div>" ).insertBefore( select7 ).slider({
				min: 1,
				max: 5,
				range: "min",
				value: select7[ 0 ].selectedIndex + 1,
				slide: function( event, ui ) {
					select7[ 0 ].selectedIndex = ui.value - 1;
				}
			});

			var select8 = $( "#edit-submitted-fs8-i8" );
			var slider8 = $( "<div id='slider8'></div>" ).insertBefore( select8 ).slider({
				min: 1,
				max: 5,
				range: "min",
				value: select8[ 0 ].selectedIndex + 1,
				slide: function( event, ui ) {
					select8[ 0 ].selectedIndex = ui.value - 1;
				}
			});*/



		}; // END if the page is Rate Own Bias page


		


		///////////////////////// START News Page //////////////////////////////

		$('.quicktabs_main').css('position', 'relative');


		if ( $('.feature-thumbs-wrapper').length === 0 ) { // check to see if the wrapper exists (prevents wrapping several time after ajax calls)
			$('.quicktabs-tabpage').each(function(index) {
					$(this).find('.quicktabs-views-group').addClass('feature-thumbs').wrapAll('<div class="feature-thumbs-wrapper"></div>');
				});
		};

		// Color "From the Right" and other Global Bias bars like that one according to the side
		$(".global-bias:contains('From the Right')").addClass('bias-gradient-right');
		$(".global-bias:contains('From the Left')").addClass('bias-gradient-left');
		$(".global-bias:contains('From the Center')").addClass('bias-gradient-center');

		// Hide pixel.gif images on bias-trio blocks and Show or Hide Default Video Icon depending on situation
		$(".bias-trio .news-video-trigger").each(function(event) {
			var pixelImage = $(this).find("img[src*='pixel.gif']");
			if ( pixelImage.length !== 0) {
				$(this).find(".video-icon").remove();	
			}
			else {
				$(this).find(".substitute-video-image").remove();
			};
			pixelImage.remove();	
		});

		$(".bias-trio img[src*='pixel.gif']").css('display', 'none' );


		$(".bias-trio .news-image-toggle").each(function(event) {
			var pixelImage = $(this).find("img[src*='pixel.gif']");
			if ( pixelImage.length !== 0) {
				$(this).remove();	
			}	
		});



		// Change font size to 16px for Top Headline Titles with more than 60 characters
		var headlineTop = $('.quicktabs-wrapper .quicktabs-views-group').not('.quicktabs-wrapper .quicktabs-views-group.feature-thumbs').find('.news-title a');

		headlineTop.each(function(index) {
			var $this = $(this);
    		var headlineTopLength = $this.text().length;
    		if ( headlineTopLength > 60 ) {
				$this.css('font-size', '22px')
			};
			if ( headlineTopLength > 70 ) {
				$this.css('font-size', '20px')
			};
			if ( headlineTopLength > 76 ) {
				$this.css('font-size', '18px')
			};
			if ( headlineTopLength > 90 ) {
				$this.css('font-size', '15px')
			};
		});

		//$('.popover-home').tooltip();

		//$('#views-exposed-form-news-news-date').tooltip();

		$('#views-exposed-form-news-news-date #edit-date-filter-value input').attr('title', 'The Travel in Time feature goes back only three months');

		// Populate AddThis Social Buttons on Story ID page
		var socialSpecs = $('.social-specs');

		$('.view-story-id-list .allsides-daily-topic-container').addClass('row-fluid');


		// Story ID page: wrap Story Id and Dates into .story-list-row-wrapper .span8 classes div
		if ( $('#block-views-story-id-list-block-list .story-list-row-wrapper').length === 0 ) { // check to see if the wrapper exists (prevents wrapping several time after ajax calls)
				$('#block-views-story-id-list-block-list .allsides-daily-topic-container').each(function(index) {
					$(this).find('.story-list-row').wrapAll('<div class="story-list-row-wrapper span8"></div>');
				});
		};

		// Story ID page: Insert "to" after the minimum date box
				
		if ( $('#block-views-story-id-list-block-list .story-list-to').length === 0 ) { // check to see if the wrapper exists (prevents wrapping several time after ajax calls)
				$('#block-views-story-id-list-block-list #edit-field-story-date-value-min-wrapper').after('<div class="story-list-to"><label>to</label></div>');
		
		};

		// Insert "More Stories" into upper right corner of Story Block on homepage and link it to the latest story page
		var storyLink = $('#quicktabs-tabpage-view__news__news_date-0 .quicktabs-views-group:first-child .news-story a').attr('href');
		$('ul.quicktabs-tabs.quicktabs-style-basic').after('<div class="more-stories-new"><a href="">More Stories >></a></div>');
		$('.more-stories-new a').attr('href', 'story-list');


		

		// Feeds
		// From the Left
		//|| $('body').hasClass('node-type-news-home')

		if ($('body').hasClass('page-news') ) {


			$('#feed-huffington-post').rssfeed('http://feeds.huffingtonpost.com/huffingtonpost/LatestNews', {
			   limit: 5,
			   date: false,
			   header: false,
			   linktarget: '_blank',
			   content: false
			 });
			$('#feed-washington-post').rssfeed('http://feeds.washingtonpost.com/rss/politics', {
			   limit: 5,
			   date: false,
			   header: false,
			   linktarget: '_blank',
			   content: false
			 });
			$('#feed-new-york-times').rssfeed('http://www.nytimes.com/services/xml/rss/nyt/HomePage.xml', {
			   limit: 5,
			   date: false,
			   header: false,
			   linktarget: '_blank',
			   content: false
			 });
			$('#feed-politico').rssfeed('http://www.politico.com/rss/politicopicks.xml', {
			   limit: 5,
			   date: false,
			   header: false,
			   linktarget: '_blank',
			   content: false
			 });
			
			// From the Center
			$('#feed-cnn').rssfeed('http://rss.cnn.com/rss/edition.rss', {
			   limit: 5,
			   date: false,
			   header: false,
			   linktarget: '_blank',
			   content: false
			 });
			$('#feed-npr').rssfeed('http://www.npr.org/rss/rss.php?id=1001', {
			   limit: 5,
			   date: false,
			   header: false,
			   linktarget: '_blank',
			   content: false
			 });
			$('#feed-csm').rssfeed('http://rss.csmonitor.com/feeds/csm', {
			   limit: 5,
			   date: false,
			   header: false,
			   linktarget: '_blank',
			   content: false
			 });
			$('#feed-wsjn').rssfeed('http://online.wsj.com/xml/rss/3_7085.xml', {
			   limit: 5,
			   date: false,
			   header: false,
			   linktarget: '_blank',
			   content: false
			 });
			

			// From the Right
			$('#feed-fox-news').rssfeed('http://feeds.foxnews.com/foxnews/latest', {
			   limit: 5,
			   date: false,
			   header: false,
			   linktarget: '_blank',
			   content: false
			 });
			$('#feed-washtimes').rssfeed('http://www.washingtontimes.com/rss/headlines/news/national/', {
			   limit: 5,
			   date: false,
			   header: false,
			   linktarget: '_blank',
			   content: false
			 });
			$('#feed-theblaze').rssfeed('http://www.theblaze.com/stories/feed/', {
			   limit: 5,
			   date: false,
			   header: false,
			   linktarget: '_blank',
			   content: false
			 });
			$('#feed-newsmax').rssfeed('http://www.newsmax.com/rss/Newsfront/16.xml', {
			   limit: 5,
			   date: false,
			   header: false,
			   linktarget: '_blank',
			   content: false
			 });

		}; // end if

		$('.carousel li h4 a').attr('target', '_blank');

		$('.carousel').carousel({
			interval: 8000
		});




		// Feedback Menu item
		$('nav#main-menu li.last').popover('show');

		// Enable Dropdown
		$('.dropdown-toggle').dropdown();







		// // ***************  START AddThis - Enable Sharing individual tabs on Story Block **********************
		
		// // Set the AddThis parameters with the data from first Story ID

		// // Grab the Data
		
		// var storyShowcasePane = $('#story-id-showcase .tab-pane');
		// storyShowcasePane.each(function(index) {
		// 		var firstStory = $(this).find(".story-id-tab-block .view-grouping-content h2 a");
		// 		var currentStoryUrlInit = firstStory.attr('href');
		// 		var currentStoryTitleInit = firstStory.text();				
		// 		var paneAddThis = $(this).find('.addthis_toolbox');
		// 		paneAddThis.attr('addthis:url', 'http://www.allsides.com' + currentStoryUrlInit);			
		// 		paneAddThis.attr('addthis:title', 'See - ' + currentStoryTitleInit + ' - from the Left, Center & Right at AllSides.com' );
		// 		paneAddThis.attr('addthis:description', 'See - ' + currentStoryTitleInit + ' - covered from the Left, Center & Right at AllSides.com');
		// 	});
		

		// // For each clicked tab populate the URL of social buttons with the URL os current tab's Story

		// $('.quicktabs-tabs li a').click(function(event) {
		// 	var $this = $(this);
			
		// 	// First make sure we are going to be matching the text exactly
		// 	$.expr[":"].econtains = function(obj, index, meta, stack){
		// 	return (obj.textContent || obj.innerText || $(obj).text() || "").toLowerCase() == meta[3].toLowerCase();
		// 	}

		// 	// Grab the text from the current tab
		// 	var currentStoryTitle = $this.text();

		// 	// Find Story ID with the same text
		// 	var currentStoryUrl = $(".feature-thumbs-wrapper .feature-thumbs:first-child .news-story a:contains('" + currentStoryTitle + "')").attr('href');
	 
		// 	// Reload AddThis with new attribute values
		// 	// addthis.update("share", "url", "http://www.allsides.com" + currentStoryUrl);
		// 	// addthis.update("share", "title", 'See - ' + currentStoryTitle + ' - from the Left, Center & Right at AllSides.com');
		// 	// addthis.update("share", "description", 'See - ' + currentStoryTitle + ' - covered from the Left, Center & Right at AllSides.com');
		// });
		// // ***************  END AddThis - Enable Sharing individual tabs on Story Block **********************


		
		// Implement User Register Page Tweaks
		$('#edit-mail').blur(function(event) {
			$('#edit-mailchimp-lists').show();
		});

		$('#edit-mailchimp-lists-mailchimp-allsides-optional-subscribe').attr('checked', 'checked');

		//$('#edit-submit--2').val('Sign Up');

		$('#user-register-form label.option').remove();


		// Activate Topic Tabs

		// $('#topic-tabs a[href="#candidates"]').tab('show');
		
		$('#topic-tabs a').click(function (e) {
		  e.preventDefault();
		  $(this).tab('show');
		})

		// Dynamically Replace Issue Menu item with the name of the current issue.
		// Grab the Title Text

		if ($('body').hasClass('section-topics')) {
			var TaxonomyTitleText = $('h1.title').text();
			$('span.issues-menu-label-dynamic').text(TaxonomyTitleText);
		};



		// Center Position the Topic Menu

		// Get the width of .dropdown (relatively positioned parent) - x
		var topicMenuParentWidth = $('div.dropdown.issues-menu').width();
		

		// Calculate the amount of pixels to position menu to the left - y = (z-x)/2 where z is width of menu, and y is the amount of pixels
		var pixelsLeft = -(900 - topicMenuParentWidth)/2 ;

		// Update the amount of pixels to the left
		$('#top-nav-content ul.issues-dropdown').css('left', pixelsLeft);

		// Hide Tabs and Image from News Topic Page
		if 	( $('.views-field-field-type-of-topic .field-content').html() === '<div class="type-of-topic-News"></div>' ) {
			$('.topics-display').hide();
			$('.news-display').show();
			$('div#top-pics').removeClass('active');
			$('div#news').addClass('active');
		}

		// Enable Tooltips and Update text for cadidates
		$('.submit-tooltip').tooltip();
		$('.candidate .submit-tooltip').attr('title', 'Send us an informative candidate position article.');

		// Hide Submit Your pick if No Result Message is present
		
		$('.bias-trio').each(function(event) {
			var $this = $(this);
				if ( $this.find('.bias-trio-no-result').length !==0 ) {
				$this.find('.bias-trio-footer-area').remove();
			}
		});


		/*
		 * START Pop-up Video
		*/

		// Insert onclick attribute, since Views strips that code
		$('.trigger-image').attr('onclick', "return popVideo('vid1',true)");

		
		// Insert current iframe into video-container above.
		$('.allsides-daily-row').each(function(event) {

			var $this = $(this);
			

			if ( $this.find('.trigger-image').length !== 0 ) {
				$this.find('.news-image-toggle').remove();
			}

			$this.find('.trigger-image').click(function(event) {
				var hiddenVideoYoutube = $(this).closest('.allsides-daily-row').find('.media-youtube-video').html();
				$('.video-container').html(hiddenVideoYoutube);
			});			
		});

		$('.allsides-daily-row').each(function(event) {
			$(this).find('.news-video-trigger a').click(function(event) {
				var hiddenVideoOther = $(this).closest('.allsides-daily-row').find('.news-video').html();
				$('.video-container').html(hiddenVideoOther);
			});			
		});

		

		// Close Box by clicking away from box
		// trigger-image click will trigger this function since #darkenScreenObject doesn't exist yet
		$('.trigger-image').click(function(event) {


			var darkenScreenObject = $('#darkenScreenObject');
			darkenScreenObject.css('background-image', 'url(sites/all/themes/allsides/images/AllSides-logo-beta-bg.png)');
			


			// Position Video in the Center of Screen 
			var videoBox = $('#vid1');
			var videoWidth = videoBox.width();
			var videoHeight = videoBox.height();

			// Update the Margins of #vid1
			videoBox.css('margin-top', -(videoHeight/2)).css('margin-left', -(videoWidth/2));

			// Trigger The Click Button on Backdrop click
			$('#darkenScreenObject').click(function(){
		   		$(".video-modal-close").trigger('click');
		  	});

			// Autoplay the Video
			// Add Autoplay to the Video URL
			// var videoUrl = $('.video-container .media-youtube-player').attr('src')
			// $('.video-container .media-youtube-player').attr('src', videoUrl + "&autoplay=1");

			// Empty Currently playing video after closing the modal
			$(".video-modal-close").click(function(event) {
				$('.video-container').empty();
			});

		});
		

		/*
		 *  END Pop-up Video
		*/


		// User Edit page customizations
		if ($('body').hasClass('page-user-edit')) {
			$('select[name="timezone"]').addClass('span7');
		}
		

		
		/**
		 * Replace search string parameter with page title on bias trio view.
		 */

		var currTaxonomyTitle = $('.issues-menu-label-dynamic').text();
		

		 $('.think-tank-box form input[name="ss"]').val(currTaxonomyTitle);
		
		
		/**
		 * Change "From the ..."  navigation buttons dynamically on craousel block
		 */
		
		 //$('#next').addClass('nikita');
		
		 $('.pusk').click(function(e) {
		 	
		 	$('.issues-menu').trigger('click');
		 });
		 


		 function myFunction(){
			 setInterval(function(){
			 	$('#next').trigger('click');
			 	//$('#next').addClass('nikita');
			 },3000);
		 }
		 //myFunction();
		 


		 // Make all the links in an iframe open in new tabs 
		  $('body.node-type-iframe a').attr('target', '_blank');


		 // Add Alert Box
		 $(".alert").alert();


		 /**
		  * Resize Iframe On News Item Page after window resizing and hiding of top headers.
		  */

		 if ($('body').hasClass('node-type-allsides-news-item')) {
			

		 // var buffer = 0; //scroll bar buffer
		 // var iframe = document.getElementById('news-item-iframe');

		 // function pageY(elem) {
		 //     return elem.offsetParent ? (elem.offsetTop + pageY(elem.offsetParent)) : elem.offsetTop;
		 // }

		 // function resizeIframe() {
		 //     var height = document.documentElement.clientHeight;
		 //     height -= pageY(document.getElementById('news-item-iframe'))+ buffer ;
		 //     height = (height < 0) ? 0 : height;
		 //     document.getElementById('news-item-iframe').style.height = height + 'px'; 
		 //     var iframeHeight = $('#news-item-iframe').css('height');
		 //     var iframeWidth = $('#news-item-iframe').outerWidth();
		 //     $('#iframeholdertrigger').css('height', iframeHeight).css('width', (iframeWidth - 50) + 'px');  
		 // }
		

		 
		 // var newsIframe = $('#news-item-iframe');
		 // var floatHeaderHeight = $('.alert.floating-header').outerHeight(true);
		 // var adminHeaderHeight = $('.alert.admin-header').outerHeight(true);
		 // var toolHeaderHeight = $('.alert.toolbar-header').outerHeight(true);
		 // var combinedHeaderHeight = floatHeaderHeight + adminHeaderHeight + toolHeaderHeight;

		 // window.onresize = resizeIframe();

		 // $('.alert.floating-header a.close').click(function(event) {
		 // 	resizeIframe();
		 // 	var newHeight = newsIframe.outerHeight(true) + floatHeaderHeight ;
		 // 	newsIframe.css('height', newHeight);
		 // });
		 // $('.alert.admin-header a.close').click(function(event) {
		 // 	resizeIframe();
		 // 	var newHeight2 = newsIframe.outerHeight(true) + adminHeaderHeight + 12 + 'px';
		 // 	newsIframe.css('height', newHeight2);
		 // });
		 // $('.alert.toolbar-header a.close').click(function(event) {
		 // 	resizeIframe();
		 // 	var newHeight3 = newsIframe.outerHeight(true) + toolHeaderHeight;
		 // 	newsIframe.css('height', newHeight3);
		 // });

		 $(window).scroll(function(){
		 	//$('#floating-header').hide();
		 	$('#news-item-iframe').css('height', '800px !important');
		 });

		};


		// Hide/Show Add This on Homepage 
		


		$('.story-id-tab-block,  .news-story-block').mouseenter(function  () {
			$('.add-this-area').fadeIn();
			$('.add-this-container').fadeIn();
		});
		$('.story-id-tab-block, .news-story-block').mouseleave(function  () {
			$('.add-this-area').fadeOut();
			$('.add-this-container').fadeOut();
		});

		$('.story-id-single').each(function(){
			var $this = $(this);
			var storyIdUrl = "https://allsides.com/" + $this.find('.story-title a').attr('href');
			var storyIdTitle = $this.find('.story-title a').text();
			var storyIdDescription = $this.find('.story-description p').text();

			$this.mouseenter(function() {
				$this.find('.add-this-area').fadeIn();
				$this.find('.add-this-container').fadeIn();
			});
			$this.mouseleave(function() {
				$this.find('.add-this-area').fadeOut();
				$this.find('.add-this-container').fadeOut();
			});

			$this.find('.sharethis-inline-share-buttons').attr('data-url', storyIdUrl).attr('data-title', storyIdTitle).attr('data-description', storyIdDescription);
			//$this.find('.addthis_toolbox').attr('addthis:url', storyIdUrl).attr('addthis:title', storyIdTitle).attr('addthis:description', storyIdDescription);
		});


		if ($('ul.nav-story-id-tabs').outerWidth() > 822 ) {
			$('.nav-story-id-tabs li.last').remove();
		};


		/*
		 * User Page
		 */

		$('.heartbeat-stream').slimScroll({
		    height: '160px',   
		    size: '8px', 
		    railVisible: true
		});

		$('.view-my-bias-ratings .view-content').slimScroll({
		    height: '105px',   
		    size: '8px', 
		    
		    railVisible: true
		});

		/*
		 * Source or News Item Page
		 */

		if ( $('body').hasClass('section-news-source') || $('body').hasClass('node-type-allsides-news-item')  ) {
		
			// Agree/Disagree Rating for News Source

			//style the buttons
			$('.rate-button').addClass('btn');

			// Implement 'pressed' button and hide 1 and 0 text nodes		
			$('.rate-yesno-btn').each(function() {
				// hide 1 and 0 text nodes
				$($(this)[0].nextSibling).wrap('<span style="display:none"></span>');			
			});
			

			// pressed buttons effect
			var rateInfo = $('.rate-widget-yesno .rate-info:not(.rate-processed)')

			rateInfo.each(function() {
				var rateInfoText = $(this).text();

				// What happens when Agree button is pressed
				if (rateInfoText.indexOf(" agree") > 0) {
					$('.source-page-bias-block li.first a').addClass('active');

					// hide Fivestar Bias Rating widget
					$('.source-page-bias-block form.fivestar-widget').hide();				
				}

				// refer to rateInfo.each through self variable inside nested functions
				var self = $(this);

				$('.fivestar-widget a').on('click', function() {					
					// add rate-processed class to the yesno widget div to make sure things don't get procesed several times.
					self.addClass('rate-processed');
				});


				// What happens when Disagree button is pressed
				if (rateInfoText.indexOf("disagree") > 0) {
					// active class is added
					$('.source-page-bias-block li.last a').addClass('active');

					// News Source page treatment
					if ( $('body').hasClass('section-news-source') ) {

						// Description text is added
						$(this).append('<p class="how-do-you-think">How do you think the bias of this source should be rated?<p>');
						// Show the Fivestar Bias Rating Widget
						$('.source-page-bias-block form.fivestar-widget').show();

						// Hide Fivestar widget after pressing one of the rate buttons
						$('.rate-button').on('click', function(){
							$('.source-page-bias-block form.fivestar-widget').hide();
						});
					}

					// Trigger Cancel on Fivestar rating widget when pressing Agree or Disagree and after all Ajax events have fired.
					// $('.rate-widget li a').ajaxStop(function() {
					// 	$(this).on('click', function () {
					// 		$('.cancel a').trigger('click');
					// 	});
					// });	

					$('.rate-widget li a').on('click', function () {
							$('.cancel a').trigger('click');
						});
					
					
				}
			}); // End .each

			
			// Affirm user about which rating they chose

			// Get the value of the Rating
			var starValue = $('.source-page-bias-block .fivestar-widget .star.on a').text();

			// Change the text below the rating
			if(	$('.source-page-bias-block .fivestar-widget .star').hasClass('on') ) {
				$('p.fivestar-confirmation').html('Your rating is <strong>' + starValue + '</strong>');
			} else {
				$('p.fivestar-confirmation').text('');
			}
		}; // end if on the news source or new item page


		/*
		 * News Item Page specific actions
		 */ 

		if ( $('body').hasClass('node-type-allsides-news-item') || $('body').hasClass('node-type-news-source')) {

			function agreeDisagreeHandler () {
				$('.rate-widget-yesno li a').click(function(){
					$('body').addClass('ajax-processed');					
				});

				var $biasRatingBlockContents = $('.newsitem-bias-rating-block-contents');

				// When clicking on Agree button
				$('.agree-disagree-widget li.first a, .rate-widget-yesno li.first a').click(function () {
					var rateInfoContents = "<strong>You Agree</strong>. <p class='clipit-description'>Thank you! Community votes alone don't determine our ratings, but are valuable feedback and can prompt us to do more research.</p>"
					$biasRatingBlockContents.html(rateInfoContents);
					$('.fivestar-confirmation').html('');
				});

				// When clicking on Disagree button
				$('.agree-disagree-widget li.last a, .rate-widget-yesno li.last a').click(function (e) {

					// update modal with Disagree text
					var rateInfoContents = "<strong>You Disagree</strong>. <p class='clipit-description'>Thank you! Community votes alone don't determine our ratings, but are valuable feedback and can prompt us to do more research.</p>"
					$biasRatingBlockContents.html(rateInfoContents);

					// Description text and Bias Rating Widget are added to the modal
					$biasRatingBlockContents.append('<p class="how-do-you-think">How do you think the bias of this source should be rated?<p>');
					$('body.node-type-allsides-news-item .source-page-bias-block form.fivestar-widget, .fivestar-confirmation').show();
				});

				//Launch modal on pressing inactive rate button
				$('.rate-widget-yesno li a:not(.active)').click(function(){							
					$('#agree-disagree-modal').modal();
				});

			}
			agreeDisagreeHandler();
		} // end if on news item page



		/*
		 * Bias Rating Page actions
		 */ 

		if ( $('body').hasClass('page-bias-bias-ratings')) {

			function agreeDisagreeHandler () {
				$('.rate-widget-yesno li a').click(function(){
					$('body').addClass('ajax-processed');					
				});

			}
			agreeDisagreeHandler();

			// Bias Ratings page

			$('.community-feedback-label').html('Community feedback <br /><a href="/bias/media-bias-rating-methods">(biased, not normalized)</a>');
			$('#edit-title').attr('placeholder', 'type full or partial name');

			$('.bias-raitings-list tr').each(function(){


				var $thisRow = $(this);

				// Show only user ratings with 10 votes or more
				var sourceTitle = $thisRow.find('.source-title a').text();
				var userRatingsAmount = parseInt($thisRow.find('.community-feedback .fivestar-widget-static-vote .star-1 span').text());
				var userRating = $thisRow.find('.community-feedback .fivestar-average-stars');

				if (userRatingsAmount >= 2 ) {
					userRating.show();
				}

				// Hide/Show Five star Rating Widget when pressing Agree/Disagree
				var $ratingWidget = $thisRow.find('.bias-fivestar-rating-widget');
				var $agreeButton = $thisRow.find('.what-do-you-think li.first .rate-btn');
				var $agreeButtonActive = $thisRow.find('.what-do-you-think li.first .rate-btn.active');
				var $disagreeButton = $thisRow.find('.what-do-you-think li.last .rate-btn');

				// pressed buttons effect
				var rateInfo = $thisRow.find('.rate-widget-yesno .rate-info:not(.rate-processed)');
				var rateInfoText = rateInfo.text();

				$thisRow.find('.fivestar-widget a').on('click', function() {					
					// add rate-processed class to the yesno widget div to make sure things don't get procesed several times.
					rateInfo.addClass('rate-processed');
				});

				//console.log(sourceTitle + ' - ' + userRatingsAmount + ' - Rate-Info: ' + rateInfoText);

				// What happens when Agree button is pressed
				if (rateInfoText.indexOf("agree") == 4) { // if user is aggreeing
						$thisRow.find('li.last a').removeClass('active');
						$thisRow.find('li.first a').addClass('active');				
				} 

				if (rateInfoText.indexOf("disagree") == 4) { // if user is disagreeing
					$thisRow.find('li.first a').removeClass('active');
					$thisRow.find('li.last a').addClass('active');
					$('.how-do-you-think').text('How do you think the bias of this source should be rated?');
					$ratingWidget.show();
					
				} 

				if ( !($('body').hasClass('ajax-processed')) ) {
					rateInfo.html('');
					$('.how-do-you-think').text('');
				} 

				if ( !($disagreeButton.hasClass('active')) ) {
					$ratingWidget.hide();
				} 


				// Affirm user about which rating they chose

				// Get the value of the Rating
				var starValue = $thisRow.find('.fivestar-widget .star.on a').text();

				// Change the text below the rating
				if(	$thisRow.find('.fivestar-widget .star').hasClass('on') ) {
                                        $thisRow.find('p.fivestar-confirmation').html('');
					$thisRow.find('p.fivestar-confirmation').html('Your rating is <strong>' + starValue + '</strong>');
				} else {
					$thisRow.find('p.fivestar-confirmation').text('');
				}


			});
		} // end if on news item page





		/*
		 * News Sources Admin page
		 */ 

		// On Sources Admin page, asign color to Agree/Disagree based on Agreement Ratio

		var $rateDetails = $('.rate-details');

		$rateDetails.each(function() {

			var agree = parseInt($(this).find('.agree').text());
			var disagree = parseInt($(this).find('.disagree').text());
			var agreeDisagreeRatio = agree / disagree ;
			var agreeDisagreePercentage = (agreeDisagreeRatio * 100) + '%' ;

			// Assign different shades of Green and Red depending on the strength of the user opinion. Gray if no results.

			// Green Shades if more people Agree than Disagree
			if (agreeDisagreeRatio > 3) {
				$(this).addClass('green10');
			}
			else if (agreeDisagreeRatio > 2 && agreeDisagreeRatio <= 3) {
				$(this).addClass('green8');
			}
			else if (agreeDisagreeRatio > 1.5 && agreeDisagreeRatio <= 2) {
				$(this).addClass('green6');
			}
			else if (agreeDisagreeRatio > 1 && agreeDisagreeRatio <= 1.5) {
				$(this).addClass('green4');
			}

			// Red Shades if more people Disagree than Agree
			else if (agreeDisagreeRatio > 0.67 && agreeDisagreeRatio < 1) {
				$(this).addClass('red4');
			}
			else if (agreeDisagreeRatio > 0.5 && agreeDisagreeRatio <= 0.67) {
				$(this).addClass('red6');
			}
			else if (agreeDisagreeRatio > 0.33 && agreeDisagreeRatio <= 0.5) {
				$(this).addClass('red8');
			}
			else if (agreeDisagreeRatio <= 0.33) {
				$(this).addClass('red10');
			}

			// Gray if the ratio equals 1
			else if (agreeDisagreeRatio == 1) {
				$(this).addClass('gray');
			}

			// if no data available (NaN)
			else {
				$(this).addClass('gray-light');
			}

		});

var $rateDetailsText = $('.getratingval');
$rateDetailsText.each(function() {	
	var agreeText = parseInt($(this).find('.agree').text());
	var disagreeText = parseInt($(this).find('.disagree').text());
	var agreeDisagreeRatioText = agreeText / disagreeText ;
	var agreeDisagreePercentageText = (agreeDisagreeRatioText * 100) + '%' ;

	// Assign different shades of Green and Red depending on the strength of the user opinion. Gray if no results.
	// Green Shades if more people Agree than Disagree
	//console.log(agreeDisagreeRatioText);
	
	if (agreeDisagreeRatioText > 3) {
	    if($(this).find('.community-feedback-rating-page').length == 0)
		$(this).append('<div class="community-feedback-rating-page"><span class="commtext">Community </span><span class="visible-xs">absolutely agrees:</span><span class="hidden-xs">absolutely agree</span></div>');
	}else if (agreeDisagreeRatioText > 2 && agreeDisagreeRatioText <= 3) {
	    if($(this).find('.community-feedback-rating-page').length == 0)
		$(this).append('<div class="community-feedback-rating-page"><span class="commtext">Community </span><span class="visible-xs">strongly agrees:</span><span class="hidden-xs">strongly agree</span></div>');
	}else if (agreeDisagreeRatioText > 1.5 && agreeDisagreeRatioText <= 2) {
	    if($(this).find('.community-feedback-rating-page').length == 0)
		$(this).append('<div class="community-feedback-rating-page"><span class="commtext">Community </span><span class="visible-xs">agrees:</span><span class="hidden-xs">agree</span></div>');
	}else if (agreeDisagreeRatioText > 1 && agreeDisagreeRatioText <= 1.5) {
	    if($(this).find('.community-feedback-rating-page').length == 0)
		$(this).append('<div class="community-feedback-rating-page"><span class="commtext">Community </span><span class="visible-xs">somewhat agrees:</span><span class="hidden-xs">somewhat agree</span></div>');
	}

	// Red Shades if more people Disagree than Agree
	else if (agreeDisagreeRatioText > 0.67 && agreeDisagreeRatioText < 1) {
	    if($(this).find('.community-feedback-rating-page').length == 0)
		$(this).append('<div class="community-feedback-rating-page"><span class="commtext">Community </span><span class="visible-xs">somewhat disagrees:</span><span class="hidden-xs">somewhat disagree</span></div>');
	}else if (agreeDisagreeRatioText > 0.5 && agreeDisagreeRatioText <= 0.67) {
	    if($(this).find('.community-feedback-rating-page').length == 0)
		$(this).append('<div class="community-feedback-rating-page"><span class="commtext">Community </span><span class="visible-xs">disagrees:</span><span class="hidden-xs">disagree</span></div>');
	}else if (agreeDisagreeRatioText > 0.33 && agreeDisagreeRatioText <= 0.5) {
	    if($(this).find('.community-feedback-rating-page').length == 0)
		$(this).append('<div class="community-feedback-rating-page"><span class="commtext">Community </span><span class="visible-xs">strongly disagrees:</span><span class="hidden-xs">strongly disagree</span></div>');
	}else if (agreeDisagreeRatioText <= 0.33) {
	    if($(this).find('.community-feedback-rating-page').length == 0)
		$(this).append('<div class="community-feedback-rating-page"><span class="commtext">Community </span><span class="visible-xs">absolutely disagrees:</span><span class="hidden-xs">absolutely disagree</span></div>');
	}

	// Gray if the ratio equals 1
	else if (agreeDisagreeRatioText == 1) {
	}
	// if no data available (NaN)
	else {
	}

});
		/**
		 * Adds "see more/less" links to the Source Description.
		 */


		function collapseExpandDescription(){

		  if ( $('body').hasClass('section-news-source') || $('body').hasClass('page-node-rating') || $('body').hasClass('page-taxonomy-term') ) {
		  	var $el = $('.source-description, .topic-description');

		  	$el.expander({
		      slicePoint:         360,            // default is 100			
		      expandPrefix:       ' ... ',         // default is '... '
		      expandText:         'see more',     // default is 'read more'
		      expandEffect:       'fadeIn',
		      expandSpeed:        1000,
		      userCollapsePrefix: ' ',
		      userCollapseText:   'see less',     // default is 'read less'
		      collapseEffect:     'fadeOut',
		      //expandAfterSummary: true,
		      collapseSpeed:      30,
		      collapseTimer:      0,               // re-collapses after 5 seconds; default is 0, so no re-collapsing
		      
		      beforeExpand: function() {
		            $('.summary').hide();
		          },
		          // afterExpand: function() {
		          //   $('.summary').hide();
		          // },
		    });  

		  }// end iF
		};

		// call the function
		collapseExpandDescription();



		/**
		* Rating Box
		*/

		// if ( !($('body').hasClass('ajax-pager')) ) {

		function deployRatingBox () {
			$( '.fivestar-widget .star.on a' ).ready(function() { // wait for all the ajax stuff to load
			  
				$('.bias-container').each(function(){

					// declare the variables
					var $biasContainer = $(this),
					    $ratingBox = $biasContainer.find('.rating-box'),
					    $biasImage = $biasContainer.find('.bias-image'),
					    $closeButton = $ratingBox.find('span'),
					    $star = $biasContainer.find('.fivestar-widget .star'),
					    $starOn = $biasContainer.find('.fivestar-widget .star.on a'),
					    $sourceArea = $biasContainer.parent('.source-area')

					// show rating box 
					$biasImage.click(function (e) {
						if ( !($ratingBox.hasClass('rating-box-on')) ) {
							// first, hide open popup
							$('.rating-box').hide().removeClass('rating-box-on');
							// open respective popup and add class .rating-box-on
							$ratingBox.fadeIn().addClass('rating-box-on');
						}
					});
					// $biasContainer.siblings('.trigger-area').click(function (e) {
					// 	e.preventDefault();
					// 	if ( !($ratingBox.hasClass('rating-box-on')) ) {
					// 		// first, hide open popup
					// 		$('.rating-box').hide().removeClass('rating-box-on');
					// 		// open respective popup and add class .rating-box-on
					// 		$ratingBox.fadeIn().addClass('rating-box-on');
					// 	}
					// });
					
					// close popup with the close button
					$closeButton.click(function (e) {
						e.preventDefault();
						// remoce class
						$('.rating-box').removeClass('rating-box-on');
						// close current popup
						$ratingBox.fadeOut();
					});

					//Change the text below the rating
					if(	$star.hasClass('on') ) {
						// Get the value of the Rating
						var starValueRatingBox = $starOn.text();
                                                $(this).find('p.fivestar-confirmation').html('');
						$(this).find('p.fivestar-confirmation').html('Your rating is <strong>' + starValueRatingBox + '</strong>');
					} else {
						$(this).find('p.fivestar-confirmation').text('');
					}
				});
			});
		} // end deployRatingBox()	

		deployRatingBox();	



		// See which feed block on homepage has the biggest height and set all feed blocks to that height.
		
		$(window).bind("load", function() { // execute after everything, not just DOM, has loaded
		   var maxHeight = -1;

		   $('.bias-trio-wrapper .feed-block .carousel-inner .item').each(function() {
		   	maxHeight = maxHeight > $(this).height() ? maxHeight : $(this).height();
		   });

		   // now update feed-block heights based on the maximum height of each item.
		   $('.bias-trio-wrapper .feed-block').each(function() {
		   	$(this).height(maxHeight + 60);
		   });
		});

		// Wrap News Sources in marquee tags if they are too long:
		function trimSource (argument) {
			$('.news-source a').each(function(){
				var $newsSourceLink = $(this);
				var sourceWidth = $newsSourceLink.width();

				if ( $newsSourceLink.parent('.news-source').hasClass('news-story-source') ) {
					var allowedSourceWidth = 100;
				} else if ( $('body').hasClass('section-topics') ) {
					var allowedSourceWidth = 107;
				} else {
					var allowedSourceWidth = 107;
				}


				if ( sourceWidth > allowedSourceWidth )  {
					$(this).siblings('.source-mask').show();
					$(this).parent('.news-source').css('width', allowedSourceWidth);
					
					var $triggerArea = $(this).closest('.source-area').find('.trigger-area');

					$triggerArea.mouseenter(function(){
						console.log('mouseneter complete! ' + $(this));
						$newsSourceLink.stop(true,false).animate({right: sourceWidth-allowedSourceWidth+5}, 1000);
					});
					$(this).parent('.news-source').siblings('.trigger-area').mouseleave(function(){
						$newsSourceLink.stop(true,false).animate({right: 0}, 1000);
					});
				}
			});
		}
		// call trimSource on page load
		trimSource();

		// call trimSource when clicking on tab on Topic page
		$('.link-icons-allsides-picks').click(function (e) {
			trimSource();
		});

		/************title wrap****************/
		$('.short-title .news-title a').each(function(){
			var articleTitle = $(this).text();
			var titleLength = articleTitle.length;
			if(titleLength > 75){
				articleTitle = articleTitle.trim();
				articleTitle = articleTitle.substr(0,75)+'...';				
			}
			$(this).text(articleTitle);			
		});
		/************title wrap end****************/


		//Feeds

		//calculate wrapper width
		var wrapper = $('.row-feeds');
		var wrapperWidth = wrapper.width();
		var wrapperAmount = wrapper.length;
		var totalWrapperWidth = wrapperAmount * wrapperWidth;
		// set wrapper width
		$('#wrapper-wide').css('width', totalWrapperWidth + 'px');

		// show or hide Headlines. TODO: make sure this setting stays when number of headlines is changed.	
		function blurbsToggle (argument) {
			$('.blurbs-switch').click(function (e) {
				e.preventDefault();
				$('.rssRow p').fadeToggle('fast', function() {   
				});
			});
		}
		
		// change number of Headlines from 5 to 10		
		function headlinesNumber () {
			$('.headlines-5').click(function (e) {
				e.preventDefault();				
				var headlinesNumber = 5;
				populateFeeds(headlinesNumber);

			});
			$('.headlines-10').click(function (e) {
				e.preventDefault();				
				var headlinesNumber = 10;
				populateFeeds(headlinesNumber);
			});
		}

		// populate the feeds	
		function populateFeeds (headlinesNumber) {

			$('.row-feeds').each(function () {
				
				var $rowFeeds = $(this);
				var $newsSourceRss = $rowFeeds.find('.news-source-rss');
				var sourceId = $rowFeeds.find('.news-source-nid').text();

				$newsSourceRss.find('li').each(function (i,el) {
					var $RssLi  = $(this);
					var $RssLiUrl = $RssLi.find('.link-url a').text();
					var RssLiIdOld = $RssLi.find('.feed-container').attr('id');

					// increment IDs
					var RssLiIdNew = $RssLi.find('.feed-container').attr('id', RssLiIdOld+'-'+i);
					$(RssLiIdNew).html('');

					$(RssLiIdNew).rssfeed($RssLiUrl, {
					   limit: headlinesNumber,
					   date: false,
					   header: false,
					   linktarget: '_blank',
					   content: true
					 });
				});
			});
		}
		// call the functions
		blurbsToggle();
		headlinesNumber();
		populateFeeds(5);
		
		// close unneeded news sources
		$('.close-container').each(function(){

			var $closeFeedButton = $(this).find('.close-button');
			$(this).mouseenter(function(){
				$closeFeedButton.show();
			});
			$(this).mouseleave(function(){
				$closeFeedButton.hide();
			});
			$closeFeedButton.click(function(){
				$(this).closest('.row-feeds').hide("blind", { direction: "left" }, 222, function() { 
					$(this).remove(); 
					removeGlobalBias();
				});
				
			});
		});

		// close Global Bias if there are no more news sources there
		function removeGlobalBias () {
			$('.allsides-daily-topic-container').each(function() {
				if ( $(this).find('.row-feeds').length == 0 ) {
					console.log($(this));
					$(this).remove();
				}
			});
		}


		// Issue Edits
		if ( $('body').hasClass('page-node-add-yes-no-issue') ) {
			$('#edit-submit').addClass('btn-primary');
		};


		// News Source Rating Display Interface
		if ( $('body').hasClass('page-node-rating') ) {
				$('td.views-field-value div:contains("1")').each(function() {
					$(this).text('Agree').addClass('rate-details').addClass('green10');
				});
				$('td.views-field-value div:contains("2")').each(function() {
					$(this).text('Disagree').addClass('rate-details').addClass('red10');
				});


				$('td.views-field-value-1 div').each(function() {

					var textToChangeBias = $(this).html();
					var replacedText = textToChangeBias
						.replace("20","<img typeof=\"foaf:Image\" src=\"/sites/default/files/bias-left.png\" width=\"72\" height=\"12\" alt=\"Bias: Left\" title=\"Bias: Left\">")
						.replace("40","<img typeof=\"foaf:Image\" src=\"/sites/default/files/bias-leaning-left.png\" width=\"72\" height=\"12\" alt=\"Bias: Lean Left\" title=\"Bias: Lean Left\">")
						.replace("60","<img typeof=\"foaf:Image\" src=\"/sites/default/files/bias-center.png\" width=\"72\" height=\"12\" alt=\"Bias: Center\" title=\"Bias: Center\">")
						.replace("80","<img typeof=\"foaf:Image\" src=\"/sites/default/files/bias-leaning-right.png\" width=\"72\" height=\"12\" alt=\"Bias: Lean Right\" title=\"Bias: Lean Right\">")
						.replace("100","<img typeof=\"foaf:Image\" src=\"/sites/default/files/bias-right.png\" width=\"72\" height=\"12\" alt=\"Bias: Right\" title=\"Bias: Right\">");
					$(this).html(replacedText);
				});


				$('.average-bias-meter').each(function() {

					var textToChangeBias = $(this).html();
					var replacedText = textToChangeBias
						.replace("20","<img typeof=\"foaf:Image\" src=\"/sites/default/files/styles/bias144x24/public/bias-left.png\" width=\"144\" height=\"24\" alt=\"Bias: Left\" title=\"Bias: Left\">")
						.replace("40","<img typeof=\"foaf:Image\" src=\"/sites/default/files/styles/bias144x24/public/bias-leaning-left.png\" width=\"144\" height=\"24\" alt=\"Bias: Lean Left\" title=\"Bias: Lean Left\">")
						.replace("60","<img typeof=\"foaf:Image\" src=\"/sites/default/files/styles/bias144x24/public/bias-center.png\" width=\"144\" height=\"24\" alt=\"Bias: Center\" title=\"Bias: Center\">")
						.replace("80","<img typeof=\"foaf:Image\" src=\"/sites/default/files/styles/bias144x24/public/bias-leaning-right.png\" width=\"144\" height=\"24\" alt=\"Bias: Lean Right\" title=\"Bias: Lean Right\">")
						.replace("100","<img typeof=\"foaf:Image\" src=\"/sites/default/files/styles/bias144x24/public/bias-right.png\" width=\"144\" height=\"24\" alt=\"Bias: Right\" title=\"Bias: Right\">");
					$(this).html(replacedText);
				});
			};

			// Actual Bias Value (to display on the Source rating page and elsewhere)
			var oldPercentage = Number($('.actual-bias-value > div').text().replace(/%/g, ''));
			var newPercentage = (oldPercentage - 100)*(-1) + 10;
			$('.actual-bias-value > div').text(newPercentage);


			

		/**
		* Search Results
		*/

		
		if ($('body').hasClass('section-allsides-search-results') ) {

			// get the search word 
			var searchKeyword = $("#edit-search-api-views-fulltext").val();

			// get the title
			$('h1.title#page-title').html('Search results for <strong>' + searchKeyword + '</strong>');

		}
		
		

		$('#edit-search-api-views-fulltext').each(function(){
			if ( $(this).val() == 'Search' ) {
				$(this).css('color', '#888');
			} else {
				$(this).css('color', '#333');
				$(this).css("background-color", "whitesmoke");
			}

			$(this).focus(function(){
				$(this).css("background-color", "whitesmoke");
				$(this).css('color', '#333');
			});

			if (!($('body').hasClass('section-allsides-search-results')) ) {
				$(this).blur(function(){
					$(this).css("background-color", "#F0F0F0");
					$(this).css('color', '#888');
				});
			}
		});



		$('#edit-created-wrapper input[type="radio"]').change(function() {
			$('#edit-submit--2').trigger('click');
		});


		// Preselect Add new values to Tags

		$('input#edit-bundle-allsides-news-item-appendfield-tags-headlines, input#edit-bundle-allsides-news-item-appendfield-region').attr('checked', true);

		// trigger tooltips on news 
		$('.tooltip-trigger').tooltip();


		/**
		* Confidence Level
		*/

		// get the basis value
		

		$('.basis-of-rating').each(function(){

			var basisValue = $(this).find('.basis-value').text(); 
			if ( (basisValue == '1') || ($(this).find('.blind-third-reference ul li').length != 0) || ($(this).find('.blind-third-reference a').length != 0) ) {
				$(this).find('.check-mark').addClass('show-check-mark');
				$(this).find('.basis-label').addClass('basis-label-checked');
			}
		});

		// implement no results 

		// if ($('body').hasClass('section-news-source')) {
		// 	if ( $('.basis-comments p').length == 0 ) {
		// 		$('.basis-comments').remove();
		// 	};

		// 	if ( $('.margin-left-25').html().length == 0 ) {
		// 		$('.confidence-level').remove();
		// 	};

		// 	if ( $('.show-check-mark').length == 0 ) {
		// 		$('.basis-of-rating').remove();
		// 	};

		// };


		/**
		* Ajax Topics-compilation
		*/


	if ( !($('body').hasClass('ajax-processed'))  ) {
		

	/*	if ($('body').hasClass('section-topics')) {
			$('.ajax-loader-topics').show();
			var relatedTagsParams = $('.related-tags-params').text();
			console.log(relatedTagsParams);
			$( "#topics-compilation-frame" ).load( "/topics-compilation?a=" + relatedTagsParams + " #topics-compilation" );

			$( document ).ajaxStop(function() {
			  $('.ajax-loader-topics').hide();
			});
			

		}*/

		/**
		* Story ID Headline Trim
		*/
		$('h2.news-story > a, #story-id-tab-nav li a.quicktabs-loaded').each(function(){
			var storyHeadline = $(this).text();
			var trimmedStoryHeadline = storyHeadline.substring(0,41);
			$(this).text(trimmedStoryHeadline);
			
		});
		

		/**
		* Generate a Topic Menu for responsive layout
		*/
		// var $topicCell = $('.view-topic-menu-list td'); 
		// var $topicMenuList = $('.view-topic-menu-list');
		// $topicMenuList.append('<ul class="dropdown-menu" id="responsive-topics"></ul>');
		
		// $topicCell.each(function(){
		// 	var topicLink = $(this).html();
		// 	$('#responsive-topics').append("<li>" + topicLink + "</li>");
		// });

		/**
		* Generate a Story Block for responsive layout
		*/
	

		var $storyBlock = $('.news-story-block');
		var $tabPage = $('.news-story-block .quicktabs-tabpage');
		var $storyBlockDesktopContent = $('.news-story-block .view-content');
		
		$storyBlock.append('<div id="responsive-story-block"></div>');
		var $responsiveStoryBlock = $('#responsive-story-block');
		var $storyBlockContainer = $('.quicktabs_main');

		var i = 0;
		/*$tabPage.each(function(i){

			var tabPageContent = $(this).html();
			var tabPageStory = $(this).find('h2.news-story:first').html();
			var tabPageImage = $(this).find('.news-image img:first');
			var tabPageTopic = $(this).find('.news-topic .display-topic .news-topic').html();			
			var $responsiveTabPage = $responsiveStoryBlock.find(".tab-page-resp-" + i);
			if ( (tabPageStory || tabPageTopic) !== null ) {
				$(this).prepend('<h2 class="responsive-story">' + tabPageStory + '</h2>');
				$(this).prepend('<div class="responsive-topic">' + tabPageTopic + '</div>');
			}
			

			$(this).prepend(tabPageImage);
			


			// media query event handler
			if (matchMedia) {
				var mq = window.matchMedia("(max-width: 979px)");
				var mqFullSize = window.matchMedia("(min-width: 980px)");
				mq.addListener(WidthChange);
				mqFullSize.addListener(WidthChangeFullSize);
				WidthChange(mq);
				WidthChangeFullSize(mqFullSize);
			}



			// media query change
			function WidthChange(mq) {
				if (mq.matches) {
					//$(this).prepend(tabPageImage);
					$('body').addClass('responsive-layout');
				}
			}

			function WidthChangeFullSize(mqFullSize) {
				if (mqFullSize.matches) {
					//$(this).prepend(tabPageImage);
					$('body').removeClass('responsive-layout');
					$('#quicktabs-view__news__news_date ul.quicktabs-tabs li a').first().trigger('click');
					
					showStoryBlock();
					// remove overflowing tab if the page was loaded in small width state
					removeLongTab();
									}
			}

			var $storyImage = $(this).find('img:first');
			//console.log($storyImage);
			$storyImage.wrapAll('<div class="story-image-wrapper"></div>');
			
			i++;			
		});*/

	} // end if


	// media query event handler
	if (matchMedia) {
		var mq = window.matchMedia("(max-width: 979px)");
		var mqFullWidth = window.matchMedia("(max-width: 767px)");
		var mqFullSize = window.matchMedia("(min-width: 980px)");
		var mqMin767 = window.matchMedia("(min-width: 767px)");
		mq.addListener(WidthChange);
		mqFullWidth.addListener(WidthChangeFullWidth);
		mqFullSize.addListener(WidthChangeFullSize);
		mqMin767.addListener(WidthChangeMin767);
		WidthChange(mq);
		WidthChangeFullWidth(mqFullWidth);
		WidthChangeFullSize(mqFullSize);
		WidthChangeMin767(mqMin767);
	}


	var allsidesBodyLayoutClass = '';
	// media query change
	function WidthChange(mq) {
		if (mq.matches) {
			//$(this).prepend(tabPageImage);
			$('body').removeClass('responsive-layout-full-width');
			$('body').addClass('responsive-layout');
			allsidesBodyLayoutClass = 'responsive';
			$('.team-bio').hide();
		}
	}

	function WidthChangeFullWidth(mqFullWidth) {
		if (mqFullWidth.matches) {
			$('body').addClass('responsive-layout-full-width');
			$('.triangle').hide();
			$('.team-member').removeClass('team-member-inactive');
			unSlimScrollCandidate();
		}
	}

	function WidthChangeMin767(mqMin767) {
		if (mqMin767.matches) {
			$('body').removeClass('responsive-layout-full-width');
			$('.team-bio').hide();
			slimScrollCandidate();
		}
	}

	function WidthChangeFullSize(mqFullSize) {
		if (mqFullSize.matches) {
			$('body').removeClass('responsive-layout');
			$('body').removeClass('responsive-layout-full-width');
			allsidesBodyLayoutClass = 'full-width';
		}
	}


	// Hide and Show The Loading Message and Stories Block on Homepage

	function showStoryBlock () {
		$('.view-news-loading').hide();
		$('.news-story-block').show();
	}
	
	


	/**
	* Clipping UX on the site
	*/
	
	var articleClippingNormal = $('body.logged-in .allsides-daily-row');


	function clipIt () {

		articleClippingNormal.each(function(){

			// append a clip icon div with link to user page for clipped articles
			var clipIcon = '<a href="/user"><div data-toggle="tooltip" data-original-title="You have saved this news article to your personal newsboard. Go there now!" class="clip"></div></a>';
			var $clipIconObject = $(this).find($('.clip'));
			

			// Add clip Icon and remove the unclipping option
			if( $(this).find('.unclip a').hasClass('unflag-action') && $clipIconObject.length == 0 && $('.own-page').length == 0  ) {
				//$(this).find($('.unclip')).remove();
				//$(this).append(clipIcon);

			}
			
			// Perform the Clip/Unclip visibility toggle			
			$(this).mouseenter(function  () {
				$(this).find('.unclip').css('display', 'block');
				//$(this).find('.source-area').css('border', '1px solid #CCC');
			});

			$(this).mouseleave(function  () {
				$('body.logged-in .unclip').css('display', 'none');
				//$(this).find('.source-area').css('border', '1px solid rgba(0, 0, 0, 0)');
			});

			$('.clip').tooltip();
		});

	}

	clipIt();



	
	
	

	



	/**
	* Article Clipings on User Page
	*/

	var articleClipping = $('.wookmark-item');
	var amountBoxes = articleClipping.length;

	function ClippedArticles(amountOfArticles, layout) {
		this.amountOfArticles = amountOfArticles;
		// check to see if body-has responsive-layout class or not
		this.layout = layout;

		this.tile = function() {
			// add Bootstrap span4 class
			articleClipping.addClass('span4');
			// remove right margein from every third article clipping
			$(".wookmark-container > div:nth-child(3n)").addClass("no-right-margin");			
		};	

		// Add Dummy boxes if there are less than 3 clippings in one row.
		this.addDummies = function() {
			var oneBoxLeft = amountBoxes%3
			var placeholderBox = '<div class="wookmark-item white-box placeholder placeholder-background span4"></div>';
			var placeholderBox2 = '<div class="wookmark-item white-box placeholder2 placeholder-background span4"></div>';
			var placeholder = $('.placeholder');
			if (oneBoxLeft==2) {
				$('.wookmark-container').append(placeholderBox);
			}
			if (oneBoxLeft==1) {
				$('.wookmark-container').append(placeholderBox).append(placeholderBox2);
			}
		};

		this.fadeClippings = function() {
			$('.my-clipped-articles .wookmark-item').each(function() {
				var $this = $(this);
				$this.find('.unclip a').click(function() {
					$this.css('opacity', '0.5').css('transition', '.5s');
					
				});
				$this.find('.unclip a.unflagged').click(function() {
					$this.css('opacity', '1').css('transition', '.5s');	
				});
			});
		}
	}

	var userPageClippings = new ClippedArticles(amountBoxes, allsidesBodyLayoutClass);
	userPageClippings.addDummies();
	userPageClippings.tile();


	

	// Add Dummy boxes if there are less than 3 clippings in one row.
	

	// Fade Clippings for the owner of the User page to emphasize the articles have been removed from the page
	function fadeClippings() {
		$('.my-clipped-articles .wookmark-item').each(function() {
			var $this = $(this);
			$this.find('.unclip a').click(function() {
				$this.css('opacity', '0.5').css('transition', '.5s');	
			});
			$this.find('.unclip a.unflagged').click(function() {
				$this.css('opacity', '1').css('transition', '.5s');	
			});
		});
	}
	
	// Make some adjustments based on whether the user is on his own user page or not
	if ( $('.own-page').length != 0 ) {
		// Fade clippings only for the owner
		fadeClippings();
		articleClippingNormal.removeClass('clip');

	} else if ( $('.somebodys-page').length != 0 ) {
		$('.btn-rate-own-bias').hide();
	}

	// User Settings page
	$('#edit-field-user-bias-und option:nth-child(3), #edit-field-user-bias-und option:nth-child(7)').remove();
	$('#edit-field-user-bias-und').after('<a href="/rate-own-bias" class=" take-bias-quiz">Take this quiz to rate your own bias</a>');
	//$('body.page-user-edit #edit-actions #edit-submit').addClass('btn-success');
	$('body.page-user-edit #edit-actions #edit-cancel').removeClass('btn-success');
	


	// Add Ajax-processed to body when the rating widget or ajax pager on Topic Page is clicked
	$('.fivestar-widget, .bias-trio-footer-combined ul.pager li a').click(function (e) {
		e.preventDefault();
		$('body').addClass('ajax-processed');
	});

	/*$('.flag-wrapper').click(function (e) {
		e.preventDefault();
		$('body').addClass('ajax-processed');
	});*/

	if($('.news-story-block').css("display", "block") && !$('body').hasClass('ajax-processed') ) {
		$('#quicktabs-view__news__news_date ul.quicktabs-tabs li a').first().trigger('click');
	}
	

	function removeLongTab() {
		  	// NT: First Make sure the Tab that doesn't fit into the row is removed
		  	// Make sure the offsetParent is positioned 
		  	$('ul.quicktabs-tabs').css('position', 'relative');

		  	// Remove the tab that is more than 18px from the top
		  	var tabPosition = $(' ul.quicktabs-tabs li.last ').position();
		  	$(' ul.quicktabs-tabs li').each(function(event) {
		  		if (!$('body').hasClass('responsive-layout')) {
					if ( $(this).position().top  > 18 ) { 
						$(this).remove(); 
					};
		  		}
		  	});
	}



	/**
	* Team Page
	*/

	var currentTeamRow = '';
	var $everyTeamMember = $('.team-member');
	$('.team-row').each(function(){
		var $teamRow = $(this);
		var $teamMember = $(this).find('.team-member');


		$teamMember.each(function() {

			var $currentTeamMemberShell = $(this);
			var $currenTeamMember = $(this).find('.allsides-grid-image-info'); // image overlay
			var teamMemberBio = $currentTeamMemberShell.find('.team-bio').html();
			//var teamMemberBioDisplayed = 



			// console.log('');

			if ( teamMemberBio != $teamRow.find('.bio-content').html() ) { // bio box is not on TO DO:
				$currentTeamMemberShell.mouseenter(function(){
					$currenTeamMember.show();
				});	

				$currentTeamMemberShell.mouseleave(function(){
					$currenTeamMember.hide();
				});	
			}
			

			$currenTeamMember.click(function(){

				// hide overlay
				$(this).hide();

				var narrowScreens = $('body').hasClass('responsive-layout-full-width');
				// clear bio box
				$everyTeamMember.removeClass('team-member-active');
				if (!narrowScreens) {
					
					$everyTeamMember.addClass('team-member-inactive');
					
					
				}
				$currentTeamMemberShell.removeClass('team-member-inactive');
				$currentTeamMemberShell.addClass('team-member-active');

				$('.triangle').hide();
				$('.bio-box').hide();
				$teamRow.scrollTop($(this));
				$teamRow.find('.bio-content').html('');
				$teamRow.find('.bio-box').show();
				$teamRow.find('.bio-content').html(teamMemberBio);

				// execute onluy for narrow screens
				if ( $('body').hasClass('responsive-layout-full-width') ) {
					$('.team-bio').hide();
					$currentTeamMemberShell.find('.team-bio').show();
				}


				$currentTeamMemberShell.find('.triangle').show( "slide",  { direction: "down" }, 300 );

				if ( !narrowScreens && $teamRow.find('team-member-active').length == 0 ) {
					$('html, body').animate({
				        scrollTop: $teamRow.offset().top - 60
				    }, 300);	
				}
			});

			$teamRow.find('.bio-box').click(function(){
				$teamRow.find('.bio-box').hide();
				$('.triangle').hide();
				$everyTeamMember.removeClass('team-member-active');
				$everyTeamMember.removeClass('team-member-inactive');
			}).children('.bio-content').click(function(e) {
			  return false;
			});
		});

	});


	/**
	* New Item Page
	*/

	$('.btn-news-item-details').click(function(){
		$('.news-item-details').toggle();
	});

	var newsEditLink = $('body.node-type-allsides-news-item .tabs a.tabs-primary__tab-link:contains("Edit")').attr('href');
	$('#news-edit').attr('href', newsEditLink);


	/**
	* Contact Form
	*/
	if ( $('body').hasClass('section-contact')  ) {
		$('#edit-submitted-topic').after('<div id="topic-description"></div>');

		$('#edit-submitted-topic').change(function(){

			var selectedTopic = $('#edit-submitted-topic option:selected').attr('value');
			var $topicDescription = $('#topic-description');

			switch(selectedTopic) {
			  case 'not_specified':
			    $topicDescription.text('Not Specified');
			    break;
			  case 'website':
			    $topicDescription.text('Feedback on the site, features, information');
			    break;

			  case 'bias':
			    $topicDescription.text('Feedback or questions about bias and bias ratings');
			    break;

			  case 'partners':
			    $topicDescription.text('Want to contact AllSides about working with us, using our services or news feed on your site or for your company');
			    break;

			  case 'schools':
			    $topicDescription.text('Interested in using AllSides in the for teaching, debate teams, more');
			    break;

			  default : 
			    $topicDescription.text('');
			  
			}
		});


	
		// Grab URL parameters and preselect the topic select box
		function getParameterByName(name) {
		    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
		    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
		        results = regex.exec(location.search);
		    return results == null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
		}

		var prodId = getParameterByName('p');

		console.log(prodId);

		$('#edit-submitted-topic option[value="' + prodId + '"]').attr('selected', 'selected');
	} // end if

	/**
	* Engagement Bar
	*/
	//$('.clip-it-big a ').text('Clip it ');
	$('body.not-logged-in .clip-icon-text').html('<a href="#clipit-modal" role="button" class="flag" data-toggle="modal">Save to News Board</>');
	$('.pluginShareButtonLink img').attr('source', '/sites/all/themes/allsides/images/icons/facebook.png')

	// <a href="#share-modal" role="button" class="btn" data-toggle="modal">Launch demo modal</a>

	var currentUrl = 'http://allsides.com' + $('link[rel="canonical"]').attr('href');
	var currentTitle = $('title').text();
	var currentDescription = $('title').text();
	$('.addthis-settings').attr('addthis:url', '').attr('addthis:title', '').attr('addthis:description', '');


	$('.share-it').click(function(e){
		e.preventDefault();
		$('.share-block-small').toggle();
	});

	// change icons with not rated content and from allsides
	var $biasImageContainer = $('.float-box-see-more .allsides-daily-row  > .bias-image');
	$biasImageContainer.has('img[title="Bias: Not rated"]').css('width', '72px');
	$biasImageContainer.has('img[title="Bias: AllSides"]').css('width', '72px');


	/**
	* Generates "Opinion" word in the text area after selecting Type of Content - News:Opinions
	*/

	

	

	function generateOpinionIcon () {
		if ( !($('body').hasClass('ajax-processed')) ) {
			$('.allsides-daily-row').each(function(){
				if ( $(this).find('.type-of-content:contains("Opinions")').length > 0 ) {
				    if($(this).find('.news-body .opinion').length == 0){
					$(this).find('.news-body').prepend('<span class="opinion">OPINION</span>');
				    }
				}

				if ( $(this).find('.type-of-content:contains("Fact Check")').length > 0 ) {
				    if($(this).find('.news-body .opinion').length == 0){
					$(this).find('.news-body').prepend('<span class="opinion">FACT CHECK</span>');
				    }
				}

             if ( $(this).find('.type-of-content:contains("Analysis")').length > 0 ) {
				    if($(this).find('.news-body .opinion').length == 0){
					$(this).find('.news-body').prepend('<span class="opinion">ANALYSIS</span>');
				    }
				}

			if ( $(this).find('.type-of-content:contains("Humor")').length > 0 ) {
				    if($(this).find('.news-body .opinion').length == 0){
					$(this).find('.news-body').prepend('<span class="opinion">HUMOR</span>');
				    }
				}	

			});
		}
	};
	generateOpinionIcon();

	function toggleLoginBlock () {
		$('#newsitem-login-link').click(function(e){
			e.preventDefault();
			$('.newsitem-clipit-block, .newsitem-register-block').hide();
			$('#clipit-modal').css('background', 'white');
			$('.newsitem-login-block').slideDown();
		});
	};
	toggleLoginBlock(); 
	// function toggleregisterBlock () {
	// 	$('.login-register a.btn').click(function(e){
	// 		e.preventDefault();
	// 		$('.newsitem-clipit-block, .newsitem-login-block').hide();
	// 		$('.newsitem-register-block').slideDown();
	// 	});
	// };
	// toggleregisterBlock();


	/**
	* AllSides News Item page: Redirects the visitor to original article url
	*/

	$('#fix-it, .iframeholder, #floating-header .close,.open-new-page #framed').on('click', function( e ) {
		e.preventDefault();
		var articleLinkHidden = $('.article-link-hidden').text();
		window.location.href = articleLinkHidden;
	});


	$('#quotesCarousel').carousel();


	/**
	* News Navigation
	*/
	if ( !($('body').hasClass('ajax-processed')) ) {
		var $filterLi = $('#news-filter-navigation li');
		var $allGreyTabs = $('.grey-tab');
		// $('body').click(function(e) {
		// 	// hide all white stripes if there are any visible
		// 	$('.white-bottom-stripe').hide();
		// }
		$filterLi.each(function(){

			$(this).find('a').click(function(){

				var $parentLi = $(this).parents('li');
				if ( $parentLi.hasClass('open')) {
					// make all grey tabs grey again
					$allGreyTabs.css('background', 'rgb(240, 240, 240)');
					// hide all white stripes if there are any visible
					$('.white-bottom-stripe').hide();
					// show the white bottom stripe
					$parentLi.find('.white-bottom-stripe').show();
					//make the parent li white
					$parentLi.css('background', 'white');
				}
			});		
		})
		$('#edit-date-filter-value-datepicker-popup-1').trigger('click');

		// Change the wording for Select Values
		$('#edit-field-topic-tid option[value="All"]').text('All Topics');

		$('#edit-date-filter-wrapper').prepend('<div class="icons-date"></div><span class="news-filter-label news-filter-label-date">Date: </span><b class="caret"></b>');

		var regionMailchimpSubmit = $('#futureRegions #edit-submit--2');
		var regionInput = $('#futureRegions #edit-submitted-enter-the-region-here');

		regionInput.attr({
				value: 'enter region here',
				onFocus: "this.value=''"	
			});

		regionInput.focus(function() {
			$(this).css('color', '#333');
		});


		var regionEmail = $('#futureRegions #edit-submitted-sign-up-to-be-notified-when-allsides-releases-regions-and-other-new-features');

		regionEmail.attr({
				value: 'enter your email',
				onFocus: "this.value=''"	
			});

		regionEmail.focus(function() {
			$(this).css('color', '#333');
			$('#edit-submitted-i-would-like-to-receive-allsides-updates-1').attr('checked', 'checked');
		});

		


		regionMailchimpSubmit.removeClass('btn-success');
		regionMailchimpSubmit.addClass('btn-inverse');
		regionMailchimpSubmit.val('Sign Up');
	}


	// Popup Box with Agree/Disagree legend on News Source Page
	$('.agree-disagree-popup-trigger').mouseenter(function(){
		$('.agree-disagree-popup ').show();
	});
	$('.agree-disagree-popup-trigger').mouseleave(function(){
		$('.agree-disagree-popup ').hide();
	});

	// Agree/Disagree words put back in on News Source Rating Page
	$('.view-news-source-agree-disagree-results span.agree').append(' <span style="font-weight:normal;">agree</span> ');
	$('.view-news-source-agree-disagree-results span.disagree').append(' <span style="font-weight:normal;">disagree</span> ');


	// News Item Page
	$('.clip-icon-text a.flag-action').html('').text('Save to News Board');
	$('.clip-icon-text a.unflag-action').text('').text('Unsave');

	var currentTopicLink = $('.news-item-hidden .news-topic a').attr('href');
	$('.current-topic-link').attr('href', currentTopicLink);


	// Join Us Page
	$('#block-mailchimp-lists-allsides-free-form input#edit-submit--2').val('Join Us');

	//Add Headline
	var addHeadline = $('.add-headline').html();
	
	// function openAddHeadline () {
	// 	$('.btn-add-headline:not(.close-button)').click(function(a){
	// 			a.preventDefault();
	// 			var $this =  $(this);
	// 			var $addHeadlineWrapper = $this.parent('.add-headline-btn');
	// 			console.log('Add Headline + Clicked')
	// 			$('.btn-add-headline').removeClass('.close-button').text('Add Headline +');
				
				
	// 			//if( ( !($this.hasClass('close-button')) ) ) {		
	// 				if($addHeadlineWrapper.find('.add-headline-form').length<1){
	// 					$('.add-headline-form').remove();
	// 					$addHeadlineWrapper.append('<div class="add-headline-form">' + addHeadline + '</div>');
	// 					$('.add-headline-form').slideDown("slow");
	// 					$this.text('Close Ã—');
	// 					$this.addClass('close-button');	
	// 					closeAddHeadline();
	// 				}
	// 			//}	
				
	// 		});
	// }
	

	// openAddHeadline();

	// function closeAddHeadline () {
	// 	$('.btn-add-headline.close-button').click(function(a){
	// 		console.log("Close Headline Clicked");
	// 		a.preventDefault();
	// 		var $this =  $(this);
	// 		var $addHeadlineWrapper = $this.parent('.add-headline-btn');

	// 			$('.add-headline-form').remove();
	// 			$this.text('Add Headline +')
	// 			$this.removeClass('close-button');
	// 			openAddHeadline();

	// 	});
	// }

	

	// $('.btn-add-headline.close-button').click(function(a){
	// 	a.preventDefault();
	// 	var $this =  $(this);
	// 	var $addHeadlineWrapper = $this.parent('.add-headline-btn');
	// 	$this.text('Close Ã—');
	// 	$this.addClass('close-button');
	// 	if($addHeadlineWrapper.find('.add-headline-form').length<1){
	// 		$('.add-headline-form').remove();
	// 		$addHeadlineWrapper.append('<div class="add-headline-form">' + addHeadline + '</div>');
	// 		$('.add-headline-form').slideDown("slow");
	// 	}
		
	// });

	$('body.page-news .bias-trio, body.page-allsides-search-results #allsides-community-search-results').each(function(){
		$(this).append('<div class="add-headline-btn"><a type="button" data-toggle="modal" data-target="#addHeadline" href="#" class="btn btn-add-headline">Add Headline +</a></div>');
	});

	$('.topic-actions .submit-headline').attr('type','button').attr('data-toggle', 'modal').attr('data-target', '#addHeadline');

$('body.node-type-news-home .bias-trio').each(function(){
	if($(this).find('.add-headline-btn').length == 0){
		$(this).append('<div class="add-headline-btn"><a type="button" data-toggle="modal" data-target="#addHeadline" href="#" class="btn btn-add-headline">Add Headline +</a></div>');
	    }
    });

	/**
	* Elections
	*/

	function slimScrollCandidate (argument) {
		if (!$('body').hasClass('responsive-layout-full-width')) {
			$('body.section-elections .candidate-text').slimScroll({
			    height: '220px',   
			    size: '8px', 
			    railVisible: true
			});
		}
	}

	function unSlimScrollCandidate (argument) {
		if ($('body').hasClass('responsive-layout-full-width')) {
			$('body.section-elections .candidate-text').slimScroll({
			    
			});
		}
	}
	
	slimScrollCandidate();

	if ( ($('body').hasClass('section-elections')) ) {
		// var electionsBackground = $('.image-of-topic img').attr('src');
		// $('body').css('background', 'white url(' + electionsBackground + ') fixed no-repeat 50% 52px')


		
		

		// Perform Hover Actions on Multiple Link or Body Text Tiles
		$('.tile-item').each(function(){
			var $this = $(this);
			var tileLinksAmount = $this.find('.tile-links a').length;
			var firstLinkUrl = $this.find('.tile-links a:first').attr('href');
			var tileBody = $this.find('p').length;

			if(tileLinksAmount > 1 || !(tileBody == 0) ) {
					$this.mouseenter(function(){
					$this.find('.tile-hover').css('top', '0px');
				});
				$this.mouseleave(function(){
					$this.find('.tile-hover').css('top', '150px');
				});
			} else if( tileLinksAmount == 1 && tileBody == 0 ) {
				$this.find('.tile-wrapper').addClass('tile-wrapper-topic').wrapAll('<a href="' + firstLinkUrl + '" target="_blank"></a>')
			};
			
		})	

		// Perform Hover Actions on Single Link Tiles

		$('.tile-wrapper.tile-wrapper-topic').each(function(){
			$(this).mouseenter(function(){
				//$(this).find('h4').css('color','#FA8A3F').css('transition', 'all .3s ease-in-out');
				$(this).find('.tile-wrapper-overlay').addClass('tile-wrapper-topic-hover');
			});
			$(this).mouseleave(function(){
				//$(this).find('h4').css('color','white').css('transition', 'all .3s ease-in-out');
				$(this).find('.tile-wrapper-overlay').removeClass('tile-wrapper-topic-hover');
			});
			
		});

		// Display appropriate map according to the hidden Region field
		var electionRegion = $('.region-hidden').text();
		var $stateImage = $('.state-image');

		switch(electionRegion) {
		  
		  case 'Alaska':
		    $stateImage.attr('src', '/sites/all/themes/allsides/images/states/alaska.png');
		    break;
		  case 'Arkansas':
		    $stateImage.attr('src', '/sites/all/themes/allsides/images/states/arkansas.png');
		    break;
		  case 'Colorado':
		    $stateImage.attr('src', '/sites/all/themes/allsides/images/states/colorado.png');
		    break;
		  case 'Georgia':
		    $stateImage.attr('src', '/sites/all/themes/allsides/images/states/georgia.png');
		    break;
		  case 'Iowa':
		    $stateImage.attr('src', '/sites/all/themes/allsides/images/states/iowa.png');
		    break;
		  case 'Kentucky':
		    $stateImage.attr('src', '/sites/all/themes/allsides/images/states/kentucky.png');
		    break;
		  case 'Louisiana':
		    $stateImage.attr('src', '/sites/all/themes/allsides/images/states/louisiana.png');
		    break;
		  case 'Michigan':
		    $stateImage.attr('src', '/sites/all/themes/allsides/images/states/michigan.png');
		    break;
		  case 'New Hampshire':
		    $stateImage.attr('src', '/sites/all/themes/allsides/images/states/new-hampshire.png');
		    break;
		  case 'North Carolina':
		    $stateImage.attr('src', '/sites/all/themes/allsides/images/states/north-carolina.png');
		    break;
		  case 'West Virginia':
		    $stateImage.attr('src', '/sites/all/themes/allsides/images/states/west-virginia.png');
		    break;

		  default : 
		    $stateImage.attr('src', '');
		  
		}

		$('a.btn.other-elections').click(function(a){
			a.preventDefault();
			var $this =  $(this);
			
			if ( !($this.hasClass('disabled')) ) {
				var electionsMenu = $('.elections-menu-wrapper').html();
				$('.elections-topic-description').before('<div class="elections-menu-wrapper-new clearfix" >' + electionsMenu + '<div class="elections-close-button">&times;</div>');
				$('.elections-menu-wrapper-new').show();
			};

			$('.elections-close-button').click(function(){
				$this.removeClass('disabled');
				$('.elections-menu-wrapper-new').remove();
			});
			


			$this.addClass('elections-menu-open disabled');

		});

		
		// Boxes
		$("div.related-topic-wrapper:nth-child(3n), div.tile-item:nth-child(3n)").next().addClass("no-left-margin");

		// Show National News
		$('.national-news').click(function(){
			$('#election-news-national').slideToggle('fast');
			$('.local-news').toggle('fast');
		});

	} // endif 



	/**
	* New Home Page
	*/

	// Search box
	$('input.home-search').focusin(function(){
		$(this).css('opacity', '1').css('transition', 'all ease-in-out .5s').attr('placeholder', '');
	});
	$('input.home-search').focusout(function(){
		$(this).css('opacity', '.85').css('transition', 'all ease-in-out .5s').attr('placeholder', 'for political news, topics and issues');
	});

	$('.explore-issues-topics').click(function(e){
		e.preventDefault();
		$('#issues-topics-nav, ').slideToggle('fast');
	});

	// Tabs on Homepage
	$('#allsides-products a:first').tab('show');








	// Magnific Popup v1.0.0 by Dmitry Semenov
	// http://bit.ly/magnific-popup#build=inline+image+ajax+iframe+gallery+retina+imagezoom+fastclick
	(function(a){typeof define=="function"&&define.amd?define(["jquery"],a):typeof exports=="object"?a(require("jquery")):a(window.jQuery||window.Zepto)})(function(a){var b="Close",c="BeforeClose",d="AfterClose",e="BeforeAppend",f="MarkupParse",g="Open",h="Change",i="mfp",j="."+i,k="mfp-ready",l="mfp-removing",m="mfp-prevent-close",n,o=function(){},p=!!window.jQuery,q,r=a(window),s,t,u,v,w=function(a,b){n.ev.on(i+a+j,b)},x=function(b,c,d,e){var f=document.createElement("div");return f.className="mfp-"+b,d&&(f.innerHTML=d),e?c&&c.appendChild(f):(f=a(f),c&&f.appendTo(c)),f},y=function(b,c){n.ev.triggerHandler(i+b,c),n.st.callbacks&&(b=b.charAt(0).toLowerCase()+b.slice(1),n.st.callbacks[b]&&n.st.callbacks[b].apply(n,a.isArray(c)?c:[c]))},z=function(b){if(b!==v||!n.currTemplate.closeBtn)n.currTemplate.closeBtn=a(n.st.closeMarkup.replace("%title%",n.st.tClose)),v=b;return n.currTemplate.closeBtn},A=function(){a.magnificPopup.instance||(n=new o,n.init(),a.magnificPopup.instance=n)},B=function(){var a=document.createElement("p").style,b=["ms","O","Moz","Webkit"];if(a.transition!==undefined)return!0;while(b.length)if(b.pop()+"Transition"in a)return!0;return!1};o.prototype={constructor:o,init:function(){var b=navigator.appVersion;n.isIE7=b.indexOf("MSIE 7.")!==-1,n.isIE8=b.indexOf("MSIE 8.")!==-1,n.isLowIE=n.isIE7||n.isIE8,n.isAndroid=/android/gi.test(b),n.isIOS=/iphone|ipad|ipod/gi.test(b),n.supportsTransition=B(),n.probablyMobile=n.isAndroid||n.isIOS||/(Opera Mini)|Kindle|webOS|BlackBerry|(Opera Mobi)|(Windows Phone)|IEMobile/i.test(navigator.userAgent),s=a(document),n.popupsCache={}},open:function(b){var c;if(b.isObj===!1){n.items=b.items.toArray(),n.index=0;var d=b.items,e;for(c=0;c<d.length;c++){e=d[c],e.parsed&&(e=e.el[0]);if(e===b.el[0]){n.index=c;break}}}else n.items=a.isArray(b.items)?b.items:[b.items],n.index=b.index||0;if(n.isOpen){n.updateItemHTML();return}n.types=[],u="",b.mainEl&&b.mainEl.length?n.ev=b.mainEl.eq(0):n.ev=s,b.key?(n.popupsCache[b.key]||(n.popupsCache[b.key]={}),n.currTemplate=n.popupsCache[b.key]):n.currTemplate={},n.st=a.extend(!0,{},a.magnificPopup.defaults,b),n.fixedContentPos=n.st.fixedContentPos==="auto"?!n.probablyMobile:n.st.fixedContentPos,n.st.modal&&(n.st.closeOnContentClick=!1,n.st.closeOnBgClick=!1,n.st.showCloseBtn=!1,n.st.enableEscapeKey=!1),n.bgOverlay||(n.bgOverlay=x("bg").on("click"+j,function(){n.close()}),n.wrap=x("wrap").attr("tabindex",-1).on("click"+j,function(a){n._checkIfClose(a.target)&&n.close()}),n.container=x("container",n.wrap)),n.contentContainer=x("content"),n.st.preloader&&(n.preloader=x("preloader",n.container,n.st.tLoading));var h=a.magnificPopup.modules;for(c=0;c<h.length;c++){var i=h[c];i=i.charAt(0).toUpperCase()+i.slice(1),n["init"+i].call(n)}y("BeforeOpen"),n.st.showCloseBtn&&(n.st.closeBtnInside?(w(f,function(a,b,c,d){c.close_replaceWith=z(d.type)}),u+=" mfp-close-btn-in"):n.wrap.append(z())),n.st.alignTop&&(u+=" mfp-align-top"),n.fixedContentPos?n.wrap.css({overflow:n.st.overflowY,overflowX:"hidden",overflowY:n.st.overflowY}):n.wrap.css({top:r.scrollTop(),position:"absolute"}),(n.st.fixedBgPos===!1||n.st.fixedBgPos==="auto"&&!n.fixedContentPos)&&n.bgOverlay.css({height:s.height(),position:"absolute"}),n.st.enableEscapeKey&&s.on("keyup"+j,function(a){a.keyCode===27&&n.close()}),r.on("resize"+j,function(){n.updateSize()}),n.st.closeOnContentClick||(u+=" mfp-auto-cursor"),u&&n.wrap.addClass(u);var l=n.wH=r.height(),m={};if(n.fixedContentPos&&n._hasScrollBar(l)){var o=n._getScrollbarSize();o&&(m.marginRight=o)}n.fixedContentPos&&(n.isIE7?a("body, html").css("overflow","hidden"):m.overflow="hidden");var p=n.st.mainClass;return n.isIE7&&(p+=" mfp-ie7"),p&&n._addClassToMFP(p),n.updateItemHTML(),y("BuildControls"),a("html").css(m),n.bgOverlay.add(n.wrap).prependTo(n.st.prependTo||a(document.body)),n._lastFocusedEl=document.activeElement,setTimeout(function(){n.content?(n._addClassToMFP(k),n._setFocus()):n.bgOverlay.addClass(k),s.on("focusin"+j,n._onFocusIn)},16),n.isOpen=!0,n.updateSize(l),y(g),b},close:function(){if(!n.isOpen)return;y(c),n.isOpen=!1,n.st.removalDelay&&!n.isLowIE&&n.supportsTransition?(n._addClassToMFP(l),setTimeout(function(){n._close()},n.st.removalDelay)):n._close()},_close:function(){y(b);var c=l+" "+k+" ";n.bgOverlay.detach(),n.wrap.detach(),n.container.empty(),n.st.mainClass&&(c+=n.st.mainClass+" "),n._removeClassFromMFP(c);if(n.fixedContentPos){var e={marginRight:""};n.isIE7?a("body, html").css("overflow",""):e.overflow="",a("html").css(e)}s.off("keyup"+j+" focusin"+j),n.ev.off(j),n.wrap.attr("class","mfp-wrap").removeAttr("style"),n.bgOverlay.attr("class","mfp-bg"),n.container.attr("class","mfp-container"),n.st.showCloseBtn&&(!n.st.closeBtnInside||n.currTemplate[n.currItem.type]===!0)&&n.currTemplate.closeBtn&&n.currTemplate.closeBtn.detach(),n._lastFocusedEl&&a(n._lastFocusedEl).focus(),n.currItem=null,n.content=null,n.currTemplate=null,n.prevHeight=0,y(d)},updateSize:function(a){if(n.isIOS){var b=document.documentElement.clientWidth/window.innerWidth,c=window.innerHeight*b;n.wrap.css("height",c),n.wH=c}else n.wH=a||r.height();n.fixedContentPos||n.wrap.css("height",n.wH),y("Resize")},updateItemHTML:function(){var b=n.items[n.index];n.contentContainer.detach(),n.content&&n.content.detach(),b.parsed||(b=n.parseEl(n.index));var c=b.type;y("BeforeChange",[n.currItem?n.currItem.type:"",c]),n.currItem=b;if(!n.currTemplate[c]){var d=n.st[c]?n.st[c].markup:!1;y("FirstMarkupParse",d),d?n.currTemplate[c]=a(d):n.currTemplate[c]=!0}t&&t!==b.type&&n.container.removeClass("mfp-"+t+"-holder");var e=n["get"+c.charAt(0).toUpperCase()+c.slice(1)](b,n.currTemplate[c]);n.appendContent(e,c),b.preloaded=!0,y(h,b),t=b.type,n.container.prepend(n.contentContainer),y("AfterChange")},appendContent:function(a,b){n.content=a,a?n.st.showCloseBtn&&n.st.closeBtnInside&&n.currTemplate[b]===!0?n.content.find(".mfp-close").length||n.content.append(z()):n.content=a:n.content="",y(e),n.container.addClass("mfp-"+b+"-holder"),n.contentContainer.append(n.content)},parseEl:function(b){var c=n.items[b],d;c.tagName?c={el:a(c)}:(d=c.type,c={data:c,src:c.src});if(c.el){var e=n.types;for(var f=0;f<e.length;f++)if(c.el.hasClass("mfp-"+e[f])){d=e[f];break}c.src=c.el.attr("data-mfp-src"),c.src||(c.src=c.el.attr("href"))}return c.type=d||n.st.type||"inline",c.index=b,c.parsed=!0,n.items[b]=c,y("ElementParse",c),n.items[b]},addGroup:function(a,b){var c=function(c){c.mfpEl=this,n._openClick(c,a,b)};b||(b={});var d="click.magnificPopup";b.mainEl=a,b.items?(b.isObj=!0,a.off(d).on(d,c)):(b.isObj=!1,b.delegate?a.off(d).on(d,b.delegate,c):(b.items=a,a.off(d).on(d,c)))},_openClick:function(b,c,d){var e=d.midClick!==undefined?d.midClick:a.magnificPopup.defaults.midClick;if(!e&&(b.which===2||b.ctrlKey||b.metaKey))return;var f=d.disableOn!==undefined?d.disableOn:a.magnificPopup.defaults.disableOn;if(f)if(a.isFunction(f)){if(!f.call(n))return!0}else if(r.width()<f)return!0;b.type&&(b.preventDefault(),n.isOpen&&b.stopPropagation()),d.el=a(b.mfpEl),d.delegate&&(d.items=c.find(d.delegate)),n.open(d)},updateStatus:function(a,b){if(n.preloader){q!==a&&n.container.removeClass("mfp-s-"+q),!b&&a==="loading"&&(b=n.st.tLoading);var c={status:a,text:b};y("UpdateStatus",c),a=c.status,b=c.text,n.preloader.html(b),n.preloader.find("a").on("click",function(a){a.stopImmediatePropagation()}),n.container.addClass("mfp-s-"+a),q=a}},_checkIfClose:function(b){if(a(b).hasClass(m))return;var c=n.st.closeOnContentClick,d=n.st.closeOnBgClick;if(c&&d)return!0;if(!n.content||a(b).hasClass("mfp-close")||n.preloader&&b===n.preloader[0])return!0;if(b!==n.content[0]&&!a.contains(n.content[0],b)){if(d&&a.contains(document,b))return!0}else if(c)return!0;return!1},_addClassToMFP:function(a){n.bgOverlay.addClass(a),n.wrap.addClass(a)},_removeClassFromMFP:function(a){this.bgOverlay.removeClass(a),n.wrap.removeClass(a)},_hasScrollBar:function(a){return(n.isIE7?s.height():document.body.scrollHeight)>(a||r.height())},_setFocus:function(){(n.st.focus?n.content.find(n.st.focus).eq(0):n.wrap).focus()},_onFocusIn:function(b){if(b.target!==n.wrap[0]&&!a.contains(n.wrap[0],b.target))return n._setFocus(),!1},_parseMarkup:function(b,c,d){var e;d.data&&(c=a.extend(d.data,c)),y(f,[b,c,d]),a.each(c,function(a,c){if(c===undefined||c===!1)return!0;e=a.split("_");if(e.length>1){var d=b.find(j+"-"+e[0]);if(d.length>0){var f=e[1];f==="replaceWith"?d[0]!==c[0]&&d.replaceWith(c):f==="img"?d.is("img")?d.attr("src",c):d.replaceWith('<img src="'+c+'" class="'+d.attr("class")+'" />'):d.attr(e[1],c)}}else b.find(j+"-"+a).html(c)})},_getScrollbarSize:function(){if(n.scrollbarSize===undefined){var a=document.createElement("div");a.style.cssText="width: 99px; height: 99px; overflow: scroll; position: absolute; top: -9999px;",document.body.appendChild(a),n.scrollbarSize=a.offsetWidth-a.clientWidth,document.body.removeChild(a)}return n.scrollbarSize}},a.magnificPopup={instance:null,proto:o.prototype,modules:[],open:function(b,c){return A(),b?b=a.extend(!0,{},b):b={},b.isObj=!0,b.index=c||0,this.instance.open(b)},close:function(){return a.magnificPopup.instance&&a.magnificPopup.instance.close()},registerModule:function(b,c){c.options&&(a.magnificPopup.defaults[b]=c.options),a.extend(this.proto,c.proto),this.modules.push(b)},defaults:{disableOn:0,key:null,midClick:!1,mainClass:"",preloader:!0,focus:"",closeOnContentClick:!1,closeOnBgClick:!0,closeBtnInside:!0,showCloseBtn:!0,enableEscapeKey:!0,modal:!1,alignTop:!1,removalDelay:0,prependTo:null,fixedContentPos:"auto",fixedBgPos:"auto",overflowY:"auto",closeMarkup:'<button title="%title%" type="button" class="mfp-close">&times;</button>',tClose:"Close (Esc)",tLoading:"Loading..."}},a.fn.magnificPopup=function(b){A();var c=a(this);if(typeof b=="string")if(b==="open"){var d,e=p?c.data("magnificPopup"):c[0].magnificPopup,f=parseInt(arguments[1],10)||0;e.items?d=e.items[f]:(d=c,e.delegate&&(d=d.find(e.delegate)),d=d.eq(f)),n._openClick({mfpEl:d},c,e)}else n.isOpen&&n[b].apply(n,Array.prototype.slice.call(arguments,1));else b=a.extend(!0,{},b),p?c.data("magnificPopup",b):c[0].magnificPopup=b,n.addGroup(c,b);return c};var C="inline",D,E,F,G=function(){F&&(E.after(F.addClass(D)).detach(),F=null)};a.magnificPopup.registerModule(C,{options:{hiddenClass:"hide",markup:"",tNotFound:"Content not found"},proto:{initInline:function(){n.types.push(C),w(b+"."+C,function(){G()})},getInline:function(b,c){G();if(b.src){var d=n.st.inline,e=a(b.src);if(e.length){var f=e[0].parentNode;f&&f.tagName&&(E||(D=d.hiddenClass,E=x(D),D="mfp-"+D),F=e.after(E).detach().removeClass(D)),n.updateStatus("ready")}else n.updateStatus("error",d.tNotFound),e=a("<div>");return b.inlineElement=e,e}return n.updateStatus("ready"),n._parseMarkup(c,{},b),c}}});var H="ajax",I,J=function(){I&&a(document.body).removeClass(I)},K=function(){J(),n.req&&n.req.abort()};a.magnificPopup.registerModule(H,{options:{settings:null,cursor:"mfp-ajax-cur",tError:'<a href="%url%">The content</a> could not be loaded.'},proto:{initAjax:function(){n.types.push(H),I=n.st.ajax.cursor,w(b+"."+H,K),w("BeforeChange."+H,K)},getAjax:function(b){I&&a(document.body).addClass(I),n.updateStatus("loading");var c=a.extend({url:b.src,success:function(c,d,e){var f={data:c,xhr:e};y("ParseAjax",f),n.appendContent(a(f.data),H),b.finished=!0,J(),n._setFocus(),setTimeout(function(){n.wrap.addClass(k)},16),n.updateStatus("ready"),y("AjaxContentAdded")},error:function(){J(),b.finished=b.loadError=!0,n.updateStatus("error",n.st.ajax.tError.replace("%url%",b.src))}},n.st.ajax.settings);return n.req=a.ajax(c),""}}});var L,M=function(b){if(b.data&&b.data.title!==undefined)return b.data.title;var c=n.st.image.titleSrc;if(c){if(a.isFunction(c))return c.call(n,b);if(b.el)return b.el.attr(c)||""}return""};a.magnificPopup.registerModule("image",{options:{markup:'<div class="mfp-figure"><div class="mfp-close"></div><figure><div class="mfp-img"></div><figcaption><div class="mfp-bottom-bar"><div class="mfp-title"></div><div class="mfp-counter"></div></div></figcaption></figure></div>',cursor:"mfp-zoom-out-cur",titleSrc:"title",verticalFit:!0,tError:'<a href="%url%">The image</a> could not be loaded.'},proto:{initImage:function(){var c=n.st.image,d=".image";n.types.push("image"),w(g+d,function(){n.currItem.type==="image"&&c.cursor&&a(document.body).addClass(c.cursor)}),w(b+d,function(){c.cursor&&a(document.body).removeClass(c.cursor),r.off("resize"+j)}),w("Resize"+d,n.resizeImage),n.isLowIE&&w("AfterChange",n.resizeImage)},resizeImage:function(){var a=n.currItem;if(!a||!a.img)return;if(n.st.image.verticalFit){var b=0;n.isLowIE&&(b=parseInt(a.img.css("padding-top"),10)+parseInt(a.img.css("padding-bottom"),10)),a.img.css("max-height",n.wH-b)}},_onImageHasSize:function(a){a.img&&(a.hasSize=!0,L&&clearInterval(L),a.isCheckingImgSize=!1,y("ImageHasSize",a),a.imgHidden&&(n.content&&n.content.removeClass("mfp-loading"),a.imgHidden=!1))},findImageSize:function(a){var b=0,c=a.img[0],d=function(e){L&&clearInterval(L),L=setInterval(function(){if(c.naturalWidth>0){n._onImageHasSize(a);return}b>200&&clearInterval(L),b++,b===3?d(10):b===40?d(50):b===100&&d(500)},e)};d(1)},getImage:function(b,c){var d=0,e=function(){b&&(b.img[0].complete?(b.img.off(".mfploader"),b===n.currItem&&(n._onImageHasSize(b),n.updateStatus("ready")),b.hasSize=!0,b.loaded=!0,y("ImageLoadComplete")):(d++,d<200?setTimeout(e,100):f()))},f=function(){b&&(b.img.off(".mfploader"),b===n.currItem&&(n._onImageHasSize(b),n.updateStatus("error",g.tError.replace("%url%",b.src))),b.hasSize=!0,b.loaded=!0,b.loadError=!0)},g=n.st.image,h=c.find(".mfp-img");if(h.length){var i=document.createElement("img");i.className="mfp-img",b.el&&b.el.find("img").length&&(i.alt=b.el.find("img").attr("alt")),b.img=a(i).on("load.mfploader",e).on("error.mfploader",f),i.src=b.src,h.is("img")&&(b.img=b.img.clone()),i=b.img[0],i.naturalWidth>0?b.hasSize=!0:i.width||(b.hasSize=!1)}return n._parseMarkup(c,{title:M(b),img_replaceWith:b.img},b),n.resizeImage(),b.hasSize?(L&&clearInterval(L),b.loadError?(c.addClass("mfp-loading"),n.updateStatus("error",g.tError.replace("%url%",b.src))):(c.removeClass("mfp-loading"),n.updateStatus("ready")),c):(n.updateStatus("loading"),b.loading=!0,b.hasSize||(b.imgHidden=!0,c.addClass("mfp-loading"),n.findImageSize(b)),c)}}});var N,O=function(){return N===undefined&&(N=document.createElement("p").style.MozTransform!==undefined),N};a.magnificPopup.registerModule("zoom",{options:{enabled:!1,easing:"ease-in-out",duration:300,opener:function(a){return a.is("img")?a:a.find("img")}},proto:{initZoom:function(){var a=n.st.zoom,d=".zoom",e;if(!a.enabled||!n.supportsTransition)return;var f=a.duration,g=function(b){var c=b.clone().removeAttr("style").removeAttr("class").addClass("mfp-animated-image"),d="all "+a.duration/1e3+"s "+a.easing,e={position:"fixed",zIndex:9999,left:0,top:0,"-webkit-backface-visibility":"hidden"},f="transition";return e["-webkit-"+f]=e["-moz-"+f]=e["-o-"+f]=e[f]=d,c.css(e),c},h=function(){n.content.css("visibility","visible")},i,j;w("BuildControls"+d,function(){if(n._allowZoom()){clearTimeout(i),n.content.css("visibility","hidden"),e=n._getItemToZoom();if(!e){h();return}j=g(e),j.css(n._getOffset()),n.wrap.append(j),i=setTimeout(function(){j.css(n._getOffset(!0)),i=setTimeout(function(){h(),setTimeout(function(){j.remove(),e=j=null,y("ZoomAnimationEnded")},16)},f)},16)}}),w(c+d,function(){if(n._allowZoom()){clearTimeout(i),n.st.removalDelay=f;if(!e){e=n._getItemToZoom();if(!e)return;j=g(e)}j.css(n._getOffset(!0)),n.wrap.append(j),n.content.css("visibility","hidden"),setTimeout(function(){j.css(n._getOffset())},16)}}),w(b+d,function(){n._allowZoom()&&(h(),j&&j.remove(),e=null)})},_allowZoom:function(){return n.currItem.type==="image"},_getItemToZoom:function(){return n.currItem.hasSize?n.currItem.img:!1},_getOffset:function(b){var c;b?c=n.currItem.img:c=n.st.zoom.opener(n.currItem.el||n.currItem);var d=c.offset(),e=parseInt(c.css("padding-top"),10),f=parseInt(c.css("padding-bottom"),10);d.top-=a(window).scrollTop()-e;var g={width:c.width(),height:(p?c.innerHeight():c[0].offsetHeight)-f-e};return O()?g["-moz-transform"]=g.transform="translate("+d.left+"px,"+d.top+"px)":(g.left=d.left,g.top=d.top),g}}});var P="iframe",Q="//about:blank",R=function(a){if(n.currTemplate[P]){var b=n.currTemplate[P].find("iframe");b.length&&(a||(b[0].src=Q),n.isIE8&&b.css("display",a?"block":"none"))}};a.magnificPopup.registerModule(P,{options:{markup:'<div class="mfp-iframe-scaler"><div class="mfp-close"></div><iframe class="mfp-iframe" src="//about:blank" frameborder="0" allowfullscreen></iframe></div>',srcAction:"iframe_src",patterns:{youtube:{index:"youtube.com",id:"v=",src:"//www.youtube.com/embed/%id%?autoplay=1"},vimeo:{index:"vimeo.com/",id:"/",src:"//player.vimeo.com/video/%id%?autoplay=1"},gmaps:{index:"//maps.google.",src:"%id%&output=embed"}}},proto:{initIframe:function(){n.types.push(P),w("BeforeChange",function(a,b,c){b!==c&&(b===P?R():c===P&&R(!0))}),w(b+"."+P,function(){R()})},getIframe:function(b,c){var d=b.src,e=n.st.iframe;a.each(e.patterns,function(){if(d.indexOf(this.index)>-1)return this.id&&(typeof this.id=="string"?d=d.substr(d.lastIndexOf(this.id)+this.id.length,d.length):d=this.id.call(this,d)),d=this.src.replace("%id%",d),!1});var f={};return e.srcAction&&(f[e.srcAction]=d),n._parseMarkup(c,f,b),n.updateStatus("ready"),c}}});var S=function(a){var b=n.items.length;return a>b-1?a-b:a<0?b+a:a},T=function(a,b,c){return a.replace(/%curr%/gi,b+1).replace(/%total%/gi,c)};a.magnificPopup.registerModule("gallery",{options:{enabled:!1,arrowMarkup:'<button title="%title%" type="button" class="mfp-arrow mfp-arrow-%dir%"></button>',preload:[0,2],navigateByImgClick:!0,arrows:!0,tPrev:"Previous (Left arrow key)",tNext:"Next (Right arrow key)",tCounter:"%curr% of %total%"},proto:{initGallery:function(){var c=n.st.gallery,d=".mfp-gallery",e=Boolean(a.fn.mfpFastClick);n.direction=!0;if(!c||!c.enabled)return!1;u+=" mfp-gallery",w(g+d,function(){c.navigateByImgClick&&n.wrap.on("click"+d,".mfp-img",function(){if(n.items.length>1)return n.next(),!1}),s.on("keydown"+d,function(a){a.keyCode===37?n.prev():a.keyCode===39&&n.next()})}),w("UpdateStatus"+d,function(a,b){b.text&&(b.text=T(b.text,n.currItem.index,n.items.length))}),w(f+d,function(a,b,d,e){var f=n.items.length;d.counter=f>1?T(c.tCounter,e.index,f):""}),w("BuildControls"+d,function(){if(n.items.length>1&&c.arrows&&!n.arrowLeft){var b=c.arrowMarkup,d=n.arrowLeft=a(b.replace(/%title%/gi,c.tPrev).replace(/%dir%/gi,"left")).addClass(m),f=n.arrowRight=a(b.replace(/%title%/gi,c.tNext).replace(/%dir%/gi,"right")).addClass(m),g=e?"mfpFastClick":"click";d[g](function(){n.prev()}),f[g](function(){n.next()}),n.isIE7&&(x("b",d[0],!1,!0),x("a",d[0],!1,!0),x("b",f[0],!1,!0),x("a",f[0],!1,!0)),n.container.append(d.add(f))}}),w(h+d,function(){n._preloadTimeout&&clearTimeout(n._preloadTimeout),n._preloadTimeout=setTimeout(function(){n.preloadNearbyImages(),n._preloadTimeout=null},16)}),w(b+d,function(){s.off(d),n.wrap.off("click"+d),n.arrowLeft&&e&&n.arrowLeft.add(n.arrowRight).destroyMfpFastClick(),n.arrowRight=n.arrowLeft=null})},next:function(){n.direction=!0,n.index=S(n.index+1),n.updateItemHTML()},prev:function(){n.direction=!1,n.index=S(n.index-1),n.updateItemHTML()},goTo:function(a){n.direction=a>=n.index,n.index=a,n.updateItemHTML()},preloadNearbyImages:function(){var a=n.st.gallery.preload,b=Math.min(a[0],n.items.length),c=Math.min(a[1],n.items.length),d;for(d=1;d<=(n.direction?c:b);d++)n._preloadItem(n.index+d);for(d=1;d<=(n.direction?b:c);d++)n._preloadItem(n.index-d)},_preloadItem:function(b){b=S(b);if(n.items[b].preloaded)return;var c=n.items[b];c.parsed||(c=n.parseEl(b)),y("LazyLoad",c),c.type==="image"&&(c.img=a('<img class="mfp-img" />').on("load.mfploader",function(){c.hasSize=!0}).on("error.mfploader",function(){c.hasSize=!0,c.loadError=!0,y("LazyLoadError",c)}).attr("src",c.src)),c.preloaded=!0}}});var U="retina";a.magnificPopup.registerModule(U,{options:{replaceSrc:function(a){return a.src.replace(/\.\w+$/,function(a){return"@2x"+a})},ratio:1},proto:{initRetina:function(){if(window.devicePixelRatio>1){var a=n.st.retina,b=a.ratio;b=isNaN(b)?b():b,b>1&&(w("ImageHasSize."+U,function(a,c){c.img.css({"max-width":c.img[0].naturalWidth/b,width:"100%"})}),w("ElementParse."+U,function(c,d){d.src=a.replaceSrc(d,b)}))}}}}),function(){var b=1e3,c="ontouchstart"in window,d=function(){r.off("touchmove"+f+" touchend"+f)},e="mfpFastClick",f="."+e;a.fn.mfpFastClick=function(e){return a(this).each(function(){var g=a(this),h;if(c){var i,j,k,l,m,n;g.on("touchstart"+f,function(a){l=!1,n=1,m=a.originalEvent?a.originalEvent.touches[0]:a.touches[0],j=m.clientX,k=m.clientY,r.on("touchmove"+f,function(a){m=a.originalEvent?a.originalEvent.touches:a.touches,n=m.length,m=m[0];if(Math.abs(m.clientX-j)>10||Math.abs(m.clientY-k)>10)l=!0,d()}).on("touchend"+f,function(a){d();if(l||n>1)return;h=!0,a.preventDefault(),clearTimeout(i),i=setTimeout(function(){h=!1},b),e()})})}g.on("click"+f,function(){h||e()})})},a.fn.destroyMfpFastClick=function(){a(this).off("touchstart"+f+" click"+f),c&&r.off("touchmove"+f+" touchend"+f)}}(),A()})

	


	$('.video-launch').magnificPopup({
	    items: {
	      src: 'https://www.youtube.com/watch?v=MVhResz5gps'
	    },
	    type: 'iframe' // this is default type
	});

	//if( $('body').hasClass('section-region') ) {

		var regionAdminBlock = $('.region-admin .allsides-daily-administrative-nav-inner .row-secondary-links');

		regionAdminBlock.append('<a class="flush-page-cache-button" href="">Flush Cache to see your work appear</a>');


		$(document).on('mouseenter', '.flush-page-cache-button', function(){

		    var flushPageCache = $('#admin-menu-icon li ul li:nth-child(2) > a').attr('href');
		    console.log(flushPageCache);
		    $('.flush-page-cache-button').attr('href', flushPageCache);

		});

	//}

	// Change Path Description for Utah Admins
	$('body.role-admin-regional.page-admin-structure-block-manage-block-47 #edit-path .description').html('<p>To make Block visible, type <strong>region/united-states/utah</strong> into the box. To hide it, delete the path, that is leave the box blank.</p>');

	// Preselect Utah for Utah Admins
	$('body.role-admin-utah form.node-news_source-form #edit-field-region-und').val('153');


	/**
	* Source Page
	*/

	// Scroll to bottom

	$('.bias-details-link').click(function(e){
		e.preventDefault();
		$("html, body").animate({ scrollTop:$('.source-page-bias-explanation').offset().top -60  }, "medium");
	});


	/**
	* Sticky Nav
	*/

	var stickyNavTop = 108;
	$('.navbar-allsides-sticky .menu-get-balanced-news > a').text('NEWS');
	$('.navbar-allsides-sticky .menu-rate-bias > a').text('BIAS');
	$('.navbar-allsides-sticky .menu-talk-it-out > a').text('DISCUSS');
	$('.navbar-allsides-sticky .menu-item-search > a').text('SEARCH');
	$('.navbar-allsides-sticky .menu-item-donate > a').text('DONATE');
	$('.navbar-allsides-sticky .menu-dictionary > a').text('DICTIONARY');
	$('.navbar-allsides-sticky .menu-our-mission > a').text('MISSION');

	var stickyNav = function(){
		var scrollTop = $(window).scrollTop() + 00;
     
		if (scrollTop > stickyNavTop) { 
		    $('.navbar-allsides-sticky').addClass('sticky');
		} else {
		    $('.navbar-allsides-sticky').removeClass('sticky'); 
		}
	};
	 
	stickyNav();
	 
	$(window).scroll(function() {
	  stickyNav();
	  //$('.dropdown-menu').hide();
	  //$('.main-menu-wrapper').hide();
	});

	$('.navbar-allsides-sticky .left-center-right-search').click(function(e){
		e.preventDefault();
		$('.dropdown-search-wrapper').css('position', 'fixed');
		$('.dropdown-search-wrapper').show();
		$('#edit-search-api-views-fulltext').focus();
	});

	
	// addthis.init();





	/**
	* Load TOD on Topic Page
	*/

	//$('#result').load('/on-demand/index22.php?q=agriculture #main-content');

	// function callIframe(url, callback) {
	//     $(document.body).append('<IFRAME id="myId" ...>');
	//     $('iframe#myId').attr('src', url);

	//     $('iframe#myId').load(function() {
	//         callback(this);
	//     });
	// }



	

	// $('iframe#tod-iframe-topic').load(function() {
	//     // callback(this);
	//     var todHeight = $('iframe').contents().find('html').html();
	//     console.log(todHeight);
	// });

// $('iframe').contents().find('html').ready(function(){
// 	var todHeight = $('iframe').contents().find('#main-content').html();
// 	console.log(todHeight);
// 	    alert('loaded!');
// 	});

	
	



	   










    } 
  };



  Drupal.behaviors.mainNavbar = {
    attach: function (context, settings) {
    	/**
    	* AllSides Main Navigation
    	*/

    	//$('#news-filter-navigation').show();

    	$('.promo-block .close').click(function(){
    		$('body.page-home #wrapper').css('margin-top', '50px');
    	});

    	/**
    	* Date Conversion
    	*/
    	// function convertDate () {
    	// 	var displayedDate = $('#edit-date-filter-value-datepicker-popup-1').val();
    	// 	console.log(displayedDate);

    	// 	var date = new Date(displayedDate);
    	// 	var date_str = moment(date).format("MMM D, YYYY");
    	// 	console.log(date_str);
    	// 	$('#edit-date-filter-value-datepicker-popup-1').val(date_str);
    	// }
    	// convertDate();

    	// function convertDateBack () {
    	// 	var displayedDate = $('#edit-date-filter-value-datepicker-popup-1').val();

    	// 	var date = new Date(displayedDate);
    	// 	var date_str = moment(date).format("YYYY-MM-DD");
    	// 	console.log(date_str);
    	// 	$('#edit-date-filter-value-datepicker-popup-1').val(date_str);
    	// }


    	// $('.ui-datepicker-calendar td a').click(function(){
    	// 	console.log("Clicked TD A");
    	// 	convertDate();
    	// });

    	// $('#edit-field-topic-tid--11 option').click(function(){
    	// 	convertDateBack();
    	// });



    	

    	// $('.date-wrapper').click(function() {
    	// 	$('#edit-date-filter-value-datepicker-popup-1').trigger('click');
    	// });

    	// $('.topic-wrapper').click(function() {
    	// 	$('#edit-field-topic-tid').trigger('click');
    	// });


		// Temporary Send the News Sources and Bias to News Source Page instead of widget
		$('.allsides-daily-row, .feature-thumbs').each(function(){
			var $this = $(this);
			var newsSourceLink = $this.find('.rating-box-top a, .story-id-single .news-source a').attr('href');
			if(typeof newsSourceLink != 'undefined'){
			    $this.find('.trigger-area').click(function(){
				    window.location.href = newsSourceLink;
			    })
		        }
		});

		// function imgError(image) {
		//     image.onerror = "";
		//     image.src = "http://localhost.allsidespant:8082/sites/default/files/styles/news-thumb/public/default_images/news-placeholder.png";
		//     return true;
		// }
		// var images = $('img');
		// imgError(images);

		

		
		//ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢
		//ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½?
		//ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“


		//Fox NewsÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Ed Henry Challenges Obama on SyriaÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢s Chemical Weapons ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½? and Obama Redefines His ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“Red LineÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢
		var searchClass = 'search-closed';
		
		// Toggle Search window

		$('.dropdown-search, .search-close').not('.left-center-right-search-mobile').click(function(){
				
				if ( searchClass == 'search-closed' ) {
					$('.dropdown-search-wrapper').slideDown('2000', "easeOutQuint", function () {
							searchClass = 'search-open';
							console.log('openSearch Value: ' + searchClass);
						    console.log('openSearch Ran');
						    
		        								
		    		});
				}
				if ( searchClass == 'search-open' ) {
					$('.dropdown-search-wrapper').slideUp('2000', "easeOutQuint", function () {
				    		searchClass = 'search-closed';
			        		console.log('closeSearch Value: ' + searchClass);
			        		console.log('closeSearch Ran');
		        								
		    		});
				}
		});
		

		// On Explore-Issues Page, wrap the cards in links
		
		var $topicCard = $('body.page-explore-issues .issue-card > .views-field');
		$topicCard.each(function(){

			
			var topicPath =  $(this).find('.issue-title a').attr('href');
			$(this).wrapAll('<a href="' + topicPath + '"></a>');
		});
		

		$('#navbar-allsides .dropdown').mouseover(function(){
			$('.dropdown-search-wrapper').hide();
			$('.dropdown-search').removeClass('open');
		});


		// Hover buttons for logged out users
		
		var $newsCard = $('body.not-logged-in.page-news  .allsides-daily-row, body.not-logged-in.node-type-news-home .allsides-daily-row, body.not-logged-in.section-topics .allsides-daily-row, body.logged-in .allsides-daily-row');

		$newsCard.each(function(){
			var $this = $(this);
			var articleLink = $this.find('.news-title a').attr('href');
			var articleTitle = $this.find('.news-title a').text();
			var articleDescription = $this.find('.news-body p').text();

			var articleImage = $this.find('.news-image img').attr('src');

			var articleImageSplit = "";
			var articleMedia = "";

			if ( articleImage !== undefined) {
				var articleImageSplit =  articleImage.split( '/' );
				articleImageSplit.splice(6,3);
				var articleMedia = articleImageSplit.join("/");
			}
			
		/*	if(jQuery('body').hasClass('logged-in')){
			    if($this.find('div').hasClass('clip')){
				if($this.find('.unclip-go').length == 0)
				$this.append('<a class="hover-button unclip-go" href="' + articleLink + '" class="go-button" role="button" target="_blank"><i class="fa fa-arrow-right" aria-hidden="true"></i>Full Article</a>');
			    }else{
				if($this.find('.unclip-go').length == 0 && $this.find('.mypage_story').length == 0)
				$this.append('<a class="hover-button unclip-go" href="' + articleLink + '" class="go-button" role="button" target="_blank"><i class="fa fa-arrow-right" aria-hidden="true"></i>Full Article</a>');
			    }
			}else{
			    if($this.find('.custom-hover-section-allsides').length > 0){

			    }else{
					if($this.find('.unclip-go').length == 0 && $this.find('.unclip-save').length == 0){
						$this.append('<a class="hover-button unclip-go" href="' + articleLink + '" class="go-button" role="button" target="_blank"><i class="fa fa-arrow-right" aria-hidden="true"></i>Full Article</a>');
						$this.append('<a class="hover-button unclip-save" href="#clipit-modal" role="button" class="flag" data-toggle="modal"><i class="fa fa-floppy-o" aria-hidden="true"></i>Save</a><a class="hover-button unclip-mypage" href="#my-front-page-modal" role="button" class="flag" data-toggle="modal"><i class="fa fa-plus" aria-hidden="true"></i>My Front Page</a>');
					}
			    }
			}*/
			if($this.find('.source-area .unclip-bias').length){
			    
			}else{
			    $this.find('.source-area').append('<a class="hover-button unclip-bias" href="' + articleLink + '" class="go-button" role="button"><i class="fa fa-star" aria-hidden="true"></i>Rate Bias</a>');
			}
			$this.mouseenter(function(){
				//$this.find('.unclip-save, .unclip-go, .unclip-bias, .unclip-mypage').addClass('shown');
				//$this.find('.source-area').addClass('news-source-area-hover');
				//$this.find('.source-area').addClass('source-area-hover');
			})
			$this.mouseleave(function(){
				//$this.find('.unclip-save, .unclip-go, .unclip-bias, .unclip-mypage').removeClass('shown');
				//$this.find('.source-area').removeClass('news-source-area-hover');
				//$this.find('.source-area').removeClass('source-area-hover');
			})

		})
	

    }



  };


    Drupal.behaviors.replaceBrokenImagesAndText = {
      attach: function (context, settings) {

      	

      	$.fn.replaceText = function( search, replace, text_only ) {
      	  return this.each(function(){
      	    var node = this.firstChild,
      	      val,
      	      new_val,
      	      remove = [];
      	    if ( node ) {
      	      do {
      	        if ( node.nodeType === 3 ) {
      	          val = node.nodeValue;
      	          new_val = val.replace( search, replace );
      	          if ( new_val !== val ) {
      	            if ( !text_only && /</.test( new_val ) ) {
      	              $(node).before( new_val );
      	              remove.push( node );
      	            } else {
      	              node.nodeValue = new_val;
      	            }
      	          }
      	        }
      	      } while ( node = node.nextSibling );
      	    }
      	    remove.length && $(remove).remove();
      	  });
      	};

      	$("body *").replaceText( /ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢/gi, "â€™" );
      	$("body *").replaceText( /ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½?/gi, "â€”" );
      	$("body *").replaceText( /ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“/gi, "â€˜" );



      	// Grab value from search box and apply to TOD
      	var searchValue = $('#edit-search-api-views-fulltext').val();
      	$('#tod-iframe-topic').attr('src', 'http://test-allsides.gotpantheon.com/on-demand/index22.php?q=' + searchValue);

      	$('#edit-created-1 a').attr('src', '/allsides-search-results?search_api_views_fulltext=' + searchValue + '&amp;created=1&amp;submit_x=0&amp;submit_y=0');
      	$('#edit-created-2 a').attr('src', '/allsides-search-results?search_api_views_fulltext=' + searchValue + '&amp;created=2&amp;submit_x=0&amp;submit_y=0');
      	$('#edit-created-3 a').attr('src', '/allsides-search-results?search_api_views_fulltext=' + searchValue + '&amp;created=3&amp;submit_x=0&amp;submit_y=0');



      	$("img").error(function () {
      	  //$(this).unbind("error").attr("src", "/sites/default/files/styles/news-thumb/public/default_images/news-placeholder.png");
      	  $(this).parent('.news-image').remove();
      	});
      	


      }
    };



 /* Drupal.behaviors.newMainMenu = {
    attach: function (context, settings) {

    	var $newMainMenu = $('.nmm .new-menu, .navbar-allsides-sticky .new-menu');
    	// Top Level Header Link
    	var $newMainMenuLinkLevel1 = $newMainMenu.find('> ul > li:not(.menu-item-direct-link, .menu-item-search)');

    	$newMainMenuLinkLevel1.each(function(){

    		// Top Level Header Link
    		var $this = $(this).find('> a');

    		$this.click(function(e){
				var windowWidth = window.innerWidth;
				if(windowWidth > 979){
				}else{
					e.preventDefault();
					// remove .is-open class from all other list items
					$newMainMenuLinkLevel1.not($this.parent('li')).removeClass('is-open');
					$this.parent('li').toggleClass('is-open');
					
					// Close other submenus	
					var $submenuPane = $this.parent('li').find('> ul');
					console.log($submenuPane);
					$this.parent($newMainMenu).find('> ul > li > ul').not($submenuPane).removeClass('open');

					if ( !($submenuPane.hasClass('open'))) {
						//$mainMenuOuter.css('height', '82');
						$('.nmm .new-menu > ul > li > ul, .navbar-allsides-sticky .new-menu > ul > li > ul').removeClass('open');
						$submenuPane.addClass('open');
						console.log($submenuPane);

					} else {

						$submenuPane.removeClass('open');
						//$mainMenuOuter.css('height', '41');
						console.log($submenuPane);
					}
				}

	    		console.log($submenuPane);
    		});

    		
    	}); 

    	$( window ).scroll(function() {
    		if ( !($newMainMenuLinkLevel1.find('>ul').hasClass('open'))) {

    		} else {
    			$('.nmm .new-menu, .navbar-allsides-sticky .new-menu > ul > li > ul').removeClass('open');
    		}
    	});*/
   	
    	/*var biasTrioHeading = $('body.page-news .bias-trio > h2.block-title, body.node-type-news-home .bias-trio > h2.block-title');
    	
    	biasTrioHeading.each(function(){
    		var $this = $(this);
    		var $hideShowContent = $this.siblings('.view-news');

    		$this.click(function(e){
    			e.preventDefault();
    			$hideShowContent.slideToggle();
    		})
    	})*/

   // }
 // };


  Drupal.behaviors.parallax = {
    attach: function (context, settings) {
    	
    	// if( $('body').hasClass('page-how-allsides-changes-the-world')) {
    	// 	var s = skrollr.init({
		   //      render: function(data) {
		   //          //Debugging - Log the current scroll position.
		   //          //console.log(data.curTop);
		   //      }
		   //  });
    	// }

    	if( $('body').hasClass('page-get-involved')) {
    		skrollr.init({
	    	  smoothScrolling: false,
	    	  mobileDeceleration: 0.004
    		});
    	}
    	if( $('body').hasClass('section-temp-home')) {
    		skrollr.init({
	    	  smoothScrolling: false,
	    	  mobileDeceleration: 0.004
    		});
    	}

    }
  };



  Drupal.behaviors.scrollAdmin = {
    attach: function (context, settings) {
    	$(window).scroll(function() {
    		$('body.admin-menu .navbar-allsides').css('margin-top', '0');
    	});

    }
  };


  Drupal.behaviors.searchResults = {
    attach: function (context, settings) {
    	
    	// $.getJSON( "/blank/slider/simple/left.json", function( data ) {
    	//   var items = [];
    	//   $.each( data, function( key, val ) {
    	//     items.push( "<li id='" + key + "'>" + val + "</li>" );
    	//   });
    	 
    	//   $( "<ul/>", {
    	//     "class": "my-new-list",
    	//     html: items.join( "" )
    	//   }).appendTo( ".search__recent" );
    	// });

    }
  }; // searchResults


  Drupal.behaviors.donateBlock = {
    attach: function (context, settings) {
    	var donateBig = $('.donate--big');
    	var donattionValue = '';


    	$('#once-or-monthly--monthly').click(function(){
    		if ($(this).is(':checked'))
    		    {
			$('.donate__buttons-group--once .donate__other_once').remove();
			$('.donate__buttons-group--montly .donate__other').remove();
    		      if ( !($('.donate__buttons-group').hasClass('donate__buttons-group--montly')) ) {
    		      	$('.donate__buttons-group').removeClass('donate__buttons-group--once');
    		      	$('.donate__buttons-group').addClass('donate__buttons-group--montly');
    		      	
    		      	populateMonthly();
    		      }
    		      
    		    }
    	})

    	$('#once-or-monthly--once').click(function(){
    		if ($(this).is(':checked'))
    		    {
			$('.donate__buttons-group--once .donate__other_once').remove();
			$('.donate__buttons-group--montly .donate__other').remove();
    		      if ( !($('.donate__buttons-group').hasClass('donate__buttons-group--once')) ) {
    		      	$('.donate__buttons-group').removeClass('donate__buttons-group--montly');
    		      	$('.donate__buttons-group').addClass('donate__buttons-group--once');

    		      	populateOnce();
    		      }
    		      
    		    }
    	})


    	$('.donate__button').not('.donate__button--7').each(function(){

    		$thisButton = $(this);
    		$thisButton.click(function(e){

    			$clickedButton = $(this);
    			buttonOrder = $clickedButton.attr('data-order');
	    		donationValue = $clickedButton.attr('data-amount');

	    		e.preventDefault();

	    		if ($('.donate__buttons-group').hasClass('donate__buttons-group--once')) {
	    			$('#pre_single_' + buttonOrder).prop("checked", true);
	    			//$('#one-time .amount-holder').val(donationValue);
				$('.single-donation-form .amount-holder').val(donationValue);
	    			//$( "#one-time .donation-submit-button" ).trigger( "click" );
				$( ".single-donation-form .donation-submit-button" ).trigger( "click" );
	    		} else  {
	    			$('#pre_recurr_' + buttonOrder).prop("checked", true);
	    			$('.monthly-donation-form .amount-holder').val(donationValue);
	    			$('.monthly-donation-form .donation-submit-button').trigger( "click" );
	    		}
	

	    	});


    	});

    	function populateMonthly () {	
    		//$('.donate__button--7').attr('href', '/donate');

    		// $('.donate__button--7').click(function(e){
    		// 	e.preventDefault();
    		// 	$('.donate__buttons-group').append('<input name="amount" size="4" type="text" value="" class="custom-amount-monthly-presubmit"><a class="btn presubmit-monthly">Donate</a>');
    		// 	$('.presubmit-monthly').click(function(e){
    		// 		e.preventDefault();
    		// 		var customMonthly = $('.custom-amount-monthly-presubmit').val();
    		// 		$('.monthly-donation-form #pre_recurr_other').prop("checked", true);
    		// 		$('.monthly-donation-form .custom-amount, .monthly-donation-form .amount-holder').val(customMonthly);
    				
    		// 		$('.monthly-donation-form .donation-submit-button').trigger( "click" );
    		// 	})
    		// })

    		$('.donate__buttons-group--montly .donate__button--7').click(function(e){
    			e.preventDefault();

    			var donateButtonsGroup = $('.donate__buttons-group--montly.donate__buttons-group');
    			if (donateButtonsGroup.find('.donate__other').length == 0) {
    				//$('.donate__other').show();
    				donateButtonsGroup.append('<div class="donate__other"><input name="amount" size="4" placeholder="Custom monthly amount" type="text" value="" class="custom-amount-monthly-presubmit"><a class="btn btn-success presubmit-monthly">Donate</a></div>');
    				$('.custom-amount-monthly-presubmit').focus();
    			} else {
    				//$('.donate__other').remove();
    			}
    			
    			
    			$('.presubmit-monthly').unbind().click(function(e){
    				e.preventDefault();
    				var customMonthly = $('.custom-amount-monthly-presubmit').val();
				if(customMonthly == ''){
				    alert(Drupal.t('Please enter your donation amount'));
				}else{
				    $('.monthly-donation-form #pre_recurr_other').prop("checked", true);
				    $('.monthly-donation-form .custom-amount, .monthly-donation-form .amount-holder').val(customMonthly);
				    //$('.monthly-donation-form .donation-submit-button').trigger( "click" );
				    $('.monthly-donation-form').submit();
			    }
    			})
    		})
			function iterateOverFields (letter, start, finish) {
				for (var i = start; i <= finish; i++) {
					var setValue = $('#pre_recurr_' + i).val();
					$('.donate__button--' + i).attr('data-amount', setValue).text('$' + setValue);  
					console.log('populateMonthlyFired');   
				}
			}
		  iterateOverFields('', 0, 6);  	
    	}

    	function populateOnce () {
    		//$('.donate__other').remove();
    		//$('.donate__buttons-group--once .donate__button--7').unbind('click').attr('href', 'https://paypal.me/AllSides');
		
		
		$('.donate__buttons-group--once .donate__button--7').live('click',function(e){
    			e.preventDefault();

    			var donateButtonsGroup = $('.donate__buttons-group--once.donate__buttons-group');
    			if (donateButtonsGroup.find('.donate__other_once').length == 0) {
    				//$('.donate__other').show();
   				donateButtonsGroup.append('<div class="donate__other_once"><input style="margin-top:7px;" name="amount" size="4" nplaceholder="Custom amount" type="text" value="" class="custom-amount-once-presubmit">&nbsp;<a class="btn btn-success presubmit-once">Donate</a></div>');
    				$('.custom-amount-once-presubmit').focus();
    			} else {
    				//$('.donate__other_once').remove();
    			}
    			
    			
    			$('.presubmit-once').unbind().click(function(e){
    				e.preventDefault();
    				var customOnce = $('.custom-amount-once-presubmit').val();
				if(customOnce == ''){
				    alert(Drupal.t('Please enter your donation amount'));
				}else{
				    $('.single-donation-form #pre_recurr_other').prop("checked", true);
				    $('.single-donation-form .amount-holder').val(customOnce);    				
				    $('.single-donation-form').submit();
				}
    			})
    		})
	
    		function iterateOverFields (letter, start, finish) {
    		  for (var i = start; i <= finish; i++) {
    		  	var setValue = $('#pre_single_' + i).val();
    		  	$('.donate__button--' + i).attr('data-amount', setValue).text('$' + setValue);     
    		  }
    		}
    		iterateOverFields('', 0, 6);  		
    	}

    	populateOnce();

    	// function populateCalculatorForm() {
    	  
    	//   function iterateOverColumns (letter, start, finish) {
    	//     for (var i = start; i <= finish; i++) {
    	//       if ( typeof flds[letter + i] !== 'undefined') {
    	//         console.log('var exists ' + letter + i);
    	//         $('#edit-submitted-' + letter + i).val(flds[letter + i]);
    	//       } else {
    	//         console.log(letter + i + ' does not exist');
    	//       }
    	//     }
    	//   }
    	//   iterateOverColumns('b', 123, 123);
    	//   iterateOverColumns('c', 31, 127);
    	//   iterateOverColumns('d', 21, 127);
    	//   iterateOverColumns('e', 119, 123);
    	//   iterateOverColumns('f', 53, 123);
    	//   iterateOverColumns('g', 53, 128);    
    	// }
    	

    }
  };


/*  Drupal.behaviors.quicktabs_rotater = {


	  attach: function(context, settings) {

	  	// Add Ajax-processed to body when the rating widget is clicked
	  	$('.fivestar-widget').click(function (e) {
	  		e.preventDefault();
	  		$('body').addClass('ajax-processed');
	  	});

	  	

	  	if ( !($('body').hasClass('ajax-processed')) ) {
	  			// Implement the tab rotate
	  		  var featureRotate = function() {

	  		  	var storyTab = $('#quicktabs-view__news__news_date ul.quicktabs-tabs, #allsides-products ul.nav-tabs').find('li');
	  		    var activeTab = $('#quicktabs-view__news__news_date ul.quicktabs-tabs, #allsides-products ul.nav-tabs').find('li.active');
	  		    var nextTab = activeTab.next();
	  		    var innerContent = $("#quicktabs-view__news__news_date .quicktabs-tabpage > *, #allsides-products .tab-pane > *");

	  		    if( (nextTab.length) && (nextTab.css('display') != 'none') ){
	  		      nextTab.find('a').trigger('click');
	  		      $('body').addClass('ajax-processed-2');
	  		      innerContent.hide();
	  		      innerContent.fadeIn(1000);
	  		      //console.log(innerContent);
	  		    }
	  		    else if(storyTab.length > 1) {
	  		      $('#quicktabs-view__news__news_date ul.quicktabs-tabs li a, #allsides-products ul.nav-tabs li a').first().trigger('click');
	  		      innerContent.hide();
	  		      innerContent.fadeIn(1000);
	  		    }

	  		    featureTimeout = setTimeout(featureRotate, rotateSpeed);

	  		    return false;
	  		  };

	  		  // Define delay time here
	  		  var rotateSpeed = 7500;
	  		  // Comment the next line to disable auto-rotate
	  		  var featureTimeout = setTimeout(featureRotate, rotateSpeed);

	  		  // Disable auto-rotate when the mouse is over the quicktabs div
	  		  $("#quicktabs-view__news__news_date, #allsides-products, #navbar-allsides .dropdown").bind("mouseenter", function() {
	  		    clearTimeout(featureTimeout);
	  		    featureTimeout = false;
	  		    return false;
	  		  } ).bind("mouseleave", function() {
	  		    featureTimeout = setTimeout(featureRotate, rotateSpeed);
	  		    return false;
	  		  });

	  	};

	  	
	  }
  }; 

*/

$('#user-profile-form div.form-item-pass-pass1').before('<legend><span class="fieldset-legend">Change Your Password</span></legend>');




})(jQuery);


jQuery(document).ready(function(){
	if(jQuery(window).width() < 767){
	var biasTrioHeading = jQuery('body.page-news .bias-trio > h2.block-title, body.node-type-news-home .bias-trio > h2.block-title');
  biasTrioHeading.each(function(){
		var $this = jQuery(this);
		var $hideShowContent = $this.siblings('.view-news');
		$this.click(function(e){
			if(jQuery(this).siblings('.view-news').is(':visible')){
					e.preventDefault();
					$hideShowContent.hide();
					$hideShowContent.siblings('h2.block-title').removeClass('block__title_showing');
					$hideShowContent.next('.add-headline-btn').hide();
				}
				else{
					e.preventDefault();
					jQuery('body.node-type-news-home .bias-trio > h2.block-title').siblings('.view-news').siblings('h2.block-title').removeClass('block__title_showing');
					jQuery('body.node-type-news-home .bias-trio > h2.block-title').siblings('.view-news').slideUp(0);
					jQuery('body.node-type-news-home .bias-trio > h2.block-title').siblings('.add-headline-btn').slideUp(0);
					$hideShowContent.slideDown(1500);
					$hideShowContent.siblings('h2.block-title').addClass('block__title_showing');
					$hideShowContent.next('.add-headline-btn').show();
				}
		})
	})
	}
	jQuery('#navbar-allsides a[data-toggle="collapse"]').click(function(e){
		e.preventDefault();
		jQuery(this).next('.nav-collapse').slideToggle(100);
	});
	
	jQuery('.new-main-menu .new-menu > ul > li > a').live('click',function(e){
	   var windowWidth = window.innerWidth;
	   if(windowWidth > 979){
	   }else{
		   if(jQuery(this).parent('li').hasClass('menu-item-direct-link') || jQuery(this).parent('li').hasClass('menu-item-search')){
			   
		   }else{
			   e.preventDefault();
			   //jQuery('.new-main-menu .new-menu > ul > li').removeClass('is-open');
			   jQuery(this).parent('li').toggleClass('is-open');
			   if(jQuery(this).parent('li').find('> ul').hasClass('open')){
				   jQuery(this).parent('li').find('> ul').removeClass('open')
			   }else{
				   jQuery(this).parent('li').find('> ul').addClass('open')
			   }
		   }
	   }
	});
});
jQuery(document).ready(function(){
    jQuery('.clip').parent('a').siblings('.unclip-page').css('top','100px');
		jQuery('.myFrontPage.view-display-id-page [class^="col-"]').each(function(){
			if(jQuery(this).html().trim() == ''){
				jQuery(this).remove();
			}
		});
		

    var currURL = jQuery(location).attr("href");
    var breakURL = currURL.split('/');
    if(breakURL[3] == 'myfrontpage' && breakURL[4] != undefined){
	if(jQuery('.sortable').length > 0){
	var countDiv = jQuery('.myPageClipped .allsides-daily-topic-container .allsides-daily-row').length;
	var countZero = false;
	jQuery('.myPageClipped .allsides-daily-topic-container .allsides-daily-row').each(function (index, value) { 
	    var div = '<div class="col-1 ui-sortable-handle">'+jQuery(this).html()+'</div>';
	    jQuery('.ui-sortable').append(div);
	    jQuery(this).remove();
	    if(countDiv == (parseInt(index)+1)){
		countZero = true;
	    }
	});	
	

	/*if(countZero == true){ */
	var userName = breakURL[4].split('#');
	userName = userName[0].trim();
	jQuery.ajax({
		type: "POST",
		url: '/card/fetch/'+userName,	
		data: {params:userName},	
		success: function(returnResult){
		    if (/^[\],:{}\s]*$/.test(returnResult.replace(/\\["\\\/bfnrtu]/g, '@').replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']').replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {
			var contentHtml = '';
			var result = JSON.parse(returnResult);
			if(result.status == 200){
			    jQuery(result.data).each(function (key, keyValue) { 
				jQuery('.sortable .ui-sortable-handle').each(function (index, value) {
				    var relArticleCard = jQuery(this).find('.mypage_story').attr('rel');
				    if(relArticleCard != undefined && relArticleCard == keyValue.card_id){
					contentHtml += '<div class="col-'+key+' ui-sortable-handle">'+jQuery(this).html()+'</div>';
				    }
			    });
			    })
			    jQuery('.sortable').html('');
			    jQuery('.sortable').append(contentHtml);
			    jQuery('.removeSpan').remove();
			    jQuery('.sortable').css('display','block');
			}else{
			    jQuery('.removeSpan').remove();
			    jQuery('.sortable').css('display','block');
			}
		    }else{
			jQuery('.removeSpan').remove();
			jQuery('.sortable').css('display','block');
		    }
		},
		error: function(error){
		    jQuery('.removeSpan').remove();
		    jQuery('.sortable').css('display','block');
		    console.log(error);
		    alert('Error in processing data.');
		}
	    }); 
	/*} */
    
    }
    }
    if(siteUrl.indexOf('/content/create') != -1 || siteUrl.indexOf('/content/submit') != -1){
    jQuery('#page').prepend('<div class="backToFrontpage" style="float:right;margin-top:20px;"><a href="/myfrontpage/'+frontPageName+'"><i class="fa fa-arrow-left" aria-hidden="true"></i> Back To My Front Page</a></div>');
    }
   
    jQuery(".toggle-instructions").click(function(){
	if(jQuery('.toggle-instructions i').hasClass('fa-angle-right')){
	    jQuery(".frontpage-instructions").slideDown(100);
	    jQuery('.toggle-instructions i').removeClass('fa-angle-right');
	    jQuery('.toggle-instructions i').addClass('fa-angle-down');	    
	}else{
	    jQuery(".frontpage-instructions").slideUp(100);
	    jQuery('.toggle-instructions i').removeClass('fa-angle-down');
	    jQuery('.toggle-instructions i').addClass('fa-angle-right');	    
	}
  });
    
    var sortableCount = jQuery('.myFrontPage.view-display-id-page [class^="col-"]').length;
    if(sortableCount>2 || sortableCount == 0){
    jQuery('.toggle-instructions').css('height','auto');
    }
             
	/*var storeTimeInterval = setInterval(function(){
	    var shareCount = jQuery('.sharethis-inline-share-buttons').length;
	    console.log(shareCount);
	    var counter =1;
	jQuery('.sharethis-inline-share-buttons').each(function(){
	    var totalCount = jQuery(this).find('.st-total .st-label').text();
	    if(totalCount != '' && typeof totalCount != 'undefined' && totalCount > 9){
		//console.log(totalCount);
		//jQuery(this).find('.st-total .st-label').text('0');
		//jQuery('.st-total .st-label').html('0');
		//console.log('here');
		console.log(totalCount);
		//if(jQuery(this).find(''))
		//jQuery(this).find('.st-total .st-label').html(totalCount+'<br/>Shares');
		jQuery(this).find('.st-total .st-label').attr('style','display: block !important');
		jQuery(this).find('.st-total .st-shares').attr('style','display: block !important');
		if(shareCount == counter){
		    console.log('interval closed');
		    clearInterval(storeTimeInterval);
		}
		
	    }else{
		if(shareCount == counter){
		    console.log('interval closed');
		    clearInterval(storeTimeInterval);
		}
	    }
	     console.log('counter='+counter);
	    counter++;
	}); },20
	);*/	
    
    /*jQuery('label.media-bias-head').on('click', function(){
			jQuery(this).toggleClass('media-bias-head-open');
			jQuery('#edit-field-featured-bias-rating-value-wrapper').toggle();
			jQuery('#edit-field-news-source-type-tid-wrapper').toggle();
			jQuery('[id^="edit-field-news-bias-nid-"]').toggle();
    });
		jQuery('.bias-raitings-list > .view-filters .views-exposed-widget#edit-title-wrapper label[for="edit-title"]').on('click', function(){
				jQuery(this).toggleClass('edit-title-open');
				jQuery(this).next('.views-widget').toggle();
				jQuery(this).parent('#edit-title-wrapper').next('.views-submit-button').toggle();
				jQuery(this).parent('#edit-title-wrapper').next('.views-submit-button').next('.views-reset-button').toggle();
    }); 
    
    if(jQuery('body').find('#views-exposed-form-allsides-daily-administration-news-sources-page-1')){
    jQuery('input[type=radio][name=field_featured_bias_rating_value]').change(function() {
	if(jQuery('#views-exposed-form-allsides-daily-administration-news-sources-page-1').find('#customFilter').length>0){
	    jQuery('#customFilter').val('1');
	}else{
	    jQuery('#views-exposed-form-allsides-daily-administration-news-sources-page-1').append('<input type="hidden" id="customFilter" name="customFilter" value="1">');
	}
	jQuery('input[type=text][id=edit-title]').val('');
    });
    
    jQuery('input[type=checkbox][name=field_news_source_type_tid[]]').change(function() {
	if(jQuery('#views-exposed-form-allsides-daily-administration-news-sources-page-1').find('#customFilter').length>0){
	    jQuery('#customFilter').val('1');
	}else{
	    jQuery('#views-exposed-form-allsides-daily-administration-news-sources-page-1').append('<input type="hidden" id="customFilter" name="customFilter" value="1">');
	}
	jQuery('input[type=text][id=edit-title]').val('');//return false;
    });
    
    jQuery('input[type=checkbox][name=field_news_bias_nid_1[]]').change(function() {
	if(jQuery('#views-exposed-form-allsides-daily-administration-news-sources-page-1').find('#customFilter').length>0){
	    jQuery('#customFilter').val('1');
	}else{
	    jQuery('#views-exposed-form-allsides-daily-administration-news-sources-page-1').append('<input type="hidden" id="customFilter" name="customFilter" value="1">');
	}
	jQuery('input[type=text][id=edit-title]').val('');
    });
    
    jQuery('#edit-submit-allsides-daily-administration-news-sources').click(function(){
		jQuery('input[type=radio][id=edit-field-featured-bias-rating-value-all]').prop('checked', true);
		jQuery('input[type=checkbox][name^=field_news_source_type_tid]').prop('checked', true);
		jQuery('input[type=checkbox][name^=field_news_bias_nid]').prop('checked', true);	
	if(jQuery('input[type=text][id=edit-title]').val() != ''){
	    if(jQuery('#views-exposed-form-allsides-daily-administration-news-sources-page-1').find('#customFilter').length>0){
		jQuery('#customFilter').val('2');
	    }else{
		jQuery('#views-exposed-form-allsides-daily-administration-news-sources-page-1').append('<input type="hidden" id="customFilter" name="customFilter" value="2">');
	    }
	}else{
	    if(jQuery('#views-exposed-form-allsides-daily-administration-news-sources-page-1').find('#customFilter').length>0){
		jQuery('#customFilter').val('1');
	    }else{
		jQuery('#views-exposed-form-allsides-daily-administration-news-sources-page-1').append('<input type="hidden" id="customFilter" name="customFilter" value="1">');
	    }
	}
    });
    //alert('here='+urlParam('customFilter'));
    if(urlParam('customFilter') == 2){
	jQuery('.views-exposed-widgets #edit-title-wrapper .views-widget').css('display','block');
	jQuery('.views-exposed-widgets #edit-title-wrapper label').addClass('edit-title-open');
	jQuery('.views-exposed-widgets .views-submit-button').css('display','block');
	jQuery('.views-exposed-widgets .views-reset-button').css('display','block');
	jQuery('html,body').animate({scrollTop: jQuery('.media-bias-head').offset().top - 100}, 0);
    }else if(urlParam('customFilter') == 1){
	jQuery('#block-block-95 .media-bias-head').addClass('media-bias-head-open');
	jQuery('.bias-raitings-list #edit-field-featured-bias-rating-value-wrapper').css('display','block');
	jQuery('.bias-raitings-list #edit-field-news-source-type-tid-wrapper').css('display','block');
	jQuery('.bias-raitings-list #edit-field-news-bias-nid-wrapper').css('display','block');
	jQuery('.bias-raitings-list #edit-field-news-bias-nid-1-wrapper').css('display','block');
	jQuery('.bias-raitings-list #edit-field-news-bias-nid-1').css('display','block');
	jQuery('html,body').animate({scrollTop: jQuery('.media-bias-head').offset().top - 100}, 0);
    } 
   }*/
});

function urlParam(name){
	var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
	if(typeof(results) != "undefined" && results !== null) {
	  return results[1] || 0;
	}
}

(function ($) {
        $(document).bind('flagGlobalAfterLinkUpdate', function(event, data) {

if(!$('body').hasClass('node-type-allsides-news-item'))
{
if (data.flagName == 'add_to_my_page' && data.flagStatus == 'flagged') { //dont forget to add your flag name
var newLink = '<a class="go-to-home-page" href="/myfrontpage/'+frontPageName+'" target="_blank">See My Front Page</a>';
$('.flag-add-to-my-page-'+data.contentId).html(newLink);
}
}
});
	trimNewsSource();


$( document ).ready(function() {
$('.view-page-article-news .mypage_story_remove a.flag-action').click(function()
{
$(this).parent('span').before('<a class="go-to-home-page" href="/myfrontpage/'+frontPageName+'" target="_blank">See My Front Page</a>');
$('.view-page-article-news .mypage_story_remove a.unflag-action').parent('span').remove();
$(this).parent('span').remove();
})	

$('.news-save-data').css('display','block');

$('.news-save-data .article-read-later a.flag-action').text('Save for Later');
$('.news-save-data .article-read-later a.unflag-action').text('Remove Saved Article');
$('.news-save-data .article-myfrontpage a.flag-action').text('Add to My Front Page');
$('.news-save-data .article-myfrontpage a.unflag-action').text('Remove from My Front Page');



});

$( document ).ajaxComplete(function() {
 $('.news-save-data .article-read-later a.flag-action').text('Save for Later');
 $('.news-save-data .article-read-later a.unflag-action').text('Remove Saved Article');
 $('.news-save-data .article-myfrontpage a.flag-action').text('Add to My Front Page');
$('.news-save-data .article-myfrontpage a.unflag-action').text('Remove from My Front Page');
});

  })(jQuery);

    
jQuery(window).load(function() {

    if(jQuery('.frontPageLink').length > 0 && typeof frontPageName != 'undefined'){
	jQuery('.frontPageLink').attr('href','/myfrontpage/'+frontPageName);
    }
    
	var storeTimeInterval = setInterval(function(){
	    jQuery('.sharethis-inline-share-buttons').each(function(){	
		    if(jQuery(this).find('.st-total .st-label').text() != ''){
			if(jQuery(this).find('.st-total .st-label').text() > 9){
			    jQuery(this).find('.st-total .st-label').attr('style','display: block !important');
			    jQuery(this).find('.st-total .st-shares').attr('style','display: block !important');
			    clearInterval(storeTimeInterval);
			}else{
			    clearInterval(storeTimeInterval);
			    //console.log('here1');
			}
		    }else{
			//console.log('here2');
		    }

	    });
	},900);
	jQuery('.introText .myfrontpage-sharethis #st-1 .st-btn[data-network="sms"]').parent('.sharethis-inline-share-buttons').siblings('.googleClassroom').css('left','140px');
	if(jQuery(window).width() < 768){
		jQuery('#news [class*="region-triptych-"] .topics-on-story-pages').hover(function(){
			jQuery(this).find('.hover-section').show();
		} , function(){
			//jQuery(this).find('.hover-section').hide();
			//jQuery('#news [class*="region-triptych-"] .topics-on-story-pages').find('.hover-section').fadeOut();
		});
	}
});

// Wrap News Sources in marquee tags if they are too long:
    function trimNewsSource (argument) {
	    jQuery('.feature-thumbs .source-area .news-source').each(function(){//console.log('here');
		    var $newsSourceLink = jQuery(this);
		    var sourceWidth = $newsSourceLink.width();

		    if ( $newsSourceLink.parent('.news-source').hasClass('news-story-source') ) {
			    var allowedSourceWidth = 100;
		    } else if ( jQuery('body').hasClass('section-topics') ) {
			    var allowedSourceWidth = 107;
		    } else {
			    var allowedSourceWidth = 107;
		    }

		    if ( sourceWidth > allowedSourceWidth )  {
			    jQuery(this).siblings('.source-mask').show();
			    jQuery(this).css('width', allowedSourceWidth);

			    var $triggerArea = jQuery(this).closest('.source-area').find('.trigger-area');

			    $triggerArea.mouseenter(function(){
				    $newsSourceLink.find('.news-source-animate').stop(true,false).animate({right: sourceWidth-allowedSourceWidth+5}, 1000);
			    });
			    jQuery(this).siblings('.trigger-area').mouseleave(function(){
				    $newsSourceLink.find('.news-source-animate').stop(true,false).animate({right: 0}, 1000);
			    });
		    }
	    });
    }
    // call trimSource on page load
    
    jQuery(window).load(function() {
	setTimeout(function(){ 
		jQuery('.lazy-loader').each(function(){
			var imgSrc = jQuery(this).children('img').attr('data-src');
			//var imglink = jQuery(this).parent('.top-content-wrapper').children('.news-title').find('a').attr('href');
			//alert(imglink);
			if(typeof imgSrc !== 'undefined' || imgSrc !== ''){
				jQuery(this).children('img').attr('src',imgSrc);
				//jQuery(this).children('img').wrap( "<a href='"+imglink+"'></a>");
				//jQuery(this).children('img').prepend('</a>');
				jQuery(this).removeClass('lazy-loader');
			}
			//console.log(imgSrc);
		});		
	}, 3000);
	
});
    ;
