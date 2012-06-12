HexMap = function(/*config*/){
	var $this =this;
	var SQRT_3 = Math.sqrt(3);
	var OFFSET_Y = 0.5*SQRT_3;
	
	var positionTestEle;
	var backBufferEle;
	var backBufferScale;
	
	var lastBlitViewport;  //track the most recent requested rectangle in the back buffer
	var lastBlitPixels;  //cache the most recent back buffer block copied
	
	var config = {
		rows:10,
		columns:10,
		scale: 10,
		fillStyle:null,
		strokeStyle:"#000000",
		lineWidth:1
	};

	var unitPoints = [
			{x:-1,y:0},
			{x:-0.5,y:OFFSET_Y},
			{x:0.5,y:OFFSET_Y},
			{x:1,y:0},
			{x:0.5,y:-1*OFFSET_Y},
			{x:-0.5,y:-1*OFFSET_Y}
		];
	
	function drawPositionOverlayMap(){
		var canvasEle = document.getElementById("canvas1");
		var ctx = canvasEle.getContext("2d");
		var width = canvasEle.width;
		var height = canvasEle.height;
		ctx.lineWidth = 0;
		for (var i=0;i<width;i++){
			for (var j=0;j<height;j++){
				var mapCoords = getHexCoordinate3(i,j,config.scale);
				ctx.fillStyle=mapCoords.color;
				ctx.fillRect(i,j,1,1);
			}
		}
		ctx.lineWidth = 1;
		ctx.strokeStyle = "#000000";
		ctx.textColor="#000000";
		var rows = config.rows;
		var columns = config.columns;
		for (var i=0;i<columns;i++){
			for (var j=0;j<rows;j++){
				drawHex(ctx,i,j,config.scale,false,true);
			}
		}
	}
	
	function calculateHexPosition(x,y,scale,overrideOffset){
		var xscaled = x*scale;
		var yscaled = y*scale;
		var yoffsetScaled = Math.floor(OFFSET_Y*scale);
		//center of hex cells are 2 units apart, adjust by scale to move column 0 fully into rendered area
		var centerX=xscaled*1.5+(overrideOffset?0:scale);
		var centerY;
		if(x%2){ //odd numbered columns
			centerY = yscaled*OFFSET_Y*2;
		}else{
			centerY = yscaled*OFFSET_Y*2+0.5*scale*SQRT_3;
		}
		//adjust by OFFSET_Y*scale to move row 0 fully into rendered area onto screen
		if(!overrideOffset){
			centerY+=OFFSET_Y*scale;
		}	
		return {
			centerX:centerX,
			centerY:centerY
		}
	}
	
	function drawHex(ctx,x,y,scale,fill,showCoords){
		//if(x%2!=y%2) return;
		var overrideOffset = arguments.length>6?arguments[6]:false;
		/*
		var xscaled = x*scale;
		var yscaled = y*scale;
		var yoffsetScaled = Math.floor(OFFSET_Y*scale);
		//center of hex cells are 2 units apart, adjust by scale to move column 0 fully into rendered area
		var centerX=x*scale*1.5+(overrideOffset?0:scale);
		var centerY;
		if(x%2){ //odd numbered columns
			centerY = y*scale*OFFSET_Y*2;
		}else{
			centerY = y*scale*OFFSET_Y*2+0.5*scale*SQRT_3;
		}
		//adjust by OFFSET_Y*scale to move row 0 fully into rendered area onto screen
		if(!overrideOffset){
			centerY+=OFFSET_Y*scale;
		}*/
		var hexPosition = calculateHexPosition(x,y,scale,overrideOffset);
		var centerX = hexPosition.centerX;
		var centerY = hexPosition.centerY;
		var scaledPoints = [
			{x:centerX+unitPoints[0]["x"]*scale,y:centerY+unitPoints[0]["y"]*scale},
			{x:centerX+unitPoints[1]["x"]*scale,y:centerY+unitPoints[1]["y"]*scale},
			{x:centerX+unitPoints[2]["x"]*scale,y:centerY+unitPoints[2]["y"]*scale},
			{x:centerX+unitPoints[3]["x"]*scale,y:centerY+unitPoints[3]["y"]*scale},
			{x:centerX+unitPoints[4]["x"]*scale,y:centerY+unitPoints[4]["y"]*scale},
			{x:centerX+unitPoints[5]["x"]*scale,y:centerY+unitPoints[5]["y"]*scale}
		];
		ctx.beginPath();
		ctx.moveTo(scaledPoints[0]["x"],scaledPoints[0]["y"]);
		ctx.lineTo(scaledPoints[1]["x"],scaledPoints[1]["y"]);
		ctx.lineTo(scaledPoints[2]["x"],scaledPoints[2]["y"]);
		ctx.lineTo(scaledPoints[3]["x"],scaledPoints[3]["y"]);
		ctx.lineTo(scaledPoints[4]["x"],scaledPoints[4]["y"]);
		ctx.lineTo(scaledPoints[5]["x"],scaledPoints[5]["y"]);
		ctx.closePath();
		ctx.stroke();
		if(fill){
			ctx.fill();
		}
		if(showCoords&&scale>25){
			var oldFill=ctx.fillStyle;
			ctx.fillStyle=ctx.strokeStyle;
			ctx.textAlign="center";
			ctx.fillText((x>9?"":"0")+x+(y>9?"":"0")+y,centerX,centerY-unitPoints[1]["y"]*scale+20);
			ctx.fillStyle=oldFill;
		}
	}
	
	function drawCachedHex(ctx,imageData,x,y,scale,showCoords){
		//console.log(arguments);
		var overrideOffset = arguments.length>7?arguments[7]:false;

		var hexPosition = calculateHexPosition(x,y,scale,overrideOffset);
		var centerX = hexPosition.centerX;
		var centerY = hexPosition.centerY;
		var singleHexMinX = centerX-1*scale;
		var singleHexMinY = centerY-OFFSET_Y*scale;
		ctx.putImageData(imageData,singleHexMinX,singleHexMinY);
		if(showCoords&&scale>25){
			var oldFill=ctx.fillStyle;
			ctx.fillStyle=ctx.strokeStyle;
			ctx.textAlign="center";
			ctx.fillText((x>9?"":"0")+x+(y>9?"":"0")+y,centerX,centerY-unitPoints[1]["y"]*scale+20);
			ctx.fillStyle=oldFill;
		}
	}
	/*
	 * Determine the hex-map coordinate using a color map of the scaled unit hex
	 * and surrounding hexes.
	 *
	 * 1) translate coordinates to be relative to hex at 0000
	 * 2) Check color value in the mapMouseCoordTracker canvas
	 * 
	 * Negative values for the row or column indicate that the position could not
	 * be determined.  It is either on a hex boundary or outside the map area.
	*/
	this.getHexCoordinate=function(x,y,viewport){
		var scale=config.scale;
		var yoffset = Math.floor(0.5*SQRT_3*scale);
		
		var r=0,c=0;
		
		var absoluteX = x+viewport.xmin+scale*0.5;
		var absoluteY = y+viewport.ymin;

		var positionMaskWidth = positionTestEle.width;
		var positionMaskHeight = positionTestEle.height;
		
		var positionOffsetX = absoluteX % positionMaskWidth;
		var positionOffsetY = absoluteY % positionMaskHeight;
		
		var baseX = Math.floor(absoluteX / positionMaskWidth);
		var baseY = Math.floor(absoluteY / positionMaskHeight);

		var rootX = baseX*2;
		var rootY = baseY*2;
	
		var ctx = positionTestEle.getContext("2d");
		var data = ctx.getImageData(positionOffsetX,positionOffsetY,1,1);

		var red=data.data[0];
		var green=data.data[1];
		var blue=data.data[2];

		r=rootY;
		c=rootX;
		if(red==255&&green==0&&blue==0){  //upper left
			r=rootY-1;
			c=rootX-1;
		} else if(red==0&&green==255&&blue==0){  //upper center
			r=rootY-1;
		} else if(red==0&&green==0&&blue==255){  //upper right
			c=rootX+1;
			r=rootY-1;
		} else if(red==0&&green==255&&blue==255){  //lower right
			c=rootX+1;
		} else if(red==255&&green==0&&blue==255){  //lower center
			r=rootY+1;
		} else if(red==255&&green==255&&blue==0){  //lower left
			c=rootX-1;
		} else if(red!=255||green!=255||blue!=255){
			r=-1;
			c=-1;
		}
		if(c%2){
			r=r+1;
		}
		return {r:r,c:c,color:"rgba("+red+","+green+","+blue+",255)"};
	}
	
	/*
	 * Draw a representation of the upper-left hex at 0000 and surrounding
	 * hexes.
	 */
	function drawPositionTest(){
		if(!positionTestEle){
			positionTestEle = document.createElement("canvas");
			//positionTestEle.style.border="1px blue solid";
			//document.body.appendChild(positionTestEle);
		}
		scale=config.scale;
		var width = (3)*scale;
		var height = 2*SQRT_3*scale;
		positionTestEle.width=width;
		positionTestEle.height=height;
		var ctx = positionTestEle.getContext("2d");
		ctx.fillStyle="#000000";
		ctx.fillRect(0,0,config.scale*4,height);
		ctx.lineWidth = 0;
		ctx.strokeStyle = "#FFFFFF";
		ctx.textColor="#000000";
		ctx.fillStyle="#FF0000";
		drawHex(ctx,0,0,scale,true,false,true);
		ctx.fillStyle="#00FF00";
		drawHex(ctx,1,0,scale,true,false,true);
		ctx.fillStyle="#0000FF";
		drawHex(ctx,2,0,scale,true,false,true);
		ctx.fillStyle="#00FFFF";
		drawHex(ctx,2,1,scale,true,false,true);
		ctx.fillStyle="#FF00FF";
		drawHex(ctx,1,2,scale,true,false,true);
		ctx.fillStyle="#FFFF00";
		drawHex(ctx,0,1,scale,true,false,true);
		ctx.fillStyle="#FFFFFF";
		drawHex(ctx,1,1,scale,true,false,true);
	}
	
	/*
	 * Draw the entire hex map to an offscreen buffer
	 * 
	 */
	this.draw = function(scale){
		if(!backBufferEle){
			backBufferEle = document.createElement("canvas");
			//backBufferEle.style.border="1px black solid";
			//document.body.appendChild(backBufferEle);
		}
		backBufferScale = scale;
		/*
		var singleHexBufferEle = document.createElement("canvas");
		var singleHexCtx = singleHexBufferEle.getContext("2d");
		document.body.appendChild(singleHexBufferEle);
		var singleHexCenter = calculateHexPosition(0,0,scale,true);
		console.log(singleHexCenter);
		var centerX = singleHexCenter.centerX;
		var centerY = singleHexCenter.centerY;
		var singleHexMinX = centerX-1*scale;
		var singleHexMaxX = centerX+1*scale;
		var singleHexMinY = centerY-OFFSET_Y*scale;
		var singleHexMaxY = centerY+OFFSET_Y*scale;
		var singleHexWidth = singleHexMaxX-singleHexMinX;
		var singleHexHeight = singleHexMaxY-singleHexMinY;
		
		singleHexCtx.clearRect(singleHexMinX,singleHexMinY,singleHexWidth,singleHexHeight);
		drawHex(singleHexCtx,0,0,scale,false,false);
		var cachedHex = singleHexCtx.getImageData(singleHexMinX,singleHexMinY,singleHexWidth,singleHexHeight);
		*/
		config.scale=scale;
		backBufferEle.width = (config.columns*scale*1.57);
		backBufferEle.height = (config.rows*scale*1.85);
		var ctx = backBufferEle.getContext("2d");
		ctx.clearRect(0,0,backBufferEle.width,backBufferEle.height);
		ctx.fillStyle="#000000";
		ctx.lineWidth = 1;
		ctx.strokeStyle = config.strokeStyle;
		ctx.textColor="#FF0000";
		for (var y=0;y<config.rows;y++){
			for (var x=0;x<config.columns;x++){
				drawHex(ctx,x,y,scale,false,true)
				//drawCachedHex(ctx,cachedHex,x,y,scale,false,true);
			}
		}
		drawPositionTest(scale);
	}
	
	/*
	 * copies the visible portion (as determined by viewportDefinition) to the
	 * provided canvas.
	 * base coordinates for the viewport are assumed to be the required
	 * coordinates within the map.
	 */
	this.blit=function(canvas,viewport){
		var imageData;
		if(lastBlitViewport && lastBlitPixels && 
				viewport.xmin == lastBlitViewport.xmin && 
				viewport.ymin == lastBlitViewport.ymin && 
				viewport.width == lastBlitViewport.width && 
				viewport.height == lastBlitViewport.height &&
				viewport.scale == lastBlitViewport.scale){ //if we have cached data and are rendering the same region
			imageData = lastBlitPixels;
		} else {
			if(viewport.scale!=backBufferScale){
				$this.draw(viewport.scale);
			}
			lastBlitViewport = {
				xmin:viewport.xmin,
				ymin:viewport.ymin,
				width:viewport.width,
				height:viewport.height,
				scale:viewport.scale
			};
			var context = backBufferEle.getContext("2d");
			imageData = context.getImageData(viewport.xmin,viewport.ymin,viewport.width,viewport.height);
			lastBlitPixels=imageData;
			config.scale=viewport.scale;
		}
		canvas.putImageData(imageData,viewport.offsetx,viewport.offsety);
	}
	this.getMapSize=function(){
		return {
			rows: config.rows,
			columns: config.columns,
			width: backBufferEle?backBufferEle.width:-1,
			height: backBufferEle?backBufferEle.height:-1
		};
	}
	
	if(arguments.length>0){
		var config2=arguments[0];
		for (var i in config2){
			config[i] = config2[i];
		}
	}
	
}
