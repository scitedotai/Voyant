function TermsRadio(config) {
	this.parent = config.parent;
	this.container = config.container;
	this.chart = null;
	
	this.absMaxFreq = 0;
	this.absMinFreq = 0;
	this.allData = [];
	
	this.theme = Ext.create('Ext.chart.theme.Base');
	this.colorIndex = [];
	this.colorMasterList = [];
	
	this.colorMasterList = this.theme.getColors();
	for (var i = 0; i < this.colorMasterList.length; i++) {
		this.colorIndex.push(this.colorMasterList[i]);
	}
	
	
	this.continueTransition = true;
	this.counterSeries = [];
	this.displayData = [];
	this.dragged = false;
//	this.intervalIdArray = [];
	this.isTransitioning = false;
	this.lastSlippery = null;
	this.lastSticky = null;
	this.maxFont = 30;
	this.minFreq = 0;
	this.numDataPoints = 0;
	this.numVisPoints = 5;
	this.overlayQueue = [];
	this.records = 0;
	this.recordsLength = 0;
	this.reselectTop = false;
	this.shiftCount = 0;
	this.sliderDragSum = 0;
	this.titlesArray = [];
	this.transitionCall = 'draw'; //possible calls 'draw', 'redraw', 'left', and 'right'
	this.valFraction = 1;
	this.win = 0;
	
	//window padding dimensions, b - bottom, l - left, r - right, t - top
	this.bPadding = 25;
	this.lPadding = 40;
	this.rPadding = 20;
	this.tPadding = 20;
	this.navigationHeight = 100;
	
	//tracks largest dimensions, used in resizing
	this.largestW = 0;
	this.largestH = 0;
	
	this.xAxis = {};
	this.xAxisScale = d3.svg.axis();
	this.yAxis = {};
	this.yAxisScale = d3.svg.axis();
	
	this.fontScale = d3.scale.linear();
	this.opacityScale = d3.scale.linear();
	
	this.yScale = null;
	this.ySliderScale = null;
	
	this.xScale = d3.scale.linear();
	this.xSliderScale = d3.scale.linear();
	
}

