// iotChart.js

var use_zoom = true;

var chart_by_name = {};
var header_by_name = {};
var timer_by_name = {};
var custom_inited = false;
var err_values = {};
	// for a moment, assuming all markers drawn from left to right


// Resizing functions
// window.addEventListener('resize', onChartResize);
// This is more code that assumes a single chart per page.

function setChartElementSize(name)
{
    const width = window.innerWidth;
    const height = window.innerHeight;
    const navbar = document.getElementById('my_navbar');
    let navbar_height = navbar ? navbar.clientHeight : 46;
    if (typeof(navbar_height) == 'undefined' ||
        navbar_height == 0)
        navbar_height = 46;

    let client_width = width - 30;
	let client_height = height - navbar_height - 20;

	var ele = document.getElementById(name + "_chart");
	ele.style.height = (client_height - 60) + "px";	// minus controls
	ele.style.width = client_width + "px";
}



function onChartResize(client_width,client_height)
{
	for (let name in chart_by_name)
	{
		var ele = document.getElementById(name + "_chart");
		ele.style.height = (client_height - 60) + "px";	// minus controls
		ele.style.width = client_width + "px";
		chart_by_name[name].replot( { resetAxes: true } );
	}
}


function determineNumTicks(header)
	// using the column tick_intervals and the raw min and max
	// for each value, determine the number of ticks that will
	// completely encapsulate the data, then go back and set
	// the min and max of each column to the appropriate value.
{
	var num_ticks = 0;
	for (var i=0; i<header.num_cols; i++)
	{
		var col = header.col[i];
		var min = col.min;
		var max = col.max;
		var interval = col.tick_interval;

		var low = Math.floor(parseInt((min-interval+1) /interval));
		var high = Math.ceil(parseInt((max+interval-1) /interval));

		var new_min = low * interval;
		// var new_max = high * interval;

		var ticks = high - low;
		if (ticks > num_ticks)
			num_ticks = ticks;

		// col['num_ticks'] = ticks;
		col.min = new_min;
		// col.max = new_max;
	}

	// now assign the max so that every one uses the same number of ticks

	for (var i=0; i<header.num_cols; i++)
	{
		var col = header.col[i];
		var min = col.min;
		var interval = col.tick_interval;

		var max = min + num_ticks * interval;
		col.max = max;
	}

	// return the number of ticks

	return num_ticks + 1;
}



