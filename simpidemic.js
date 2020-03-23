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
// EpidemicSimulator - top level application class


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
    constructor(name, min, max, value) {
        this.div = document.createElement('div');

        var paragraph = document.createElement('p');
        var textNode = document.createTextNode(name + ": ");
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
        this.span.innerHTML = this.valueListener(this.slider.value);
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
        let dataMax = Math.max.apply(null, data)
        var yScaler = this.height / dataMax;
        for (i = 0; i < data.length; i++) {
          var x = i * this.width / data.length;
          var y = this.height - (yScaler * data[i]);
          this.ctx.lineTo(x, y);
        }
        this.ctx.stroke();
    }
}

class VirusModel {
    constructor() {
        this.transmissionProbability = 0.5;
    }

    getTransmissionProbability(day) {
        return this.transmissionProbability;
    }

    gstTransmissionProbability(transmissionProbability) {
        this.transmissionProbability = transmissionProbability;
    }
}

class CompartmentModel {
    constructor(population, infected) {
        this.succeptible = population - infected;
        this.infected = infected;
        this.recovered = 0;
    }

    getPopulation() {
        return this.succeptible + this.infected + this.recovered;
    }
}

class ESimUI {
    constructor(episim, topDiv) {
        this.episim = episim;
        this.topDiv = topDiv;
        console.log(this.topDiv);
        this.appendParagraph("Disclaimer: IANAE");
        this.sliderContacts = new RangeSlider("contactsPerDay", 0, 100, 10);
        this.sliderContacts.setValueListener(this.handleContacts.bind(this));
        this.topDiv.appendChild(this.sliderContacts.getElement());
        this.canvas = this.appendCanvas(600, 300, "border:2px solid #d3d3d3");
    }

    handleContacts(value) {
        var contactsPerDay =  value * 0.1;
        this.episim.setContactsPerDay(contactsPerDay);
        this.episim.simulate();
        return contactsPerDay;
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
        this.contactsPerDay = 1.0;
    }

    setContactsPerDay(contactsPerDay) {
        this.contactsPerDay = contactsPerDay;
    }

    simulate() {
        var compartment = new CompartmentModel(1000, 1);
        console.log("============ population = " + compartment.population);
        var i = 0;
        var cases = [];
        compartment.infected = 1;
        var infectionDuration = 14;
        var recoveryRate = 1.0 / infectionDuration;
        for (i = 0; i < 20; i++) {
            var beta = this.contactsPerDay * this.virus.getTransmissionProbability();
            var deltaS = beta
                    * compartment.infected
                    * compartment.succeptible
                    / compartment.getPopulation();
            var iDeltaS = Math.floor(deltaS);

            var deltaR = recoveryRate * compartment.infected;
            var iDeltaR = Math.floor(deltaR);
            compartment.succeptible -= iDeltaS;
            compartment.recovered += iDeltaR;
            compartment.infected += iDeltaS - iDeltaR;

            console.log("succeptible = " + compartment.succeptible
                + ", infected = " + compartment.infected
                + ", recovered = " + compartment.recovered
                + ", population = " + compartment.getPopulation()
            );
            cases.push(compartment.infected);
        }
        this.chart.drawSingle(cases);
    }
}
