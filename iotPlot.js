//-----------------------------------------------------------
// iotPlot.js
//-----------------------------------------------------------
// Currently always loaded along with iotCommon.js
// Constants in pixels, using default canvas scaling.

const plot_Top = 10;                // space allocated for the top of the canvas
const plot_Left = 65;               // space allocated for the left axis
const plot_Margin_Right = 2;        // space allocated for the right axis
const plot_Margin_Bottom = 30;      // space allocated for the bottom axis (legend)

const seriesColors = [
    'red', 'green', 'blue', 'cyan', 'magenta',
    'orange', 'purple', 'lime', 'teal', 'pink'
];


// Data

let ctx;
let canvas;
let dataBuffers = [];
let plot_curX;
let plot_maxX;
let plot_maxY;
let debug_plot = 0;
let plot_legend = '';
let last_legend = '';


function initPlotter()
    // called from iotCommon.js startMyIOT() and
    // the "CLEAR" button in the plot tab controls
{
    if (debug_plot)
        console.log("initPlotter()");

    dataBuffers = [];
    canvas = document.getElementById('plotter_canvas');
    ctx = canvas.getContext('2d');

    setCanvasMax();

    drawFrame(null,null,null)

    plot_curX = 0;

}


function setPlotLegend(legend)
{
    plot_legend = legend;
}


function setCanvasMax()
{
    let width = canvas.width;
    let height = canvas.height;

    plot_maxX = width - plot_Left - plot_Margin_Right - 1;
    plot_maxY = height - plot_Top - plot_Margin_Bottom - 1;
    if (debug_plot)
        console.log("setCanvasMax(" + width + "," + height + ") max(" + plot_maxX + "," + plot_maxY + ")");

    // as a result of a resize, plot_curX might now be out of range.
    // if so, we will splice out the first N elements of it ...

    let num_extra = plot_curX - plot_maxX + 1;

    if (num_extra > 0)
    {
        plot_curX = plot_maxX-1;
        for (const series of dataBuffers)
        {
            series.splice(0,num_extra); // remove the left most value from all series
        }
    }
}


function plotData(samples)
    // the only other entry point to this JS at this time
    // called from iotCommon.js handleWS() any time it receives
    // obj.plot_data (an individual set of points) to plot
{
    if (debug_plot)
        console.log("plotData[" + plot_curX +"] samples(" + samples + ")");

    // when the legend changes, there can be extraneous plot_data's
    // in the WS pipeline that get displayed against the wrong scale.
    // Here we do a rudimentary check that the number of samples matches
    // the number of legend entries, and if not, we bail
    
    let legend_parts = plot_legend.split(',');
    if (samples.length != legend_parts.length)
        return;

    // and here we handle the legend change
    // by re-initializing the plotter
    // or otherwise, we handle any resizing issues
    
    if (last_legend != plot_legend)
    {
        last_legend = plot_legend;
        initPlotter();
    }
    else
        setCanvasMax();

    const num_samples = samples.length;
    const num_series = dataBuffers.length;
    for (let i=0; i<Math.max(num_samples,num_series); i++)
    {
        if (!dataBuffers[i])    // new series
        {
            // fill the new array with the special value null,
            // indicating invalid points before plot_curX
            if (debug_plot)
                console.log("new dataBuffers[" + i + "]");
            dataBuffers[i] = new Array(plot_curX).fill(null);
        }

        // if the sample is missing, plot_curX must be 1 or greater
        // so we copy the last known value of the sample
        if (typeof samples[i] == "undefined")
            samples[i] = dataBuffers[i][plot_curX-1];

        dataBuffers[i].push(samples[i]);
    }

    // at the right edge we start shifting values out of all series

    plot_curX++;
    if (plot_curX >= plot_maxX)
    {
        plot_curX = plot_maxX-1;
        for (const series of dataBuffers)
        {
            series.shift(); // remove the left most value from all series
        }
    }

    // we handle the data continuously, but
    // only draw the plot if the user is on that tab
    
    if (cur_button == 'plot_button')
        drawPlot();
}