function create_chart(chart_name, data, secs)
	// create the chart, deleting old one first
	// current algorithm determines number of y axis ticks
	// and min/max for each axis with determineNumTicks()
{
	if (chart_by_name[chart_name])
	{
		chart_by_name[chart_name].destroy();
		delete chart_by_name[chart_name];
	}

	// many of these options will end up being application specific.
	// I'm not sure to what degree I want to have each app know about
	// jqplot. They currently don't know much (only that 2400 is better
	// for charting rpms than 2500), but I can see a case, especially
	// with the app specific "widgets", for the apps to becom
	// much more aware of jqplot, and for that matter, bootstrap and jq.

	var header = header_by_name[chart_name];
	var col = header.col;
	var num_ticks = determineNumTicks(header);

	var options = {

		title: header.name,
		seriesDefaults: {},

		legend : {
			renderer: $.jqplot.EnhancedLegendRenderer,
			show: true,
			showLabels: true,
			rendererOptions: {
				numberRows: 1,	// horizontal legend
				// seriesToggleReplot: true,
					// not useful as I set the chart ticks
					// would need to do more sophisticated
					// stuff to get the idea that we redraw
					// the chart when a series comes or goes.
			},
		},
		series: [],
		axes:{
			xaxis:{
				renderer:$.jqplot.DateAxisRenderer,
				// jqplot does a good job of handling the time axis with
				// tickOptions:{formatString:'%H:%M:%S'}, or
				// tickInterval: secsToInterval(secs),
			},
		},	// axes
	};	// options


	if (use_zoom)
	{
		options['cursor'] = {
			zoom:true,
			looseZoom: true,
			showTooltip:true,
			followMouse: true,
			showTooltipOutsideZoom: true,
			constrainOutsideZoom: false
		};
	}


	if (header.alt_data_format)
		options.seriesDefaults['markerRenderer'] = $.jqplot.customMarkerRenderer;
	else
		options.seriesDefaults['showMarker'] = false;

	for (var i=0; i<header.num_cols; i++)
	{
		var axis_name = 'y';
		if (i>0) axis_name += (i+1);
		axis_name += 'axis';

		options.axes[ axis_name ] = {
			pad: 1.2,
			show: true,
			label: col[i].name,
			showLabel : false,	// the axes are the same as the legend
			min: col[i].min,
			max: col[i].max,
			numberTicks: num_ticks,
				// same number of ticks for all axes at this time
				// old: col[i].num_ticks or chart_header.num_ticks,
		};
		options.series[i] = {
			showMarker: header.alt_data_format ? i>0 : 0,
			showLine: !header.alt_data_format || i==0,
			label: col[i].name,
			shadow : false,
			lineWidth: 2,
		};

		if (header.alt_data_format && i>0)
			options.series[i].renderer = $.jqplot.customLineRenderer;
	}

	// scale the values to the 0th axis

	if (true && header.num_cols > 1)
	{
		var global_min = col[0].min;
		var global_max = col[0].max;
		var global_range = global_max - global_min;

		for (var i=1; i<header.num_cols; i++)
		{
			var min = col[i].min;
			var max = col[i].max;
			var range = max - min;
			var series = data[i];
			for (var j=0; j<series.length; j++)
			{
				var rec = series[j];
				var val = rec[1];
				val -= min;
				val /= range;
				val *= global_range;
				val += global_min;
				rec[1] = val;
			}
		}
	}

	// create the plot

	var plot = $.jqplot(chart_name + '_chart', data, options);

	// reverse the order of the canvasas so that
	// the most important one (zero=temperature1)
	// is on top.

	if ((typeof header.reverse_canvases == undefined) ||
		header.reverse_canvases)	// true if undefined or 1, false if 0
	{
		for (var i=header.num_cols-1; i>=0; i--)
		{
			plot.moveSeriesToFront(i);
		}
	}
	
	// add a click handler to the enhancedLegendRenderer
	// legend swatches so that when a series is made
	// visible it is moved to the top, so toggling
	// them on and off effectively lets the user set
	// the z-order ..

	// Note that this is NOT MULTI INSTANCE and
	// WILL NOT WORK with multiple charts on one page!
	
	var i=0;
	$('td.jqplot-table-legend-swatch').each(function(){
		$(this).bind('click',{index:i},function(ev){
			var index = ev.data.index;
			// alert("toggle " + index);
			plot.moveSeriesToFront(index);
		});
		i++;
	});


	// remember the plot

	chart_by_name[chart_name] = plot;

	// set refresh timer if appropriate

	var refresh = document.getElementById(chart_name + '_refresh_interval');
	if (refresh && refresh.value > 0)
	 	timer_by_name[chart_name] = setTimeout(
			function () {
				get_chart_data(chart_name);
			},refresh.value * 1000);

	// enable the Update button

	document.getElementById(chart_name + "_update_button").disabled = false;
}




function getTypedValue(view,offset,typ)
{
	let val;
	if (typ == 'float')
		val = view.getFloat32(offset, true);
	else if (typ == 'temperature_t')
	{
		val = view.getFloat32(offset, true);
		if (DEGREE_TYPE)
			val = centigradeToFarenheit(val);
	}
	else if (typ == 'int32_t')
		val = view.getInt32(offset, true);
	else
		val = view.getUint32(offset, true);
	return val;
}