TermsRadio.prototype = {
	constructor: TermsRadio
	
	,loadRecords: function(records) {
		this.initData(records);
		this.prepareData();
		//for shiftcount > 0 exclusively
		var len = this.shiftCount;
		while(len-- > 0){
		//for(var j = 0; j < this.shiftCount; j++){
			this.displayData.shift();
		}
		if (this.chart != null) {
			this.redraw();
		} else {
			this.initializeChart();
		}
		
		this.redrawSliderOverlay();
	}

	,highlightQuery: function(query, sticky) {
		var docId = null;
		if (this.parent.getApiParam("mode") === 'document') {
			docId = this.parent.getCorpus().getDocument(0).getId();
		}
		var info = {wordString : query, docId : docId};
		var paramsBundle = this.buildParamsBundle(info);
		if (sticky) {
			this.manageOverlaySticky(paramsBundle);
		} else {
			this.manageOverlaySlippery(paramsBundle);
		}
	}
	
	,highlightRecord: function(record, sticky) {
		var info = {wordString : record.get('term'), docId : record.get('docId')};
		var paramsBundle = this.buildParamsBundle(info);
		if (sticky) {
			this.manageOverlaySticky(paramsBundle);
		} else {
			this.manageOverlaySlippery(paramsBundle);
		}
	}
	
	//
	//DATA FUNCTIONS
	//	

	,initData: function (records) { 	
		//console.log("fn: initData")
		//console.profile('profilethis')
		this.records = records;
		
		this.recordsLength = this.records.length;
	
		this.numVisPoints = parseInt(this.parent.getApiParam('visibleBins'));
		this.shiftCount = parseInt(this.parent.getApiParam('position'));
		
		if(this.parent.getApiParam('mode') === 'document') {
			this.numDataPoints = this.records[0].get('distributions').length;
			var parentBins = parseInt(this.parent.getApiParam('bins'));
			if(this.numDataPoints !== parentBins){
				this.numDataPoints = parentBins;
				this.loadStore();
			}
		} else {
			this.numDataPoints = this.records[0].get('distributions').length;
		}
		
    	this.counterSeries = [];
    	var transferArray = [];
			
    	//find max frequency value
    	this.absMaxFreq = 0;
		for( var k = 0; k < this.numDataPoints; k++ ) { 
	        for( var p = 0; p < this.recordsLength; p++ ) {
	        	if(this.records[p].get('distributions')[k] > this.absMaxFreq) {
	        		this.absMaxFreq = this.records[p].get('distributions')[k];
	        	}
	        }
		}
			    
		//find the absolute minimum frequency value
		//first start by setting the minimum frequency to the maximum frequency
		this.absMinFreq = this.absMaxFreq;
		for( var k = 0; k < this.numDataPoints; k++ ) { 
	        for( var p = 0; p < this.recordsLength; p++ ) {
	        	if(this.records[p].get('distributions')[k] <= this.absMinFreq && this.records[p].get('distributions')[k] !== 0) { 
	        		this.absMinFreq = this.records[p].get('distributions')[k];
	        	}
	        }
		}
		
		//Calculate the lower value of the y axis, must be > 0 
		if( this.absMinFreq < 0) {
			this.absMinFreq = 0;
		}
		
		this.minFreq = this.absMinFreq * 1.01;
		
	    //transfer all of the relevant data from 'records' to an array 'allData'
		for( var k = 0; k < this.numDataPoints; k++ ) { 
	        for( var p = 0; p < this.recordsLength; p++ ) {
	        	var rec = this.records[p];
	        	var dists = rec.get('distributions')[k];
//	        	if (dists > this.minFreq && dists <= this.absMaxFreq) {
	        	if (dists > 0) {
	        		transferArray.push({
	        			freq: dists,
		                wordString: rec.get('term'),
		                counter: k,
		                posInSeries: 0, 
		                numInSeries: 0,
		                docId: rec.get('docId')
		            });
	        	}
//	        	} else { //do nothing
//	        	}
	        }
	        this.counterSeries.push(transferArray);
	        transferArray = [];
	    }
	}

	,prepareData: function() {
		//console.log("fn: prepareData")
	    var frequencySeries = [],
	    	copy1 = [],
	    	copy2 = [],
	    	copy3 = [],
	    	copy4 = [],
	    	check = 0;
		
		this.allData = [];
		this.displayData = [];
		
		//set the number of points to be displayed at once
		if(this.numDataPoints < this.numVisPoints) {
			this.numVisPoints = this.numDataPoints;
		}
		
		//adjust shiftCount if it for some reason is out of the normal range
		if(this.shiftCount + this.numVisPoints > this.numDataPoints){ 
			this.shiftCount = this.numDataPoints - this.numVisPoints; 
		}
		
	    for( var k = 0; k < this.numDataPoints; k++ ) {
			var check1 = 0; //add a single first data point
	    	for(var p = 0; p < this.counterSeries[k].length; p++ ) {
	    			
    			var check2 = 0; //check will make sure a data point is not added to a series more than once
    			
	    		//add very first point, this is done like this so the for loop can use the .length operator
	    		if(check1 === 0){
			    	copy1.push(this.counterSeries[k][p]);
			    	copy2.push({freq: this.counterSeries[k][p].freq,
		    			frequencyArray: copy1,
		    			numInSeries: 0
		    		});
		    		frequencySeries.push(copy2);
		    		
		    		copy1 = [];
		    		copy2 = [];
		    		check1 = 1;
		    		check2 = 1;
	    		}
	    		
	    		//checks if a given frequency has an existing 'series' that the data point can be grouped into
	    		for( var l = 0; l < frequencySeries[k].length && check2 === 0; l++) {
					if(this.counterSeries[k][p].freq === frequencySeries[k][l].freq) {
						var inSeries = 0; 
						inSeries = frequencySeries[k][l].numInSeries;
						this.counterSeries[k][p].posInSeries = ++inSeries;
						frequencySeries[k][l].numInSeries = inSeries;
						frequencySeries[k][l].frequencyArray.push(this.counterSeries[k][p]);
						check2 = 1;
					}	
	    		}
	    		
	    		//if there is no existing series then create a new one
	    		if(check2 === 0) {
					copy4.push(this.counterSeries[k][p]);
		    		frequencySeries[k].push({freq: this.counterSeries[k][p].freq,
		    			frequencyArray: copy4,
		    			numInSeries: 0
		    		});
		    		copy4 = [];
		    		check2 = 1;
				}
	    	}	
	    	//if counterSeries[k] is empty add or there is no eligible value add an empty array to frequencySeries such that frequencySeries[k] is not undefined
	    	if(this.counterSeries[k].length < 1 || check1 === 0) {  
	    		frequencySeries.push([]);
    		}
	    }
	    
	    for( var k = 0; k < this.numDataPoints; k++ ) {
	    	for( var p = 0; p < frequencySeries[k].length; p++) {
	    		++frequencySeries[k][p].numInSeries;
	    		for( var l = 0; l < frequencySeries[k][p].frequencyArray.length; l++) {
	    			frequencySeries[k][p].frequencyArray[l].numInSeries = frequencySeries[k][p].numInSeries;
	    		}
	    	}
	    }
	    
	    var allDataSetup = [];
	    
	    //add the selected points into the array that will be used to display the data
	    for( var k = 0; k < this.numDataPoints; k++ ) {
	        this.allData.push({allDataInternal: frequencySeries[k],
	            outerCounter: k});
	    }
	    
    	var displaySetup = [],
    		transferArray = [];
		
	    //transfer the first x points (= numVisPoints, the number of points to be visualized)
	    //into an array that will be used to display the data
	    for( var k = 0; k < this.numVisPoints + this.shiftCount; k++ ) { 
	        for( var p = 0; p < this.recordsLength; p++ ) {
	        	if(this.allData[k].allDataInternal[p]) {
		            transferArray.push({freq: this.allData[k].allDataInternal[p].freq,
		                inSeries: this.allData[k].allDataInternal[p].numInSeries,
		                frequencyArray: this.allData[k].allDataInternal[p].frequencyArray,
		                dotObject: [{counter: k, freq: this.allData[k].allDataInternal[p].freq}]
		            });
	        	}
	        }
	        displaySetup.push(transferArray);
	        transferArray = [];
	    }
	    
	    //add the selected points into the array that will be used to display the data
	    for( var k = 0; k < this.numVisPoints + this.shiftCount; k++ ) {
	        this.displayData.push({displayInternal: displaySetup[k],
	            outerCounter: k});
	    }
	    displaySetup = [];
	}
	
	//TRANSITION FUNCTIONS
	
	//disable forward back if moving, disable pause if stopped, disable back if at beginning
	,manageMvtButtons: function () {
		//console.log('fn: manageMvtButtons')
		this.parent.queryById("play").setPlaying(this.isTransitioning);
		/*
		if(this.isTransitioning === true) {
			this.toggleRight.setDisabled(true);
			this.toggleLeft.setDisabled(true);
			this.stop.setDisabled(false);
		}
		if(this.isTransitioning === false) {
			this.toggleRight.setDisabled(false);
			this.toggleLeft.setDisabled(false);
			this.stop.setDisabled(true);
			
			if(this.shiftCount === 0){
				this.toggleLeft.setDisabled(true);
			} else {
				this.toggleLeft.setDisabled(false);
			}
			
			if(this.shiftCount + this.numVisPoints === this.numDataPoints){
				this.toggleRight.setDisabled(true);
			} else {
				this.toggleRight.setDisabled(false);
			}
		}	
		*/
	}

	//provides the next value to the left     
    ,nextR: function () {
    	//console.log('fn: nextR')
    	
    	var displaySetup = [];
    	//this.displayData.shift();
		
    	for( var p = 0; p < this.recordsLength; p++ ) {
    		if(this.allData[this.numVisPoints + this.shiftCount].allDataInternal[p]) {
	            displaySetup.push({freq: this.allData[this.numVisPoints + this.shiftCount].allDataInternal[p].freq,
	            	inSeries: this.allData[this.numVisPoints + this.shiftCount].allDataInternal[p].numInSeries,
	            	frequencyArray: this.allData[this.numVisPoints + this.shiftCount].allDataInternal[p].frequencyArray,
	                dotObject: [{counter: this.numVisPoints + this.shiftCount, freq: this.allData[this.numVisPoints + this.shiftCount].allDataInternal[p].freq}]
	            });
    		}
        }
        
	    this.displayData.push({displayInternal: displaySetup, outerCounter: this.numVisPoints + this.shiftCount});
	    displaySetup = [];
    }
    
    //verifies that data CAN be moved to the right
    ,toggleRightCheck: function () {
    	//console.log("fn: toggleRightCheck")
    	if(this.numVisPoints + this.shiftCount < this.numDataPoints) {
    		//manage transition movements and controls
    		this.isTransitioning = true;
    		this.continueTransition = true;
    		this.manageMvtButtons();
    		
    		//draw
	        this.nextR();
			this.shiftCount = ++this.shiftCount;
			this.manageXScale();
			this.parent.setApiParams({position: this.shiftCount});
			this.transitionCall = 'right';
			this.animateVis();
			this.displayData.shift();
		} else {
    		//manage transition movements and controls
			this.isTransitioning = false;
			this.continueTransition = false;
			this.manageMvtButtons();
		}
    }
    
    //provide the next value
    ,nextL: function () {
    	//console.log('fn: nextLeft')
    	var displaySetup = [];
        
        for( var p = 0; p < this.recordsLength; p++ ) {
        	if(this.allData[this.shiftCount].allDataInternal[p]) {
        		displaySetup.push({freq: this.allData[this.shiftCount].allDataInternal[p].freq,
	            	inSeries: this.allData[this.shiftCount].allDataInternal[p].numInSeries,
	            	frequencyArray: this.allData[this.shiftCount].allDataInternal[p].frequencyArray,
	                dotObject: [{counter: this.shiftCount, freq: this.allData[this.shiftCount].allDataInternal[p].freq}]
	            });
        	}
        }
	    this.displayData.unshift({displayInternal: displaySetup, outerCounter: this.shiftCount});
        displaySetup = [];
    }
    
    /*
    ,toggleLeftCheck: function () {    	
    	//console.log("fn: toggleLeftCheck")
    	if(this.shiftCount > 0) {
    		//manage transition movement and controls
    		this.isTransitioning = true;
			this.continueTransition = true;
			this.manageMvtButtons();
			
			//draw
			this.shiftCount = --this.shiftCount;
			this.manageXScale();
			this.parent.setApiParams({position: this.shiftCount});
	        this.nextL();
			this.transitionCall = 'left';
	        this.animateVis();
	        this.displayData.pop();
		} else {
			//manage transition movements and controls
			this.isTransitioning = false;
			this.manageMvtButtons();
		}
    }
    */
    
    ,startScroll: function() {
    	//console.log("fn: startScroll")
    	var toolObject = this;
    	
    	if(toolObject.numDataPoints > toolObject.numVisPoints && toolObject.shiftCount === 0){
			//manage transition movements and controls
			toolObject.isTransitioning = true;
			this.manageMvtButtons();
    		
    		//repeat transition
			setTimeout(function(){
				toolObject.toggleRightCheck();
			},3000);
		}
    }
    
    //
    //DISPLAY FUNCTIONS
    //
	
	
	// init and draw everything
	,initializeChart: function() {
		this.initChart();
		
		this.drawXAxis();
		this.drawYAxis();
		this.drawChart();
		this.drawSlider();
		this.drawVerticalSlider();
		this.transitionCall = 'draw';
	}
	
    ,redraw: function() {

//    	console.log("fn: redraw")
    	this.transitionCall = 'redraw';
    	this.updateFullPath();
		this.redrawXAxis();
		this.redrawYAxis();
		this.redrawChart();
		this.redrawSlider();
		this.redrawVerticalSlider();
		this.redrawChartOverlay();
    }
    
	,initChart: function () {
//		console.log('fn: initChart')
		
		var innerCt = this.container.query('div[class$=innerCt]', false)[0];
		
		var h = innerCt.getHeight(),
			w = innerCt.getWidth();
    
		//create main SVG Element
		var chartSVG = innerCt.appendChild(Ext.DomHelper.createDom('<svg class="chart" width="'+w+'" height="'+h+'"></svg>'), true);
	    this.chart = d3.select(chartSVG);
	    
		this.largestW = w;
		this.largestH = h - this.navigationHeight;
	    	    
	    this.chart.append('clipPath')
	        .attr('id', 'clip1')
	      .append('rect')
	      	.attr('class', 'clipping-rectangle')
	        .attr("x", 0)
	        .attr("y", this.navigationHeight + (this.tPadding * 2))
	        .attr("width", w)
	        .attr("height", h - this.navigationHeight);
	    
	    this.chart.append('g')
	    	.attr('class','overlay')
	    	.attr("clip-path", "url(#clip1)");
	    
		//depending on the size of display set the length that labels can be
		this.setTitleLength();
	}
    
	,doResize: function() {
		if(this.chart) {
			var h = this.container.getHeight(),
				w = this.container.getWidth();
			
			this.chart.attr('height', h)
				.attr('width', w);
				
			this.setTitleLength();
			
			if(this.largestH < h && this.largestW < w) {
				this.chart.select('rect[class=clipping-rectangle]')
			        .attr("x", 0)
			        .attr("y", this.navigationHeight + (this.tPadding * 2))
			        .attr("width", w)
			        .attr("height", h - this.navigationHeight);
				this.largestH = h;
				this.largestW = w;
			}
		
			this.redraw();	
			this.redrawSliderOverlay();
		}
	}
	
    ,drawXAxis: function() {
    	var toolObject = this;
    	//svg element constants
		var h = this.container.getHeight(),
			w = this.container.getWidth();
    	
		//initialize x scales
		this.manageAllXScales();
			
    	//define X axis
		this.xAxisScale.scale(toolObject.xScale)
		    .orient('bottom')
		    .ticks(Math.round(toolObject.numVisPoints))
		    .tickFormat(function(d){
		    	var val;
		    	if(toolObject.parent.getApiParam('mode') === 'document') { 
					val = 'Segment ' + (parseInt(d) + 1);
				}
				if(toolObject.parent.getApiParam('mode') === 'corpus') {
					val = d + 1 + '. ' + toolObject.titlesArray[d];
				}
				return val;
		    });
		
		//draw the x-axis
		this.xAxis = this.chart.append('g')
    		.attr('class', 'axisX')
    		.attr('transform', 'translate(0,' + (h - this.bPadding) + ')')
    		.call(this.xAxisScale);
    	
//    	this.xAxis.selectAll('text')
//			.on('mouseover', function () {
//				d3.select(this)
//					.attr('fill', 'red')
//					.style("font-size", '18px');
//			})
//			.on('mouseout', function () {
//				d3.select(this)
//					.attr('fill', 'black')
//					.style("font-size", '11px');
//			});
		this.styleXAxis();
    }
    
    ,styleXAxis: function() {
    	this.xAxis.selectAll('text')
	        .style('font-family', 'sans-serif')
	        .style('font-size', '11px');

	    this.xAxis.selectAll('line')
	        .style('fill','none')
	        .style('stroke','black')
	        .style('shape-rendering', 'crispEdges');
	        
	    this.xAxis.selectAll('path')
	        .style('fill','none')
	        .style('stroke','black')
	        .style('shape-rendering', 'crispEdges');
    }
    
    ,redrawXAxis: function() {
    	this.chart.selectAll('g[class=axisX]')
			.remove();
		
		this.drawXAxis();
    }
    
    ,drawYAxis: function() {
    	var toolObject = this;
    	
    	//svg element constants
		var h = this.container.getHeight(),
			w = this.container.getWidth();
		
		//initialize Y scales
		this.manageAllYScales();
    	
    	var yTicksScale = d3.scale.linear()
			.domain([200,700])
			.range([5,15]);
			
		var numberFormat = d3.format(".2r");
		function logFormat(d) {
			var x = Math.log(d) / Math.log(10) + 1e-6;
			return Math.abs(x - Math.floor(x)) < 0.7 ? numberFormat(d) : "";
		} 
		
		this.yAxisScale.scale(toolObject.yScale)
	    	.orient('left')
	    	.ticks(yTicksScale(this.container.getHeight()))
	    	.tickFormat(logFormat)
			.tickSize(-w + this.rPadding + this.lPadding);
		
		//draw the y-axis
		this.yAxis = this.chart.append('g')
	    	.attr('class', 'axisY')
	    	.attr('transform', 'translate(' + this.lPadding + ',0)')
	    	.call(this.yAxisScale);
		
	    this.yAxis.selectAll('text')
	        .style('font-family', 'sans-serif')
	        .style('font-size', '11px');
	    
	    //controls horizontal grid line-opacity
	    this.yAxis.selectAll('line')
	        .style('fill','none')
	        .style('stroke','black')
	        .style('shape-rendering', 'crispEdges')
	        .style('stroke-opacity', 0.05);
	        
	    this.yAxis.selectAll('path')
	        .style('fill','none')
	        .style('stroke','black')
	        .style('shape-rendering', 'crispEdges');
    }
    
    ,redrawYAxis: function() {
    	this.chart.selectAll('g[class=axisY]')
			.remove();
		
		this.drawYAxis();
    }
    
    ,drawChart: function() {
    	var toolObject = this;
    	
    	//create graph text
	    //attach the nested data to svg:g elements
		var counterSeriesDiv = this.chart.selectAll('g[class=section]')
	        .data(toolObject.displayData, function(d) { return d.outerCounter; })
	      .enter().append('g')
	        .attr('class', 'section')
	        .attr("clip-path", "url(#clip1)");
		
		var frequencySeriesDiv = counterSeriesDiv.selectAll('g')
			.data(function(d) { return d.displayInternal; })
	      .enter().append('g')
	        .attr('class', 'frequencies')
	        .on('mouseover', function() {
				d3.select(this).style('fill', 'red');
			})
			.on('mouseout', function() {
	            d3.select(this).style('fill', 'black');
			});
	             
        //attach the frequency data to data points 
		var dataPoint = frequencySeriesDiv.selectAll('text')
    		.data(function(d) { return d.frequencyArray; })
		  .enter().append('text')
	        .attr('class', function(d) {
	        	return toolObject.removeFilteredCharacters(d.wordString);
	        })
	    	.attr('x', function (d) {
	    		var startPoint = (0.5 / d.numInSeries) - 0.5
					,valueRange = (d.posInSeries / d.numInSeries * 0.8)
					,x = d.counter + toolObject.callOffset() + startPoint + valueRange; 
				return toolObject.xScale(x);
			})
	    	.attr('y', function (d) { 
				var y = d.freq;
				return toolObject.yScale(y);
	    	})
	    	.attr('text-anchor', 'middle')
	    	.attr('transform', function (d) {
	    		var startPoint = (0.5 / d.numInSeries) - 0.5
					,valueRange = (d.posInSeries / d.numInSeries * 0.8)
					,x = d.counter + toolObject.callOffset() + startPoint + valueRange
					,y = d.freq;
	    		return 'translate(0, 0) rotate(-20 ' + toolObject.xScale(x) + ' '+ toolObject.yScale(y) + ')';
	    	})
	    	.style('font-size', function(d) { return toolObject.fontScale(d.freq) + 'px'; })
	    	.style('fill-opacity', function(d) { return toolObject.opacityScale(d.freq); })
	        .text(function(d) { return d.wordString; })
	        .on('mouseover', function(d) { 
	 	        d3.select(this).style('cursor', 'pointer').style('font-size', function(d) { return (toolObject.fontScale(d.freq) * toolObject.maxFont / toolObject.fontScale(d.freq)) + 'px'; });
	 	        var paramsBundle = toolObject.buildParamsBundle(d);
	 	        toolObject.manageOverlaySlippery(paramsBundle);
	        })
	        .on('mouseout', function(d) { 
	        	d3.select(this).style('cursor', 'auto').style('font-size', function(d) { return toolObject.fontScale(d.freq) + 'px'; });
	        	var paramsBundle = toolObject.buildParamsBundle(d);
	        	toolObject.manageOverlaySlippery(paramsBundle);
	        })
	        .on('click', function(d) {
	        	var paramsBundle = toolObject.buildParamsBundle(d);
	        	toolObject.manageOverlaySticky(paramsBundle);
			})
	  	  .append('title')
	    	.text(function(d) { return d.wordString; });
    }
    
    ,redrawChart: function() {
    	this.chart.selectAll('g[class=section]')
			.remove();
			
		this.drawChart();
    }
    
    ,drawVerticalSlider: function() {
//    	var h = this.container.getHeight(),
//			w = this.container.getWidth();
//    	
//    	var totalTopOffset = (this.tPadding * 2) + this.navigationHeight
//        	,lengthVer = h - (totalTopOffset + this.bPadding);
//        
//	    //create vertical minimap rectangle and slider
//	    var sliderPosScale = d3.scale.linear()
//			.domain([this.absMaxFreq, this.minFreq])
//			.range([totalTopOffset, lengthVer]);
//	    
//	    var rectVer = this.chart.append('rect')
//	  	    .attr('class', 'minimap')
//	  	    .attr('x', w - (this.rPadding * 0.66))
//	  	    .attr('y', totalTopOffset)
//	  	    .attr('rx', 3.33)
//	  	    .attr('width', 6.66)
//	  	    .attr('height', lengthVer)
//	  	    .style('fill','aliceblue')
//	  	    .style('stroke','black')
//	  	    .style('stroke-width','1')
//	  	    .style('fill-opacity','0.75');
//	    	
//	    var sliderVer = this.chart.append('rect')
//			.attr('class', 'minimap')
//	  	    .attr('x', w - (this.rPadding * 0.66))
//	  	    .attr('y', totalTopOffset)
//	  	    .attr('rx', 3.33)
//	  	    .attr('width', 6.66)
//	  	    .attr('height', lengthVer * ((this.absMaxFreq * this.valFraction) - this.minFreq) / this.absMaxFreq)
//	  	    .style('fill','CornflowerBlue')
//	  	    .style('stroke','black')
//	  	    .style('stroke-width','1');
    }
    
    ,redrawVerticalSlider: function() {
    	this.chart.selectAll('rect[class=minimap]')
			.remove();
			
		this.drawVerticalSlider();
    }
    
    ,drawSlider: function() {
    	var h = this.container.getHeight(),
			w = this.container.getWidth();
	    
		//Create navigation bar
		var lengthHor = w - (this.rPadding + this.lPadding)
			,offsetVis = this.lPadding + (lengthHor * ((this.numVisPoints - 1) / 2) * ( 1 / (this.numDataPoints - 1)))
			,offsetVisStart = this.lPadding
			,offsetVisEnd = this.lPadding + (lengthHor * ((this.numVisPoints - 1) / (this.numDataPoints - 1)));
		
		var lineX = this.chart.append('line')
			.attr('class', 'sliderAxis')
			.attr('x1', this.lPadding)
			.attr('x2', this.container.getWidth() - this.rPadding)
			.attr('y1', this.tPadding + this.navigationHeight)
			.attr('y2', this.tPadding + this.navigationHeight)
			.style('shape-rendering', 'crispEdges')
			.style('stroke','black')
	  	    .style('stroke-width','1');
					
		var lineY = this.chart.append('line')
			.attr('class', 'sliderAxis')
			.attr('x1', this.lPadding)
			.attr('x2', this.lPadding)
			.attr('y1', this.tPadding + this.navigationHeight)
			.attr('y2', this.tPadding)
			.style('shape-rendering', 'crispEdges')
			.style('stroke','black')
	  	    .style('stroke-width','1');
		
	    var sliderHorStart = this.chart.append('line')
	  	    .attr('class', 'slider')
	  	    .attr('id', 'before')
	  	    .attr('x1', (lengthHor * (this.shiftCount - this.callOffset()) / (this.numDataPoints - 1)) + offsetVisStart)
	  	    .attr('x2', (lengthHor * (this.shiftCount - this.callOffset()) / (this.numDataPoints - 1)) + offsetVisStart)
	  	    .attr('y1', this.tPadding + this.navigationHeight)
	  	    .attr('y2', this.tPadding)
	  	    .style('stroke', 'black')
	  	    .style('stroke-width', '1');
	    
	    var sliderHorEnd = this.chart.append('line')
	  	    .attr('class', 'slider')
	  	    .attr('id', 'after')
	  	    .attr('x1', (lengthHor * (this.shiftCount - this.callOffset()) / (this.numDataPoints - 1)) + offsetVisEnd)
	  	    .attr('x2', (lengthHor * (this.shiftCount - this.callOffset()) / (this.numDataPoints - 1)) + offsetVisEnd)
	  	    .attr('y1', this.tPadding + this.navigationHeight)
	  	    .attr('y2', this.tPadding)
	  	    .style('stroke', 'black')
	  	    .style('stroke-width', '1');
	  	    	  	    
	   var greyBoxBefore = this.chart.append('rect')
  	    	.attr('class', 'slider')
  	    	.attr('id', 'boxBefore')
  	    	.attr('x', this.lPadding)
  	    	.attr('y', this.tPadding)
  	    	.attr('height', this.navigationHeight)
  	    	.attr('width', lengthHor * (this.shiftCount - this.callOffset()) / (this.numDataPoints - 1))
  	    	.style('fill', 'silver')
  	    	.style('fill-opacity', 0.25)
	    	.style('cursor', 'move');
	    		    
	    var greyBoxAfter = this.chart.append('rect')
	    	.attr('class', 'slider')
	    	.attr('id', 'boxAfter')
	    	.attr('x', (lengthHor * (this.shiftCount - this.callOffset()) / (this.numDataPoints - 1)) + offsetVisEnd)
	    	.attr('y', this.tPadding)
	    	.attr('height', this.navigationHeight)
	    	.attr('width', lengthHor * (this.numDataPoints - this.numVisPoints - this.shiftCount + this.callOffset()) / (this.numDataPoints - 1))
	    	.style('fill', 'silver')
	    	.style('fill-opacity', 0.25)
	    	.style('cursor', 'move');
	    
	    var toolObject = this;
    	var drag = d3.behavior.drag()
        .origin(Object)
        .on('drag', function(d) {
        	if(!toolObject.isTransitioning) {
        		this.drag = true;
        		
	        	var w = toolObject.getWidth()
	        		,displaceX = parseInt(d3.event.dx)
	        		,checkBefore
	        		,checkAfter
	        		,pos = 0;
	        		
	        	//add up the slider movements as they occur	
        		toolObject.sliderDragSum += d3.event.dx;
	        	
	        	toolObject.chart.selectAll('#before')
	        		.attr('x1', function () { 
	        			checkBefore = parseInt(this.getAttribute('x1'));
	        			pos = parseInt(this.getAttribute('x1')) + displaceX;
	        			return parseInt(this.getAttribute('x1'));
	        		});
	        	
	        	toolObject.chart.selectAll('#after')
	        		.attr('x1', function () { 
	        			checkAfter = parseInt(this.getAttribute('x1'));
	        			return parseInt(this.getAttribute('x1'));
	        		});
	        	
	        	if(checkBefore + displaceX < toolObject.lPadding || checkAfter + displaceX > w - toolObject.rPadding) {
	        		displaceX = 0;
	        	}
	        	
	        	toolObject.chart.select('#boxBefore')
	        		.attr('width', function () { return parseInt(this.getAttribute('width')) + displaceX; });
	        	
	        	toolObject.chart.select('#boxAfter')
	        		.attr('x', function () { return parseInt(this.getAttribute('x')) + displaceX; })
        			.attr('width', function () { return parseInt(this.getAttribute('width')) - displaceX; });
	        		
	        	toolObject.chart.selectAll('#before')
	        		.attr('x1', function () { return parseInt(this.getAttribute('x1')) + displaceX; })
	        		.attr('x2', function () { return parseInt(this.getAttribute('x2')) + displaceX; });
	        	
	        	toolObject.chart.selectAll('#after')
        			.attr('x1', function () { return parseInt(this.getAttribute('x1')) + displaceX; })
        			.attr('x2', function () { return parseInt(this.getAttribute('x2')) + displaceX; });
        	}
        })
        .on('dragend', function(d) {
        	if(this.drag){
        		this.drag = false;
        		
        		var inverseSliderScale = d3.scale.linear()
			    	.domain([0, toolObject.container.getWidth() - (toolObject.lPadding + toolObject.rPadding)])
			    	.range([0, toolObject.numDataPoints]);
			    	
				//calculate the position that everything should transition to
	        	var moveByThis = inverseSliderScale(toolObject.sliderDragSum),
	        		moveShiftCount,
	        		oldShiftCount = toolObject.shiftCount;
	        		
	    		if(moveByThis > 0) moveShiftCount = Math.floor(moveByThis);
	    		if(moveByThis < 0) moveShiftCount = Math.ceil(moveByThis);
	    		
	    		//update shiftCount re-animate 
	    		toolObject.shiftCount += moveShiftCount;
	    		if(toolObject.shiftCount < 0) toolObject.shiftCount = 0;
	    		if(toolObject.shiftCount > toolObject.numDataPoints - 1) toolObject.shiftCount = toolObject.numDataPoints - 1;
	    		
	    		if(toolObject.shiftCount !== oldShiftCount) {
	    			toolObject.sliderDragSum = 0;
	    			
	        		toolObject.parent.setApiParams({position: toolObject.shiftCount});
					toolObject.prepareData();
					
					toolObject.redraw();
	        	}
        	}
        });
	    
	    greyBoxBefore.call(drag);
	    greyBoxAfter.call(drag);
    }
    
    ,redrawSlider: function() {
    	this.chart.selectAll('rect[class=slider]')
	    	.remove();
		
		this.chart.selectAll('line[class=slider]')
		    .remove();
		
		this.chart.selectAll('line[class=sliderAxis]')
	    	.remove();
	    	
    	this.drawSlider();
    }
	
	,animateVis: function() {
		var toolObject = this;
		
		//prepare the data for the visualization
		//shiftCount = 0, means the displayData begins with the same value as nestedData
		var mode = this.parent.getApiParam('mode');
		
	    //svg element constants
		var h = this.container.getHeight(),
			w = this.container.getWidth();

		var duration = this.getDuration();
		
		//if transitionCall === 'draw': draw the function for the first time		
		//if not: shift displayData to a different subset of allData
		//then display the newly shifted data	
		if(this.transitionCall === 'left' || this.transitionCall ==='right'){
			this.xAxis.transition()
	            .duration(duration)
	            .ease('linear')
	            .call(this.xAxisScale);
	            
	        this.styleXAxis();
	        
	        this.drawChart();
	    
        	//if call is shift move the dataPoints	
        	this.chart.selectAll('.frequencies').transition()
        		.duration(duration)
	            .ease('linear')
	            .selectAll('text')
	            .attr('x', function (d) {
	            	var startPoint = (0.5 / d.numInSeries) - 0.5,
						valueRange = (d.posInSeries / d.numInSeries * 0.8),
						x = d.counter + startPoint + valueRange; 
					return toolObject.xScale(x);
				})
				.attr('transform', function (d) {
		    		var startPoint = (0.5 / d.numInSeries) - 0.5
						,valueRange = (d.posInSeries / d.numInSeries * 0.8)
						,x = d.counter + startPoint + valueRange
						,y = d.freq;
		    		return 'translate(0, 0) rotate(-20 ' + toolObject.xScale(x) + ' '+ toolObject.yScale(y) + ')';
				});
	    	   
        	//Create navigation bar
			var lengthHor = w - (this.rPadding + this.lPadding)
				,offsetVis = this.lPadding + (lengthHor * ((this.numVisPoints - 1) / 2) * ( 1 / (this.numDataPoints - 1)))
				,offsetVisStart = this.lPadding
				,offsetVisEnd = this.lPadding + (lengthHor * ((this.numVisPoints - 1) / (this.numDataPoints - 1)));
				
        	this.chart.select('#before').transition()
				.duration(duration)
				.ease('linear')
			 	.attr('x1', (lengthHor * this.shiftCount / (this.numDataPoints - 1)) + offsetVisStart)
			 	.attr('x2', (lengthHor * this.shiftCount / (this.numDataPoints - 1)) + offsetVisStart)
		  	    .attr('y1', this.tPadding + this.navigationHeight)
		  	    .attr('y2', this.tPadding)
		  	    .each('end', function () {
		  	    	if (toolObject.isMasked()) {
		  	    		toolObject.unmask();
		  	    	}
		  	    	if(toolObject.continueTransition) { 
		  	    		setTimeout(function () {
		  	    			toolObject.callTransition();
		  	    		},50); 
		  	    	} else { 
		  	    		//manage transition movements and controls
		  	    		toolObject.isTransitioning = false;
		  				toolObject.manageMvtButtons();
		  	    	}
		  	    });
        	
	  	   this.chart.select('#after').transition()
				.duration(duration)
				.ease('linear')
			 	.attr('x1', (lengthHor * this.shiftCount / (this.numDataPoints - 1)) + offsetVisEnd)
			 	.attr('x2', (lengthHor * this.shiftCount / (this.numDataPoints - 1)) + offsetVisEnd)
		  	    .attr('y1', this.tPadding + this.navigationHeight)
		  	    .attr('y2', this.tPadding);
		    
	  	   this.chart.select('#boxBefore').transition()
				.duration(duration)
				.ease('linear')
	  	    	.attr('x', this.lPadding)
	  	    	.attr('y', this.tPadding)
	  	    	.attr('height', this.navigationHeight)
	  	    	.attr('width', lengthHor * (this.shiftCount) / (this.numDataPoints - 1));
	    
	  	    this.chart.select('#boxAfter').transition()
				.duration(duration)
				.ease('linear')
	  	    	.attr('x', (lengthHor * this.shiftCount / (this.numDataPoints - 1)) + offsetVisEnd)
	  	    	.attr('y', this.tPadding)
	  	    	.attr('height', this.navigationHeight)
	  	    	.attr('width', lengthHor * (this.numDataPoints - this.numVisPoints - this.shiftCount) / (this.numDataPoints - 1));
        }
        
        //animates the chart overlay
		this.redrawChartOverlay();
	}
	
	,callTransition: function () {
		if(this.transitionCall === 'left') this.toggleLeftCheck();
        if(this.transitionCall === 'right') this.toggleRightCheck();
	}
		
	//build the params bundle to pass to manageOverlaySticky
	,buildParamsBundle: function (info) { 
		//console.log('fn: builParamsBundle')
		var type = info.wordString,
			params = {},
			paramsBundle = {},
			docId;

		if ( this.parent.getApiParam('mode') === 'document') { // set position
			docId = info.docId;
			var totalTokens = this.parent.getCorpus().getDocument(docId).get('totalTokens') - 1;
			params.tokenIdStart = parseInt(this.category * totalTokens / this.numDataPoints);
			params.docIdType = docId + ':' + type;
		} else {
		}
				
		paramsBundle = { params: params, type: type };
		
		return paramsBundle;
	}
	
	,manageOverlaySlippery: function (paramsBundle) {

		//console.log('fn: manageOverlaySlippery')
		var string = paramsBundle.type
			,selector = this.removeFilteredCharacters(paramsBundle.type) 
			,checkOn = 'on'
			,index;
		
//		this.continueTransition = true;
//
//		this.transitionCall = 'draw';
		
		//check if the word that was selected was already sticky
		//if so checkOn = off and nothing happens
		var len = this.overlayQueue.length;
		while(--len >= 0){
			if(selector === this.overlayQueue[len].selector){ 
		    	checkOn = 'off';
		    	index = len;
			}
		}
		
		//make sure the selected word wasn't just a sticky word that is being deselected
		//thus happens to be scrolled over
		if(selector === this.lastSticky){
			checkOn = 'off';
			this.lastSticky = null;
		}
		
		if(checkOn === 'on') {
			//select a slippery word
			if(selector !== this.lastSlippery) {
				var pathHolder = this.prepareFullPath(string);
				var lineObject = {
					word: string, 
					selector: selector, 
					params: paramsBundle, 
					fullPath: pathHolder.path,
					pathMin: pathHolder.min,
					pathMax: pathHolder.max,
					colour: 'red'
				};	
				if(this.lastSlippery !== null) {
					//exceptional case where lastSlippery was not properly removed
					this.chartOverlayOff(this.lastSlippery);
					this.sliderOverlayOff(this.lastSlippery);
					this.lastSlippery = null;
					
					//select new slippery word
					//change its colour
					this.chartOverlayOn(lineObject);
					this.sliderOverlayOn(lineObject);
					this.lastSlippery = selector;
				}
				else {
					//normal case select slippery word
					//change its colour
					this.chartOverlayOn(lineObject);
					this.sliderOverlayOn(lineObject);
					this.lastSlippery = selector;
				}
			}
			else{
				//normal case deselect a slippery word
				this.chartOverlayOff(selector);
				this.sliderOverlayOff(this.lastSlippery);
				this.lastSlippery = null;
			}
		}
		else {
			//else do nothing 
			//this means, don't select a word that is already sticky
		}
	}

	,manageOverlaySticky: function (paramsBundle) {
//		console.log('fn: manageOverlaySticky')
		var toolObject = this;
		
		var term = paramsBundle.type;
		
		this.transitionCall = 'draw';
		
		if (!this.isTermSelected(term)) {
			this.doTermSelect(term, true);
		} else {
			this.doTermDeselect(term, true);
		}
	},
	
	getTermIndex: function(term) {
		var index = -1;
		var selector = selector = this.removeFilteredCharacters(term);
		var len = this.overlayQueue.length;
		while(--len >= 0){
			if(selector === this.overlayQueue[len].selector){ 
				index = len;
			}
		}
		return index;
	},
	
	isTermSelected: function(term) {
		return this.getTermIndex(term) !== -1;
	},
	
	doTermSelect: function(term, legendAdd) {
		var selector = selector = this.removeFilteredCharacters(term);
		//finish updating API array of selected words
		var apiArray = this.parent.getApiParam('selectedWords');
		apiArray.push(term);
		this.parent.setApiParams({selectedWords: apiArray});
		
		//draw the sticky path
		var stickyColour = this.colorIndex[0];
		this.colorIndex.shift();
		
		if (legendAdd === true) {
			var legend = this.parent.query('[xtype=legend]')[0];
			legend.getStore().add({name: term, mark: stickyColour});
		} else {
			var legend = this.parent.query('[xtype=legend]')[0];
			var record = legend.getStore().findRecord('name', term);
			if (record !== null) {
				record.set('mark', stickyColour);
				legend.refresh();
			}
		}
		
		//repopulate colour index if it is empty
		if(this.colorIndex.length === 0) { 
			for(var i = 0; i < this.colorMasterList.length; i++){
				this.colorIndex.push(this.colorMasterList[i]);
			}
		}
		var pathHolder = this.prepareFullPath(term);
		var lineObject = {
			word: term, 
			selector: selector,
			params: {params: {}, type: term},
			fullPath: pathHolder.path,
			pathMin: pathHolder.min,
			pathMax: pathHolder.max,
			colour: stickyColour
		};
		
		//if this was selected a slippery before click event remove line from navigation bar
		if(selector === this.lastSlippery){
			this.sliderOverlayOff(selector);
			this.lastSlippery = null;
		}
		
		//make sure there is no path already present
		this.chart.select('g[class=frequency-line-' + selector + ']').remove();

		this.overlayQueue.push(lineObject);
		this.chartOverlayOn(lineObject);
		this.sliderOverlayOn(lineObject);
	},
	
	doTermDeselect: function(term, legendRemove) {
		var selector = this.removeFilteredCharacters(term);
		var index = this.getTermIndex(term);
		
		if (legendRemove === true) {
			var legend = this.parent.query('[xtype=legend]')[0];
			var index = legend.getStore().findExact('name', term);
			legend.getStore().removeAt(index);
		}
		
		var updateApi = this.parent.getApiParam('selectedWords');
		for(var i = 0, len = updateApi.length; i < len; i++) {
			if(updateApi[i] === selector) {
				updateApi.splice(i, 1);
				this.parent.setApiParams({selectedWords: updateApi});
			}
		}
		this.chartOverlayOff(selector);
		this.colorIndex.push(this.overlayQueue[index].colour);
    	this.overlayQueue.splice(index, 1);
    	this.sliderOverlayOff(selector);
		this.lastSticky = selector;
	}
	
	,prepareFullPath: function (string) {
		var linePosArray = [],
			pathMin = this.absMaxFreq,
			pathMax = this.absMinFreq;
		
		for(var k = 0, len = this.allData.length; k < len; k++){
			foundB = 0;
			for(var i = 0, lenA = this.allData[k].allDataInternal.length; i < lenA; i++) {
				for(var j = 0, lenB = this.allData[k].allDataInternal[i].frequencyArray.length; j < lenB; j++){
					if(this.allData[k].allDataInternal[i].frequencyArray[j].wordString === string){
						var yVal1 = this.allData[k].allDataInternal[i].frequencyArray[j].freq;
						linePosArray.push({x: k, y: yVal1});
						if(yVal1 < pathMin) pathMin = yVal1;
						if(yVal1 > pathMax) pathMax = yVal1;
						foundB = 1;
					}
				}
			}
			if(foundB === 0){
				var yVal2 = this.minFreq;
				linePosArray.push({x: k, y: yVal2});
				if(yVal2 < pathMin) pathMin = yVal2;
				if(yVal2 > pathMax) pathMax = yVal2;
			}
		}
		return {path: linePosArray, min: pathMin, max: pathMax};
	}
	
	,updateFullPath: function () {
//		console.log("fn: updateFullPath")
		var lenA = this.overlayQueue.length;
		while(lenA-- > 0){
			var pathHolder = this.prepareFullPath(this.overlayQueue[lenA].word);
			this.overlayQueue[lenA].fullPath = pathHolder.path;
			this.overlayQueue[lenA].pathMin = pathHolder.min;
			this.overlayQueue[lenA].pathMax = pathHolder.max;
		}
//		console.log(this.overlayQueue)
	}
	
	,buildSliderPath: function (pathArray) {
		var toolObject = this;
		var line = d3.svg.line()
		    .x(function(d) { return toolObject.xSliderScale(d.x); })
		    .y(function(d) { return toolObject.ySliderScale(d.y); })
		    .interpolate("monotone");
		return line(pathArray);
	}
	
	,sliderOverlayOn: function (objectToSelect) {
		//console.log('fn: sliderOverlayOn')		
		this.transitionSliderOverlay(objectToSelect);
		
		//draw path
		this.chart.append('g')
			.attr('id', 'slider-line-' + objectToSelect.word)
			.append('path')
			.attr("d", this.buildSliderPath(objectToSelect.fullPath))
			.style('stroke', objectToSelect.colour)
			.style('stroke-width', 2)
			.style('fill', 'none');
			
		//redraw slider
		this.redrawSlider();
	}
	
	,sliderOverlayOff: function (selector) {
	    this.chart.selectAll('g[id=slider-line-' + selector + ']')
	    	.remove();
	    
	    //update slider overlay axis
		this.transitionSliderOverlay();
	}
	
	,redrawSliderOverlay: function() {	
		//console.log('redrawSliderOverlay')
		for(var l = 0; l < this.overlayQueue.length; l++){
			this.sliderOverlayOff(this.overlayQueue[l].selector);
			this.sliderOverlayOn(this.overlayQueue[l]);
		}
	}
	
	,transitionSliderOverlay: function(objectToSelect) {
		//console.log('transitionSliderOverlay')
		objectToSelect = objectToSelect || 0;
		
		//update slider overlay axis
		this.updateYSliderScale(objectToSelect);
		
		//transition all other paths
		var lenA = this.overlayQueue.length;
		while(lenA-- > 0){
			this.chart.selectAll('g#slider-line-' + this.overlayQueue[lenA].selector)
				.select('path')
				.transition().duration(300)
				.ease('linear')
				.attr("d", this.buildSliderPath(this.overlayQueue[lenA].fullPath));
		}
	}
	
	,preparePath: function (string) {
		//console.log('fn: prepareData')
		
		var linePosArray = [];
		
		//peek at the next frequency point and the preceding one to end the line on the edge of the graph
		var foundA
			,foundB
			,foundC;
		
		//add two positions offscreen to the left for smooth transitions 
		for(var k = 0; k < 3 && this.shiftCount - k > 0; k++) {
			foundA = 0;
			for(var i = 0; i < this.allData[this.shiftCount - (1 + k)].allDataInternal.length; i++) {
				for(var j = 0; j < this.allData[this.shiftCount - (1 + k)].allDataInternal[i].frequencyArray.length; j++){
					if(this.allData[this.shiftCount - (1 + k)].allDataInternal[i].frequencyArray[j].wordString === string){
						var yVal3 = this.yScale(this.allData[this.shiftCount - (1 + k)].allDataInternal[i].frequencyArray[j].freq);
						linePosArray.unshift({x: this.shiftCount - (1 + k), y: yVal3});
						foundA = 1;
					}
				}
			}
			if(foundA === 0){
				var yVal4 = this.yScale(this.minFreq);
				linePosArray.unshift({x: this.shiftCount - (1 + k), y: yVal4});
			}
		}
		
		//fill in the middle values
		for(var k = this.shiftCount, len = this.numVisPoints + this.shiftCount; k < len; k++){
			foundB = 0;
			for(var i = 0, lenA = this.allData[k].allDataInternal.length; i < lenA; i++) {
				for(var j = 0, lenB = this.allData[k].allDataInternal[i].frequencyArray.length; j < lenB; j++){
					if(this.allData[k].allDataInternal[i].frequencyArray[j].wordString === string){
						var yVal1 = this.yScale(this.allData[k].allDataInternal[i].frequencyArray[j].freq);
						linePosArray.push({x: k, y: yVal1});
						foundB = 1;
					}
				}
			}
			if(foundB === 0){
				var yVal2 = this.yScale(this.minFreq);
				linePosArray.push({x: k, y: yVal2});
			}
		}
		
		//add two positions offscreen to the right for smooth transitions 
		for(var k = 0; k < 3 && this.numVisPoints + this.shiftCount + k < this.numDataPoints; k++){
			foundC = 0;
			for(var i = 0; i < this.allData[this.numVisPoints + this.shiftCount + k].allDataInternal.length; i++) {
				for(var j = 0; j < this.allData[this.numVisPoints + this.shiftCount + k].allDataInternal[i].frequencyArray.length; j++){
					if(this.allData[this.numVisPoints + this.shiftCount + k].allDataInternal[i].frequencyArray[j].wordString === string){
						var yVal1 = this.yScale(this.allData[this.numVisPoints + this.shiftCount + k].allDataInternal[i].frequencyArray[j].freq);
						linePosArray.push({x: this.numVisPoints + this.shiftCount + k, y: yVal1});
						foundC = 1;
					}
				}
			}
			if(foundC === 0){
				var yVal2 = this.yScale(this.minFreq);
				linePosArray.push({x: this.numVisPoints + this.shiftCount + k, y: yVal2});
			}
		}
		return linePosArray;
	}
	
	//draws the line graph overlay of the frequency info
	,chartOverlayOn: function(objectToSelect) {
//		console.log('fn: chartOverlayOn')
		
		var toolObject = this;
					
		//change selected word colour
		this.chart.selectAll('g[class=section]')
			.selectAll('g[class=frequencies]')
			.selectAll('text[class=' + objectToSelect.selector + ']')
			.style('fill', objectToSelect.colour)
			.style('fill-opacity', 1);
	    	
	    //if transitionCall === 'draw': draw the function for the first time		
		//if not: shift displayData to a different subset of allData
		//then display the newly shifted data
		
		var linePosArray = this.preparePath(objectToSelect.word);
		
		var pos;
		
		//draw path
		var line = d3.svg.line()
		    .x(function(d) { 
		    	pos = d.x;
		    	return toolObject.xScale(d.x + toolObject.callOffset()); })
		    .y(function(d) { return d.y; })
		    .interpolate('monotone');
		
		var path = this.chart.select('.overlay')
			.append('g')
			.attr('class', 'frequency-line-' + objectToSelect.selector)
			.append('path')
			.attr("d", line(linePosArray))
			.style('stroke', objectToSelect.colour)
			.style('stroke-width', 2)
			.style('fill', 'none');
					
		var posDif = (this.xScale(pos) - this.xScale(pos + this.callOffset()));
		
		if(this.transitionCall === 'left' || this.transitionCall ==='right') {
			path.transition()
				.duration(toolObject.getDuration())
				.ease("linear")
			    .attr("transform", "translate(" + posDif + ")");
		}
	}
	
	,chartOverlayOff: function(selector){
		var toolObject = this;
		
		this.chart.selectAll('text.' + selector)
	    	.style('fill', 'black')
	    	.style('fill-opacity', function(d) { return toolObject.opacityScale(d.freq); });
	    
	    this.chart.select('g.frequency-line-' + selector)
	    	.remove();
	}
	
	//reselect all the sticky words
	//a screen movement has changed the words positions
	,redrawChartOverlay: function () {
		//console.log('fn: redrawChartOverlay')
		for(var i = 0; i < this.overlayQueue.length; i++){
			this.chartOverlayOff(this.overlayQueue[i].selector);
			this.chartOverlayOn(this.overlayQueue[i]);
		}
	}
	
	//
	//SCALE FUNCTIONS
	//
	
	//all these scales need to be updated if this.absMaxFreq or this.valFraction changes
	,manageAllYScales: function() {
		this.manageFontScale();
		this.manageOpacityScale();
		this.manageYScale();
		this.manageYSliderScale();
	}
	
	,manageFontScale: function() {
		//console.log('fn: fontScale')
		 this.fontScale.domain([this.minFreq, this.absMaxFreq * this.valFraction])
	    	.range([10, this.maxFont]);
	}
	
	/*,maxFontScale : function (value) {
		var scale = d3.scale.linear()
			.domain([600,2000])
			.range([15,60]);
		return scale(value);
	}*/
	
	,manageOpacityScale: function() {
		this.opacityScale.domain([0, this.absMaxFreq * this.valFraction])
    		.range([0.4, 0.8]);
	}
	
	,manageYScale: function () {
		if(this.parent.getApiParam('yAxisScale') == 'linear') this.yScale = d3.scale.linear();
		if(this.parent.getApiParam('yAxisScale') == 'log') this.yScale = d3.scale.log();
		
		this.yScale.domain([this.minFreq, this.absMaxFreq * this.valFraction * 1.25])
				.rangeRound([this.container.getHeight() - this.bPadding, (this.tPadding * 2) + this.navigationHeight]);
	}
	
	,manageYSliderScale: function() {
		var top = this.tPadding
			,bottom = this.tPadding + this.navigationHeight;
		
		if(this.parent.getApiParam('yAxisScale') == 'linear') this.ySliderScale = d3.scale.linear();
		if(this.parent.getApiParam('yAxisScale') == 'log') this.ySliderScale = d3.scale.log();
		
		this.ySliderScale.domain([this.minFreq, this.absMaxFreq])
				.rangeRound([bottom, top]);
	}
	
	,updateYSliderScale: function(updateWithObject) {
		updateWithObject = updateWithObject || 0;
		var selectedMin = this.minFreq, //setting this to this.absMinFreq effectively deactivates it, to make it work use this.absMaxFreq
			selectedMax = 0;
	    	
	    //go through overlayQueue check for min / max
		var len = this.overlayQueue.length;
		while(len-- > 0){
			if(this.overlayQueue[len].pathMin < selectedMin) selectedMin = this.overlayQueue[len].pathMin;
			if(this.overlayQueue[len].pathMax > selectedMax) selectedMax = this.overlayQueue[len].pathMax;
		}
		if(updateWithObject != 0 && updateWithObject.pathMin < selectedMin) selectedMin = updateWithObject.pathMin;
		if(updateWithObject != 0 && updateWithObject.pathMax > selectedMax) selectedMax = updateWithObject.pathMax;
		
		this.ySliderScale.domain([selectedMin, selectedMax]);
	}
	
	,manageAllXScales: function() {
		this.manageXScale();
		this.manageXSliderScale();
	}
	
	,manageXScale: function() {
		this.xScale.domain([this.shiftCount - 0.5, this.numVisPoints + this.shiftCount - 0.5])
	    	.range([this.lPadding, this.container.getWidth() - this.rPadding]);
	}
	
	,manageXSliderScale: function() {
		this.xSliderScale.domain([0, this.numDataPoints - 1])
	    	.range([this.lPadding, this.container.getWidth() - this.rPadding]);
	}

	//
	//MISC. FUNCTIONS
	//

	
	,setTitleLength: function () {
		//console.log('fn:setTitleLength')
		var toolObject = this, 
			item;
		this.titlesArray = [];
		
		var scale = d3.scale.linear()
			.domain([350,1250])
			.range([10,40]);
		
		var corpus = this.parent.getCorpus();
		for (var i = 0, len = corpus.getDocumentsCount(); i < len; i++) {
			var item = corpus.getDocument(i);
			var shortTitle = item.getShortTitle();			
			if(shortTitle.length <= scale(toolObject.container.getWidth())) {
				toolObject.titlesArray.push(shortTitle); 
			} else {
				var shorterTitle = shortTitle.substring(0,scale(toolObject.container.getWidth()) - 3);
				toolObject.titlesArray.push(shorterTitle + '...'); 
			}
		}
	}
	
	,callOffset: function () {
//		console.log('fn: callOffset')
		var callOffset;
		if(this.transitionCall === 'draw' || this.transitionCall === 'redraw') { 
			callOffset = 0; 
		}
		if(this.transitionCall === 'left') { 
			callOffset = -1;
		}
		if(this.transitionCall === 'right') { 
			callOffset = 1;
		}
		return callOffset;
	}
	
	,removeFilteredCharacters: function (string) {
		//console.log('fn: removeFilteredCharacters')
		return string || '';
		
		if (string !== undefined) {
			return string.replace("'","apostrophe-")
				.replace("#","pound-")
				.replace("&","ampersand-")
				.replace("@","atsign-")
				.replace("!","exclamation-")
				.replace("0","num-o")
				.replace("1","num-a")
				.replace("2","num-b")
				.replace("3","num-c")
				.replace("4","num-d")
				.replace("5","num-e")		
				.replace("6","num-f")
				.replace("7","num-g")
				.replace("8","num-h")
				.replace("9","num-i")
				.replace(/[^a-zA-Z]+/g,'-'); //then anything else...
		} else {
			return '';
		}
	},
	
	getDuration: function() {
		return this.numDataPoints*(100-this.getSpeed())
	}
	
};