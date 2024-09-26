// iotChart.js

var use_zoom = true;

var chart_by_name = {};
var header_by_name = {};
var timer_by_name = {};



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



function create_chart(chart_name, data, num_recs,secs)
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
		seriesDefaults: { showMarker: false, },

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
			label: col[i].name,
			shadow : false,
			lineWidth: 2,
		};
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
			for (var j=0; j<num_recs; j++)
			{
				var series = data[i];
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

	if (true)
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


function create_chart_data(chart_name, abuffer)
	// Decode the binary data into jqPlot compatible arrays of actual data.\
	// and chain to create_chart to show the chart.
	//
	// The binary starts with a uin32_t for the number of records, followed
	// by that number of records consisting of a uint32 timestamp followed
	// by a nuumber of 32 bit fields of specific types.
	//
	// As we do this we also set working min and max values on each column.
{
    const view = new DataView(abuffer);
	let bytes = view.byteLength;
	var header = header_by_name[chart_name];
	var rec_size = 4*(header.num_cols+1);
	let num_recs = bytes / rec_size;

	if (bytes % rec_size)
	{
		console.log("WARNING: NON-INTEGRAL NUMBER OF CHART DATA RECORDS");
	}

	var offset = 0;
	var min_time;
	var max_time;

	// console.log('num_recs:', num_recs);

	var col = header.col;

	var data = [];
	for (var i=0; i<header.num_cols; i++)
	{
		data[i] = [];
		col[i]['min'] = 0;
		col[i]['max'] = 0;
	}

	for (var i=0; i<num_recs; i++)
	{
		// console.log('   rec[' + i + ']  offset(' + offset + ')');
		const ts = view.getUint32(offset, true); // true for little-endian
		offset += 4;

		if (i == 0)
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
			var val;
			const typ = col[j].type;
			if (typ == 'float')
				val = view.getFloat32(offset, true);
			else if (typ == 'int32_t')
				val = view.getInt32(offset, true);
			else
				val = view.getUint32(offset, true);
			offset += 4;

			if (i == 0)
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

	create_chart(chart_name, data,num_recs,max_time-min_time);
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
			header_by_name[chart_name] = JSON.parse(this.responseText);
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

	stopChart(chart_name);

	$.jqplot.config.enablePlugins = true;
		// set jqplot global options gere

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

