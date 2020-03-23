/**
 * Epidemic Simulator
 * Author: Phil Burk
 * Apache Open Source
 */

// ChartMaker - displays multiple data sets, axes
// VirusModel - R0(day), mortality(age)
// CompartmentModel - population, demographics,
// MitigationModel - social distancing, vaccination, hospital capacity
// VirusEditor
// CompartmentEditor
// SimulationEngine
// EpiSimulator - top level application class


var addAttribute = function(element, name, value) {
    var att = document.createAttribute(name);
    att.value = value;
    element.setAttributeNode(att);
    return att;
}

// <div class="slidecontainer">
//   <input type="range" min="1" max="100" value="50" class="slider" id="myRange">
//   <p>Value: <span id="demo"></span></p>
// </div>
class RangeSlider {
    constructor(min, max, value) {
        this.div = document.createElement('div');

        var paragraph = document.createElement('p');
        var textNode = document.createTextNode("Current: ");
        paragraph.appendChild(textNode);
        this.span = document.createElement('span');
        paragraph.appendChild(this.span);
        this.div.appendChild(paragraph);

        var slider = document.createElement('input');
        slider.type = "range";
        slider.min = min;
        slider.max = max;
        slider.value = value;
        slider.class = "slider";
        slider.addEventListener("input", this);
        this.slider = slider;
        this.div.appendChild(slider);
    }

    handleEvent(event) {
        this.span.innerHTML = this.valueListener.handleValue(this.slider.value);
    }

    setValueListener(valueListener) {
        this.valueListener = valueListener;
    }

    getElement() {
        return this.div;
    }
}

class ChartMaker {
    constructor(canvas) {
        this.ctx = canvas.getContext("2d");
        this.width = canvas.width;
        this.height = canvas.height;
    }

    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height)
    }

    drawSingle(data) {
        this.clear();
        this.ctx.beginPath();
        this.ctx.lineWidth = "5";
        this.ctx.strokeStyle = "red"; // Green path
        this.ctx.moveTo(0, this.height);
        var i;
        for (i = 0; i < data.length; i++) {
          var x = i * this.width / data.length;
          var y = this.height - data[i];
          this.ctx.lineTo(x, y);
        }
        this.ctx.stroke();
    }
}

class VirusModel {
    constructor() {
        this.R0 = 1.05;
    }

    getR0(day) {
        return this.R0;
    }
    setR0(r0) {
        this.R0 = r0;
    }
}

class ESimUI {
    constructor(episim, topDiv) {
        this.episim = episim;
        this.topDiv = topDiv;
        console.log(this.topDiv);
        this.appendParagraph("Disclaimer: IANAE");
        this.sliderR0 = new RangeSlider(0, 100, 10);
        this.sliderR0.setValueListener(this);
        this.topDiv.appendChild(this.sliderR0.getElement());
        this.canvas = this.appendCanvas(600, 300, "border:2px solid #d310d3");
    }
    handleValue(value) {
        var r0 =  value * 0.1;
        this.episim.setR0(r0);
        this.episim.simulate();
        return r0;
    }
    appendCanvas(width, height, style) {
        var canvas = document.createElement('canvas');
        addAttribute(canvas, "width", width);
        addAttribute(canvas, "height", height);
        addAttribute(canvas, "style", style);
        this.topDiv.appendChild(canvas);
        return canvas;
    }

    appendParagraph(text) {
        var paragraph = document.createElement('p');
        var textNode = document.createTextNode(text);
        paragraph.appendChild(textNode);
        this.topDiv.appendChild(paragraph);
        return paragraph;
    }

    getCanvas() {
        return this.canvas;
    }
}

class EpidemicSimulator {

    constructor(topDiv, canvas) {
        this.virus = new VirusModel();
        this.simUI = new ESimUI(this, topDiv);
        this.chart = new ChartMaker(this.simUI.getCanvas());
    }

    setR0(r0) {
        this.virus.setR0(r0);
    }

    simulate() {
        var i = 0;
        var cases = [];
        var n = 1;
        for (i = 0; i < 10; i++) {
            n += n * this.virus.getR0(0);
            cases.push(n);
        }
        this.chart.drawSingle(cases);
    }
}