function create_chart_data(chart_name, abuffer)
	// Decode the binary data into jqPlot compatible arrays of actual data.
	// and chain to create_chart to show the chart.
	//
	// By default, these are myIOTDataLog records, where the records start with
	// uint32 timestamp followed by a nuumber of 32 bit fields of specific types.
	//
	// The chart_header can also specify that the series are built from
	// individual data points for each series, where each item consists of
	// a uint8_t series index, followed by a uint32_t timestamp, followed
	// by a field of the j'th column type.
	//
	// As we do this we also set working min and max values on each column.
{
    const view = new DataView(abuffer);
	let bytes = view.byteLength;
	var header = header_by_name[chart_name];
	var col = header.col;
	var offset = 0;

	err_values = {};

	var min_time = null;
	var max_time = null;
	var data = [];
	for (var i=0; i<header.num_cols; i++)
	{
		data[i] = [];
		col[i]['min'] = null;
		col[i]['max'] = null;
	}

	if (header.alt_data_format)
	{
		var item_size = 1 + 1 + 4 + 4;	// uint8_t col_index, uint8_t err_idx, uint32_t ts, and 32 bit column value
		let num_items = bytes / item_size;
		if (bytes % item_size)
		{
			console.log("WARNING: NON-INTEGRAL NUMBER OF CHART DATA ALT_FORMAT RECORDS");
		}

		// console.log('num_recs:', num_recs);

		for (var i=0; i<num_items; i++)
		{
			let col_idx = view.getUint8(offset, true);
			offset += 1;

			let err_value = view.getUint8(offset, true);
			offset += 1;

			let ts = view.getUint32(offset, true); // true for little-endian
			offset += 4;

			let val = getTypedValue(view,offset,col[col_idx].type);
			offset += 4;

			if (min_time == null)
			{
				min_time = ts;
				max_time = ts;
			}
			else
			{
				if (ts < min_time)
					min_time = min_time;
				if (ts > max_time)
					max_time = ts;
			}

			if (col[col_idx].min == null)
			{
				col[col_idx].min = val;
				col[col_idx].max = val;
			}
			else
			{
				if (val < col[col_idx].min) col[col_idx].min = val;
				if (val > col[col_idx].max) col[col_idx].max = val;
			}

			if (err_value)
				err_values[ts * 1000] = err_value;
			data[col_idx].push([ ts * 1000, val]);

			// not all column min/max will necessarily be
			// set by this.

		}

		// so we probably need another loop here to set them
		// to zero and one if not already sete

		for (var i=0; i<header.num_cols; i++)
		{
			if (col[i].min == null)
			{
				col[i]['min'] = 0;
				col[i]['max'] = 1;
			}
		}
	}
	else	// normal data format
	{
		var rec_size = 4*(header.num_cols+1);
		let num_recs = bytes / rec_size;
		if (bytes % rec_size)
		{
			console.log("WARNING: NON-INTEGRAL NUMBER OF CHART DATA RECORDS");
		}

		// console.log('num_recs:', num_recs);

		for (var i=0; i<num_recs; i++)
		{
			// console.log('   rec[' + i + ']  offset(' + offset + ')');
			let ts = view.getUint32(offset, true); // true for little-endian
			offset += 4;

			if (min_time == null)
			{
				min_time = ts;
				max_time = ts;
			}
			else
			{
				if (ts < min_time)
					min_time = min_time;
				if (ts > max_time)
					max_time = ts;
			}


			// debugging
			// const dt = new Date(ts * 1000);
			// console.log('      dt=' + dt);

			for (var j=0; j<header.num_cols; j++)
			{
				let val = getTypedValue(view,offset,col[j].type);
				offset += 4;

				if (col[j].min == null)
				{
					col[j].min = val;
					col[j].max = val;
				}
				else
				{
					if (val < col[j].min) col[j].min = val;
					if (val > col[j].max) col[j].max = val;
				}

				// console.log('      off(' + offset + ") " + col[j].name + "(" + typ + ") = " + val);

				data[j].push([ ts * 1000, val]);
			}
		}
	}	// normal data format

	create_chart(chart_name, data, max_time-min_time);
}




function get_chart_data(chart_name)
	// get the chart_data for a number of seconds
	// and chain to create_chart_data to parse it
{
	console.log("get_chart_data(" + chart_name + ")");

	var ele = document.getElementById(chart_name + "_chart_period");
	var secs = ele ? ele.value : 0;

	var xhr = new XMLHttpRequest();
	xhr.open('GET', '/custom/chart_data/' + chart_name + "?secs=" + secs, true);
		// '/custom/chart_data?uuid=%%UUID%%&secs=' + secs, true);
	xhr.responseType = 'arraybuffer';
	xhr.onload = function(e)
	{
		create_chart_data(chart_name, this.response);
	};

	xhr.send();
}



function get_chart_header(chart_name)
	// get the chart_header and chain to get_chart_data
{
	console.log("get_chart_header(" + chart_name + ")");
	var xhr_init = new XMLHttpRequest();
	xhr_init.onreadystatechange = function()
	{
		if (this.readyState == 4 && this.status == 200)
		{
			var header = JSON.parse(this.responseText);
			if (typeof header.alt_data_format == undefined)
				header.alt_data_format = false;
			header_by_name[chart_name] = header;
			get_chart_data(chart_name);
		}
    }
	xhr_init.open('GET', '/custom/chart_header/' + chart_name, true);
	xhr_init.send();
}