function drawFrame(minY,maxY,divisor)
{
    let width = canvas.width;
    let height = canvas.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'black';
    ctx.moveTo(plot_Left-2, plot_Top-2);
    ctx.lineTo(width - plot_Margin_Right + 1, plot_Top-2)
    ctx.lineTo(width - plot_Margin_Right + 1, height - plot_Margin_Bottom + 1);
    ctx.lineTo(plot_Left-2, height - plot_Margin_Bottom + 1);
    ctx.lineTo(plot_Left-2, plot_Top-2);
    ctx.stroke();

    // draw the y-axis scale

    if (minY !== null && maxY !== null && divisor != null)
    {
        ctx.font = "12px Arial";

        const data_range = maxY - minY;
        let num_spaces = data_range / divisor;
        const tick_space = plot_maxY / num_spaces;

        // we want to know the number of decimal places in the divisor
        // so we can round the displayed value accoringly inasmuch
        // as floating point math 0.24 - 0.01 gives 0.229999999999999

        const places = Math.floor(Math.log10(divisor));

        let draw_value = maxY;
        let draw_position = plot_Top;
        for (let i=0; i<num_spaces+1; i++)
        {
            // round draw_value to an exact multiple of divisor
            if (places < 0)
                draw_value = parseFloat((draw_value).toFixed(-places));
            else
                draw_value = Math.round(draw_value);

            // draw the text with baseline + 6
            ctx.beginPath();
            ctx.lineWidth = 1;
            ctx.fillText(draw_value, 10, draw_position+3, plot_Left-12);
            ctx.fill();

            // draw the grid
            if (i && i < num_spaces)
            {
                ctx.beginPath();
                ctx.lineWidth = 1;
                ctx.strokeStyle = "#BBBBBB";
                ctx.moveTo(plot_Left-12, draw_position);
                ctx.lineTo(plot_Left + plot_maxX,draw_position);
                ctx.stroke();
            }

            draw_position += tick_space;
            draw_value -= divisor;

        }
    }

    // draw the legend

    if (plot_legend != '')
    {
        const box_top = height - plot_Margin_Bottom + 8;
        const box_bottom = height - plot_Margin_Bottom + 24;
        const text_baseline = height - plot_Margin_Bottom + 20;

        var xoff = plot_Left + 10;
        var parts = plot_legend.split(',');

        ctx.font = "12px Arial";
        ctx.lineWidth = 2;

        for (let i=0; i<parts.length; i++)
        {
            // skip constant numbers

            if (isNaN(parts[i]))
            {
                ctx.strokeStyle = 'black';
                ctx.fillStyle = seriesColors[i % seriesColors.length];

                ctx.beginPath();
                ctx.moveTo(xoff, box_top);
                ctx.lineTo(xoff+16, box_top);
                ctx.lineTo(xoff+16, box_bottom);
                ctx.lineTo(xoff, box_bottom);
                ctx.lineTo(xoff, box_top);
                ctx.stroke();
                ctx.fill();

                ctx.fillStyle = 'black';
                ctx.beginPath();
                ctx.fillText(parts[i], xoff + 22, text_baseline);
                ctx.fill();

                xoff += ctx.measureText(parts[i]).width + 45;
            }
        }
    }
}



function drawPlot()
    // draw the plot from 0 to plot_curX;
{
    let data_minY = Infinity;
    let data_maxY = -Infinity;
    const num_series = dataBuffers.length;
    for (let i=0; i<num_series; i++)
    {
        let series = dataBuffers[i];
        // let minY = Math.floor(Math.min.apply(null,series));
        // let maxY = Math.ceil(Math.max.apply(null,series));
        let minY = Math.min.apply(null,series);
        let maxY = Math.max.apply(null,series);
        if (data_minY > minY) data_minY = minY;
        if (data_maxY < maxY) data_maxY = maxY;
    }

    // prevent divide by zero
    if (data_minY == data_maxY)
        data_maxY = data_minY + 1;
    if (debug_plot)
        console.log("drawPlot() min="+data_minY+"  max="+data_maxY);

    // Develop a 'divisor' that will be used to round the min and max
    // to nice values and generate a resaonsble number of tick marks.
    // Start by getting the range, and its mantissa and exponent.

    const range = data_maxY - data_minY;
    let exp1 = Math.floor(Math.log10(range));
    let mant1 = range / Math.pow(10, exp1);

    // The mantissa approximates the number of 'natural' tick marks,
    // i.e. if its 3.141 then we would probably 'naturally' want 4 tick marks.
    //  with 3 intervals of 1.
    // However, lets say we always want between 5 and 10 tick marks,
    //  so in that case we would double the number of tick marks to 8,
    //  and halve the interval to 0.5

    let interval = 1;
    let ticks = Math.ceil(mant1);    // the 'natural' number of tick marks
    if (ticks < 7)
    {
        ticks *= 2;
        interval = 0.5;
    }

    // create the divisor as the interval with the same
    // exponent as the original range.

    let divisor = interval * Math.pow(10, exp1);

    const new_min = Math.floor(data_minY / divisor) * divisor;
    const new_max = Math.ceil(data_maxY / divisor) * divisor;

    if (debug_plot)
        console.log("drawPlot() new_min="+new_min+"  new_max="+new_max);

    data_maxY = new_max;
    data_minY = new_min;

    drawFrame(data_minY, data_maxY, divisor);

    for (let i=0; i<num_series; i++)
    {
        if (debug_plot > 1)
            console.log("   series(" + i + ")");
        ctx.strokeStyle = seriesColors[i % seriesColors.length];
        let started = 0;
        let prev_val = null;
        for (let j=0; j<plot_curX; j++)
        {
            var val = dataBuffers[i][j];        // guaranteed to exist
            if (!started && prev_val !== null)
            {
                started = 1;
                ctx.beginPath();
                let scaled = plot_maxY * (prev_val - data_minY) / (data_maxY - data_minY);
                if (debug_plot > 1)
                    console.log("      scaled start(" + prev_val + ")=" + scaled);
                ctx.moveTo(plot_Left + j-1,plot_Top + plot_maxY - scaled);
            }
            if (started)
            {
                let scaled = plot_maxY * (val - data_minY) / (data_maxY - data_minY);
                if (debug_plot > 1)
                    console.log("      scaled(" + val + ")=" + scaled);
                ctx.lineTo(plot_Left + j,plot_Top + plot_maxY - scaled);
            }
            prev_val = val;
        }

        if (started)
            ctx.stroke();
    }

}
