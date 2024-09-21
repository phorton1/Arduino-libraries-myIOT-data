// iotPlot.js
//
// A library that is always included, but not necessarily used,
// that in turn, loads the jqplot CSS and JS as needed, and
// can generate a chart

//------------------------------------------------------
// jqPlot dependency loading and doPlot framework
//------------------------------------------------------

const DependencyState = {
    NOT_LOADED: 0,
    LOADING: 1,
    LOADED: 2,
    ERROR: 3,
};


var dependencies = [];
var dependencies_state = 0;
	// 0=not loaded, 1=loading, 2=loaded, 3=error
let plotInProgress = false;


function addDependency(file_type,file_url)
{
	dependencies.push({
		type:file_type,
		url:file_url});
}


function loadDependency(number)
{
	var ele;
	const dep = dependencies[number];
	if (dep.type == 'css')
	{
		ele = document.createElement('link');
		ele.rel = 'stylesheet';
		ele.href = dep.url;
	}
	else // dep.type == 'js'
	{
		ele = document.createElement("script");
		ele.src = dep.url
	}
    return new Promise((resolve, reject) => {
        ele.addEventListener('load', () => {
            console.log(dep.url + ' loaded');
            if (number < dependencies.length - 1) {
                resolve(loadDependency(number + 1)); // Recursively load next dependency
            } else {
                resolve(); // All dependencies loaded
            }
        });
        ele.addEventListener('error', (ev) => {
            alert('Error loading ' + dep.url, ev);
            reject(new Error('Error loading dependency: ' + dep.url));
        });
        document.head.appendChild(ele);
    });
}


function getDependencies()
{
	if (dependencies_state == DependencyState.NOT_LOADED)
	{
		dependencies_state = DependencyState.LOADING;
		addDependency("css","/myIOT/jquery.jqplot.min.css?cache=1\"");
		addDependency("js","/myIOT/jquery.jqplot.min.js?cache=1\"");
		addDependency("js","/myIOT/jqplot.dateAxisRenderer.js?cache=1\"");
		addDependency("js","/myIOT/jqplot.cursor.js?cache=1\"");
		addDependency("js","/myIOT/jqplot.highlighter.js?cache=1\"");
		// jqplot.enhancedLegendRenderer.js renamed to jqplot.legendRenderer.js
		// because of ESP32 SPIFFS max filename length
		addDependency("js","/myIOT/jqplot.legendRenderer.js?cache=1\"");
        return loadDependency(0).then(() => {

			// one time global jqplot initialization

			$.jqplot.config.enablePlugins = true;
 			$.jqplot._noToImageButton = true;

            dependencies_state = DependencyState.LOADED;
        });
	}
	else if (dependencies_state == DependencyState.LOADING)
	{
		alert("the iotPlot dependencies are still loading!");
        return Promise.reject(new Error('Dependencies still loading'));
	}
	else if (dependencies_state == DependencyState.ERROR)
	{
		alert("there was an error loading the  iotPlot dependencies");
        return Promise.reject(new Error('Error loading dependencies'));
	}
	else // dependencies_state must equal DependencyState.LOADED
	{
		console.log('Dependencies loaded!')
		return Promise.resolve();
	}
}




function doPlot(plot_name, div_id,header_url,data_url)
{
    if (plotInProgress)
        // A plot operation is already ongoing; ignore this request
        return Promise.resolve();

    plotInProgress = true;

    return new Promise((resolve, reject) => {
        getDependencies()
            .then(() => {
				console.log('Calling doThePlot()');
                try {
                    doThePlot(plot_name, div_id,header_url,data_url); // Call doThePlot directly
                    resolve(); // Resolve the Promise
                } catch (error) {
                    reject(error); // Reject if an error occurs
                } finally {
                    plotInProgress = false;
                }
            })
            .catch((error) => {
                console.error('Error during dependency loading:', error);
                reject(error); // Propagate the error
            });
    });

}


async function plotButtonHandler(
	plot_name,
	div_id,
	header_url,
	data_url)
{
    try
	{
        await doPlot(plot_name, div_id,header_url,data_url); 	// Wait for the plot operation to complete
        console.log('Plot completed successfully!');
    }
	catch (error)
	{
        console.error('Error during plot:', error);
    }
}



//------------------------------------------------------
// doThePlot initially copied from old temp_chart.html
//------------------------------------------------------

const use_zoom = true;


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