function doChart(chart_name)
	// doChart() is called only after the dependencies have been loaded,
	// when the Widgit tab is activated in the myIOT, or the document
	// has loaded in temp_chart.htm
{
	console.log('doChart(' + chart_name + ') called');

	if (!custom_inited)
	{
		custom_inited = true;
		initJqPlotCustom();
	}

	stopChart(chart_name);

	$.jqplot.config.enablePlugins = true;
		// set jqplot global options gere

	setChartElementSize(chart_name);
		// resize overly often

	if (!chart_by_name[chart_name])
	{
		get_chart_header(chart_name);
	}
	else
	{
		get_chart_data(chart_name);
	}
}


function stopChart(chart_name)
	// stopChart() is called when the Widget tab is de-activated and also
	// at the top of get_chart_data() when we start loading new data
	// to turn off any existing pending timer for the chart.
{
	document.getElementById(chart_name + "_update_button").disabled = true;
	if (timer_by_name[chart_name])
	{
		clearTimeout(timer_by_name[chart_name]);
		delete timer_by_name[chart_name];
	}
}


//----------------------------------------------------
// an attempt at a customMarkerRenderer
//----------------------------------------------------
// copied from jquery.jqplot.js LineRenderer and MarkerRederer.
// the problem was that defajlt jqPlot LineRenderer called
// MarkerRenderer.draw(x, y, ctx, options) without any way
// to get to a set of characteristics for the marker.
// X and Y are in it's canvas coordinates, ctx is the
// canvas 2d context, and options is static.
//
// Therefore we overrode both the LineRenderer and MarkerRenderers.
// Above, when we are processing the 'alt_data_format', which is
// really the "bilgeAlarm data format" at this point, we created
// an index, by date-time stamp, of the err_values for each marker.
// Below, in the customMarkerRenderer.draw() mthod, we get the
// dt from the plotData for the i'th element, and lookup the
// error value to determine the color of the marker.


function initJqPlotCustom()
{
	// define a customLineRenderer that only renders markers
	// and which calls markerRenderer.draw() with extra 'this' and 'i' parameters
	// which are paired with the customMarkerRenderer

	$.jqplot.customLineRenderer = function() {};
	$.jqplot.customLineRenderer.prototype = new $.jqplot.LineRenderer();
	$.jqplot.customLineRenderer.prototype.constructor = $.jqplot.customLineRenderer;

    $.jqplot.customLineRenderer.prototype.init = function(options, plot) {
		$.jqplot.LineRenderer.prototype.init.call(this, options, plot); };

	$.jqplot.customLineRenderer.prototype.draw = function(ctx, gd, options, plot) {
		var i;
        var opts = $.extend(true, {}, options);
        ctx.save();
        if (gd.length) {
			if (this.markerRenderer.show) {
                for (i=0; i<gd.length; i++) {
                    if (gd[i][0] != null && gd[i][1] != null) {
                        this.markerRenderer.draw(gd[i][0], gd[i][1], ctx, opts.markerOptions, this, i);
                    }
                }
            }
        }
        ctx.restore();
	};


	// define a customMarkerRenderer who's draw() method takes this, and val_idx
	// and uses them to lookup some information about each marker

    $.jqplot.customMarkerRenderer = function(options){
        this.show = true;
        this.radius = 4.5;
        this.color = '#666666';
        this.shapeRenderer = new $.jqplot.ShapeRenderer();
        $.extend(true, this, options);
    };

    $.jqplot.customMarkerRenderer.prototype.init = function(options) {
        $.extend(true, this, options);
        this.shapeRenderer.init({fill:true, isarc:true});
    };

    $.jqplot.customMarkerRenderer.prototype.draw = function(x, y, ctx, options, series, val_idx) {
        options = options || {};
        if (options.show == null || options.show != false) {

			// get the datetime associated with the val_idx'th
			// original series data, and use it to lookup the
			// associated plotter information, which, in this caae
			// is the error code associated with each marker.

			var dt = series._plotData[val_idx][0];
			var err_value = err_values[dt];

			// turn that error code 1..5 into a color
			// and render a filled circle of that color

			var color =
				err_value == 5 ? 'red' :
				err_value > 2 ? 'magenta' : 'orange';
			options.fillStyle = color;

	        var points = [x, y, this.radius, 0, 2*Math.PI, true];
	        this.shapeRenderer.draw(ctx, points, options);
        }
    };
}