function do_the_plot(chart_name, div_id, data,num_recs,secs)
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
	// with the notion of app specific "widgets", for the apps to becom
	// much more aware of jqplot, and for that matter, bootstrap and jq.

	// var info = '';
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
				numberRows: 1,

				// not useful as I set the chart ticks
				// would need to do more sophisticated
				// stuff to get the idea that we redraw
				// the chart when a series comes or goes.
				//
				// seriesToggleReplot: true,
			},
		},
		series: [],
		axes:{
			xaxis:{
				renderer:$.jqplot.DateAxisRenderer,
				// jqplot does a good job of handling the time axis
				// tickOptions:{formatString:'%H:%M:%S'},
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

		// info += "col[" + i + "]" + col[i].name;
		// info += " min:" + col[i].min + " max:" + col[i].max;
		// info += "\n";

		options.axes[ axis_name ] = {
			pad: 1.2,
			show: true,
			label: col[i].name,
			showLabel : false,	// true,
			min: col[i].min,
			max: col[i].max,
			numberTicks: num_ticks, // col[i].num_ticks,	// chart_header.num_ticks,
		};
		options.series[i] = {
			label: col[i].name,
			shadow : false,
			lineWidth: 2,
			// yaxis : axis_name,
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


	// document.getElementById("info").value = info;

	var plot = $.jqplot(div_id, data, options);

	// reverse the order of the canvasas so that
	// the most important one (zero=temperature1)
	// is on top.

	for (var i=header.num_cols-1; i>=0; i--)
	{
		plot.moveSeriesToFront(i);
	}


	// add a click handler to the enhancedLegendRenderer
	// legend swatches so that when a series is made
	// visible it is moved to the top, so toggling
	// them on and off effectively lets the user set
	// the z-order ..

	// prh - NOT MULTI INSTANCE!
	
	var i=0;
	$('td.jqplot-table-legend-swatch').each(function(){
		$(this).bind('click',{index:i},function(ev){
			var index = ev.data.index;
			// alert("toggle " + index);
			plot.moveSeriesToFront(index);
		});
		i++;
	});

	// var refresh = document.querySelector("#refresh_interval");
	// if (refresh.value > 0)
	// 	refresh_timer = setTimeout(get_chart_data,refresh.value * 1000);

	chart_by_name[chart_name] = plot;

}




function create_chart_data(chart_name, div_id, abuffer)
	// Decode the binary data into jqPlot compatible arrays of actual data.
	// The binary starts with a uin32_t for the number of records, followed
	// by that number of records consisting of a uint32 timestamp followed
	// by a nuumber of 32 bit fields of specific types.
	//
	// As we do this we also set working min and max values on each column.
{
    const view = new DataView(abuffer);

	var offset = 0;
	const num_recs = view.getUint32(0, true);
	offset += 4;

	var min_time;
	var max_time;

	// console.log('num_recs:', num_recs);

	var header = header_by_name[chart_name];
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

	do_the_plot(chart_name, div_id, data,num_recs,max_time-min_time);
}




function get_chart_data(chart_name, div_id, data_url)
{
	if (timer_by_name[chart_name])
	{
		clearTimeout(timer_by_name[chart_name]);
		delete timer_by_name[chart_name];
	}

	// var secs = document.getElementById("chart_period").value;

	var xhr = new XMLHttpRequest();
	xhr.open('GET', data_url, true);
		// '/custom/chart_data?uuid=%%UUID%%&secs=' + secs, true);
	xhr.responseType = 'arraybuffer';
	xhr.onload = function(e)
	{
		create_chart_data(chart_name, div_id, this.response);
	};

	xhr.send();
}



function create_chart(chart_name, div_id, header_url, data_url)
{
	var xhr_init = new XMLHttpRequest();
	xhr_init.onreadystatechange = function()
	{
		if (this.readyState == 4 && this.status == 200)
		{
			header_by_name[chart_name] = JSON.parse(this.responseText);
			get_chart_data(chart_name, div_id, data_url);
		}
    }
	xhr_init.open('GET', header_url, true);
	xhr_init.send();
}




function doThePlot(chart_name, div_id, header_url, data_url)
{
	console.log('doThePlot(' + chart_name + ') called');
	if (!chart_by_name[chart_name])
	{
		create_chart(chart_name, div_id, header_url, data_url);
	}
	else
	{
		get_chart_data(chart_name, div_id, data_url);
	}
}


// The rubber is getting pretty close to the road here.
//
// I now have a generalized way of loading dependent JS and CSS
// that is called from a chart-specific plotButtonHandler()
// and which calls a specific doThePlot() method.
//
// doThePlot(), in turn, is a bit generalized to allow multiple
// different plots on the same page, but only one is really supported,
// the one that's implemented in Fridge::onCustomLink(), that in turn
// only works with the current Fridge's dataLog object, with its specific
// getChartHeader() and getChartData() structures, which are furthermore
// very specifically used by the jqPlot code to create a certain kind
// of chart.
//
// Even so, at this point, it is missing the chart_period pulldown that
// gives the user determine number of seconds for the chart, and the
// refresh_period user determine automatic automatic refreshing.
//
// There are a number of things I would like to do, all at once, with this mess.
//
// 1) The Widget tab should automatically load dependencies and create and show
//    the initial chart if the tab is activated, but not otherwise
// 2) The idea of a Widget as a small completely self contained bit of HTML is
//    going to be too constraining and difficult to maintain.  A widget should
//    consist of a number of pieces (records) that specify either "Values" or other objects
//	  to be placed into an intelligent flex grid.  One (or more) of those "pieces"
//    can then by "Charts" that further specify options and data sources, and of
//    that whole world, one of those sets of options and one of those data sources
//    should be an instance of the myIOTDataLogger, or perhaps a class derived from
//    that, which then provides the chart type and options for that specific
//    chart.
// 3) Some charts (esp those using the myIOTDataLogger) can have a "period" of
//    a number of seconds for a chart, and the Widget should be able to place
//    a ChartPeriod selection box on the Widget that basically has nothing to
//    do with traditional myIOTDevice values, since the ChartPeriod is user,
//    not device, specific.
// 4) Likewise, some charts can be made to automatically update themselves,
//    whereas that's not very practical for other ones.
// 5) Ultimately I would like to be able to produce 'rapid' charts (Plotter)
//    of things like a clock's swing ... in 3 or 5ms steps, that update by
//    taking advantage of the relatively high bandwidth of WS broadcasts.
// 6) Then there is the whole additional issue of UUIDs and how to get this
//    to work THRU the myIOTServer.
// 7) And the whole additional issue of caching unchanging javascript, versus
//    caching of my somewhat changing javascript, as well as the chart_headers,
//    vs never caching the data requests.
//
// To the degree that the iotPlot.js script is in the context of the iotCommon.js
// code, it has access to the device's UUID for the myIOTServer, BUT, additionally,
// I think I would like to be able to pop a chart up in a separate window so-as
// not to have to load the entire IOT device to see a chart and/or to be able to
// watch the chart separate from the myIOT device.
//
// This is getting complicated!
